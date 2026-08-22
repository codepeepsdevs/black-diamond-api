import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateOrderDto,
  FillTicketDetailsDto,
  GenerateOrderReportQueryDto,
  GetOrdersQuery,
  GetRevenueQueryDto,
  UserOrderPaginationDto,
} from './dto/orders.dto';
// import { PaginationQueryDto } from 'src/shared/dto/pagination-query.dto';
import { Order, Prisma, TicketType, User, UserRole } from '@prisma/client';
import { StripeService } from 'src/stripe/stripe.service';
import { EmailsService } from 'src/emails/emails.service';
import { ConfigService } from '@nestjs/config';
import { JWT_ACCESS_TOKEN_SECRET } from 'src/constants';
import { JwtService } from '@nestjs/jwt';
import { TokenPayload } from 'src/auth/types/tokenPayload.interface';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcryptjs';
import * as dateFns from 'date-fns';
import { getPagination } from 'src/utils/get-pagination';
import { DateRangeQueryDto } from 'src/shared/dto/date-range-query.dto';
import { customAlphabet } from 'nanoid';
import {
  getEventStatus,
  isTicketTypeVisible,
  getTimeZoneDateRange,
  newYorkTimeZone,
} from 'src/utils/helpers';
import { EventsService } from 'src/events/events.service';
import * as XLSX from 'xlsx';
import { AuthenticationService } from 'src/auth/services/auth.service';
import { NewsletterService } from 'src/newsletter/newsletter.service';
import { FRONTEND_URL } from 'src/constants';
import * as dateFnsTz from 'date-fns-tz';

const nanoid = customAlphabet('1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ', 12);

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private readonly stripeService: StripeService,
    private readonly emailService: EmailsService,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly userService: UsersService,
    private readonly eventService: EventsService,
    private readonly authService: AuthenticationService,
    private readonly newsletterService: NewsletterService,
  ) {}

  async createOrder(dto: CreateOrderDto, token: string | undefined) {
    let user: User | null = null;
    let newAccount = false;
    console.log('---------placing order-------');
    const event = await this.eventService.getEvent(dto.eventId);
    if (event.eventStatus === 'PAST') {
      throw new InternalServerErrorException(
        'Event is in the past, cannot book an event in the past',
      );
    }
    if (!event.isPublished) {
      throw new InternalServerErrorException(
        'This event is not yet taking orders',
      );
    }
    // TODO: pass in if they allow promotions in the dto
    if (dto.eventUpdates) {
      this.newsletterService
        .subscribe({
          email: dto.email.toLowerCase(),
        })
        .then(() => {
          console.log('Successfully subscribed to newletter');
        })
        .catch((e) => console.log(e));
    }
    // Check promocode
    let promocode: Awaited<
      ReturnType<typeof this.eventService.getPromocodeById>
    > = null;
    if (dto.promocodeId) {
      promocode = await this.eventService.getPromocodeById(dto.promocodeId);
      if (!promocode.isActive || promocode.eventId !== dto.eventId) {
        throw new InternalServerErrorException('Promocode is expired');
      }
    }

    return await this.prisma.$transaction(
      async (prisma) => {
        // if a token exists, place the order for the user the token belongs to
        if (token) {
          try {
            const payload: TokenPayload = await this.jwtService.verifyAsync(
              token,
              {
                secret: this.configService.get(JWT_ACCESS_TOKEN_SECRET),
              },
            );

            user = await this.userService.findOneById(payload.userId);

            // if user exists and they don't have a phone number associated with their profile, take it from the checkout data
            if (!user.phone) {
              // Not awaited so it does not stop the order from being placed
              this.prisma.user
                .update({
                  where: {
                    id: user.id,
                  },
                  data: {
                    phone: dto.phone,
                  },
                })
                .catch((e) => console.error(e));
            }
          } catch (e) {
            throw new UnauthorizedException(
              'The user session has expired, please login to place your order',
            );
          }

          if (!user) {
            throw new NotFoundException('User not found');
          }
        } else {
          const userExists = await this.userService.findOneByEmail(
            dto.email.toLowerCase(),
          );

          if (userExists) {
            user = userExists;
            newAccount = false;
            // if user exists and they don't have a phone number associated with their profile, take it from the checkout data
            if (!userExists.phone) {
              // Not awaited so it does not stop the order from being placed
              this.prisma.user
                .update({
                  where: {
                    id: userExists.id,
                  },
                  data: {
                    phone: dto.phone,
                  },
                })
                .catch((e) => console.error(e));
            }
          } else {
            newAccount = true;
            const hashedPassword = await bcrypt.hash('DEFAULT_PASSWORD', 10);
            try {
              user = await prisma.user.create({
                data: {
                  email: dto.email.toLowerCase(),
                  phone: dto.phone,
                  password: hashedPassword,
                  authMethod: 'EMAIL',
                  emailConfirmed: false,
                  // Create related Address and BillingInfo with just their IDs
                  address: {
                    create: {},
                  },
                  billingInfo: {
                    create: {},
                  },
                },
                include: {
                  address: true,
                  billingInfo: true,
                },
              });

              user.password = undefined;
            } catch (error) {
              console.log(error);
              throw new HttpException(
                'Error occurred while placing order',
                HttpStatus.INTERNAL_SERVER_ERROR,
              );
            }
          }
        }

        if (promocode) {
          const now = new Date();
          const activePromoReservations = await prisma.order.count({
            where: {
              promocodeId: promocode.id,
              OR: [
                { paymentStatus: 'SUCCESSFUL' },
                {
                  paymentStatus: 'PENDING',
                  createdAt: { gte: dateFns.subMinutes(now, 30) },
                },
              ],
            },
          });
          if (
            activePromoReservations >= promocode.limit ||
            now < promocode.promoStartDate ||
            now >= promocode.promoEndDate
          ) {
            throw new BadRequestException('Promocode is no longer active');
          }
          // All checkouts using this code write the same record. MongoDB will
          // abort a competing transaction instead of allowing both to reserve
          // the final redemption.
          await prisma.promoCode.update({
            where: { id: promocode.id },
            data: { updatedAt: now },
          });
        }

        const allTicketOrders: { ticketTypeId: string }[] = [];
        const addonsOrders: { addonId: string; quantity: number }[] = [];
        const groupedTicketOrders = new Map<string, number>();

        for (const ticketTypeOrder of dto.ticketOrders) {
          if (ticketTypeOrder.quantity < 0) {
            throw new BadRequestException('Ticket quantities cannot be negative');
          }
          if (ticketTypeOrder.quantity > 0) {
            groupedTicketOrders.set(
              ticketTypeOrder.ticketTypeId,
              (groupedTicketOrders.get(ticketTypeOrder.ticketTypeId) || 0) +
                ticketTypeOrder.quantity,
            );
          }
        }

        for (const [ticketTypeId, quantity] of groupedTicketOrders) {
          const ticketType = event.ticketTypes.find(
            (ticketType) => ticketType.id === ticketTypeId,
          );
          if (!ticketType) {
            throw new BadRequestException('Ticket order is invalid');
          }
          // check if the ticket is in the time frame for sale
          let shouldSell = true;
          if (
            (ticketType.visibility === 'CUSTOM_SCHEDULE' ||
              ticketType.visibility === 'HIDDEN_WHEN_NOT_ON_SALE') &&
            !isTicketTypeVisible(ticketType.startDate, ticketType.endDate)
          ) {
            shouldSell = false;
          }
          if (!shouldSell) {
            throw new InternalServerErrorException(
              'Ticket is not yet for sale',
            );
          }
          // validate the min and max quantity for order
          if (
            ticketType.minQty &&
            quantity < ticketType.minQty
          ) {
            throw new InternalServerErrorException(
              `Please select a minimum of ${ticketType.minQty} tickets`,
            );
          }
          if (
            ticketType.maxQty &&
            quantity > ticketType.maxQty
          ) {
            throw new InternalServerErrorException(
              `Please select a maximum of ${ticketType.maxQty} tickets`,
            );
          }
          // get the number of tickets for a tickettype of this event that has already been successfully paid for
          const soldQuantity = await prisma.ticket.count({
            where: {
              ticketTypeId,
              order: {
                eventId: dto.eventId,
                OR: [
                  { paymentStatus: 'SUCCESSFUL' },
                  {
                    paymentStatus: 'PENDING',
                    createdAt: { gte: dateFns.subMinutes(new Date(), 30) },
                  },
                ],
              },
            },
          });
          const quantityAvailable = ticketType.quantity - soldQuantity;

          if (quantity > quantityAvailable) {
            throw new InternalServerErrorException(
              `Unable to place order, only ${quantityAvailable}
               slot(s) are available for ${ticketType.name} ticket type, please go back and edit your order`,
            );
          }
          // Serialize capacity checks for this ticket type. A concurrent
          // checkout modifies this same record, so MongoDB rejects one of the
          // conflicting transactions rather than overselling inventory.
          await prisma.ticketType.update({
            where: { id: ticketType.id },
            data: { updatedAt: new Date() },
          });
          for (let i = 0; i < quantity; i++) {
            allTicketOrders.push({
              ticketTypeId,
            });
          }
        }

        if (allTicketOrders.length < 1) {
          throw new BadRequestException(
            'At least one ticket must be placed for order',
          );
        }

        if (dto.addonOrders) {
          for (const addonOrder of dto.addonOrders) {
            if (addonOrder.quantity < 0) {
              throw new BadRequestException('Add-on quantities cannot be negative');
            }
            if (addonOrder.quantity === 0) continue;

            const addon = event.addons.find(
              ({ id }) => id === addonOrder.addonId,
            );
            if (!addon) {
              throw new BadRequestException('Add-on order is invalid');
            }
            const now = new Date();
            if (now < addon.startTime || now >= addon.endTime) {
              throw new BadRequestException(`${addon.name} is not currently for sale`);
            }
            if (
              addonOrder.quantity < addon.minimumQuantityPerOrder ||
              addonOrder.quantity > addon.maximumQuantityPerOrder
            ) {
              throw new BadRequestException(
                `${addon.name} quantity must be between ${addon.minimumQuantityPerOrder} and ${addon.maximumQuantityPerOrder}`,
              );
            }
            const reservedAddons = await prisma.addonOrder.findMany({
              where: {
                addonId: addon.id,
                order: {
                  OR: [
                    { paymentStatus: 'SUCCESSFUL' },
                    {
                      paymentStatus: 'PENDING',
                      createdAt: { gte: dateFns.subMinutes(now, 30) },
                    },
                  ],
                },
              },
              select: { quantity: true },
            });
            const quantityAvailable =
              addon.totalQuantity -
              reservedAddons.reduce((total, item) => total + item.quantity, 0);
            if (addonOrder.quantity > quantityAvailable) {
              throw new BadRequestException(
                `Only ${quantityAvailable} ${addon.name} add-on(s) remain`,
              );
            }
            await prisma.eventAddons.update({
              where: { id: addon.id },
              data: { updatedAt: now },
            });
            addonsOrders.push(addonOrder);
          }
        }
        try {
          const order = await prisma.order.create({
            data: {
              userId: user.id,
              eventId: dto.eventId,
              firstName: dto.firstName,
              lastName: dto.lastName,
              email: dto.email.toLowerCase(),
              phone: dto.phone,
              promocodeId: dto.promocodeId, // Todo validate promocode before adding it
              tickets: {
                create: allTicketOrders,
              },
              addonOrder: {
                create: addonsOrders,
              },
            },
            include: {
              tickets: {
                include: {
                  ticketType: true,
                },
              },
              addonOrder: {
                include: {
                  addon: true,
                },
              },
              event: true,
            },
          });

          if (newAccount) {
            await this.authService.sendCompleteSignupLink(
              dto.email.toLowerCase(),
            );
          }

          return { order, promocode };
        } catch (e) {
          console.log(e);
          throw new InternalServerErrorException('Unable to place order');
        }
      },
      {
        maxWait: 250000, // Maximum time (in milliseconds) to wait for the transaction to start
        timeout: 250000, // Maximum time (in milliseconds) for the transaction to complete
      },
    );
  }

  async getUserOrders(
    userId: User['id'],
    paginationQuery: UserOrderPaginationDto,
  ) {
    const { page: _page, limit: _limit, eventStatus } = paginationQuery;

    const { skip, take } = getPagination({ _page, _limit });
    const nowUTC = new Date();
    const userOrders = await this.prisma.order.findMany({
      where: {
        userId,
        AND: {
          event: {
            startTime:
              eventStatus === 'all'
                ? undefined
                : eventStatus === 'past'
                  ? {
                      lt: nowUTC,
                    }
                  : {
                      gt: nowUTC,
                    },
          },
        },
      },
      include: {
        event: true,
        tickets: {
          include: {
            ticketType: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take,
    });

    return userOrders;
  }

  async getUserUpcomingEventsOrders(
    userId: User['id'],
    paginationQuery: UserOrderPaginationDto,
  ) {
    const { page: _page, limit: _limit } = paginationQuery;
    const { skip, take } = getPagination({ _page, _limit });
    const nowUTC = new Date();

    const whereObject: Prisma.OrderWhereInput = {
      userId,
      AND: {
        event: {
          startTime: {
            gt: nowUTC,
          },
        },
        paymentStatus: 'SUCCESSFUL',
      },
    };

    const [userOrders, orderCount] = await Promise.all([
      this.prisma.order.findMany({
        where: { ...whereObject },
        include: {
          event: true,
          tickets: {
            include: {
              ticketType: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take,
      }),
      this.prisma.order.count({
        where: {
          ...whereObject,
        },
      }),
    ]);

    return { userOrders, orderCount };
  }

  async getUserPastEventsOrders(
    userId: User['id'],
    paginationQuery: UserOrderPaginationDto,
  ) {
    const { page: _page, limit: _limit } = paginationQuery;
    const { skip, take } = getPagination({ _page, _limit });
    const nowUTC = new Date();

    const whereObject: Prisma.OrderWhereInput = {
      userId,
      AND: {
        event: {
          startTime: {
            lt: nowUTC,
          },
        },
        paymentStatus: 'SUCCESSFUL',
      },
    };

    try {
      const [userOrders, orderCount] = await Promise.all([
        this.prisma.order.findMany({
          where: { ...whereObject },
          include: {
            event: true,
            tickets: {
              include: {
                ticketType: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take,
        }),
        this.prisma.order.count({
          where: {
            ...whereObject,
          },
        }),
      ]);

      return { userOrders, orderCount };
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(
        'Something went wrong while fetching past event orders',
      );
    }
  }

  async getOrder(
    orderId: string,
    requester: Pick<User, 'id' | 'role'>,
  ) {
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
      },
      include: {
        tickets: {
          include: {
            ticketType: true,
          },
        },
        event: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const canManageOrders = [UserRole.admin, UserRole.viewer].includes(
      requester.role,
    );
    if (!canManageOrders && order.userId !== requester.id) {
      throw new ForbiddenException('You cannot access this order');
    }

    order.event['eventStatus'] = getEventStatus(order.event.endTime);
    return order;
  }

  async getOrders(query: GetOrdersQuery) {
    const {
      page: _page,
      limit: _limit,
      eventStatus = 'all',
      endDate,
      startDate,
    } = query;
    const { skip, take } = getPagination({ _page, _limit });
    const nowUTC = new Date();
    const whereObject: Prisma.OrderWhereInput = {
      event: {
        startTime:
          eventStatus === 'past'
            ? {
                lt: nowUTC,
              }
            : eventStatus === 'upcoming'
              ? {
                  gt: nowUTC,
                }
              : undefined,
      },
      // if startdate or enddate is not provided, don't filter by createdAt
      createdAt: {
        gte: startDate ? dateFns.startOfDay(startDate) : undefined,
        lte: endDate ? dateFns.endOfDay(endDate) : undefined,
      },
    };
    try {
      const [orders, ordersCount] = await Promise.all([
        this.prisma.order.findMany({
          where: { ...whereObject },
          include: {
            tickets: {
              include: {
                ticketType: true,
              },
            },
            event: true,
            user: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          skip,
          take,
        }),
        this.prisma.order.count({
          where: {
            ...whereObject,
          },
        }),
      ]);

      // const extendedOrder = orders.map((order) => {
      //   const orderAmount = order.tickets.reduce((accValue, currTicket) => {
      //     return accValue + currTicket.ticketType.price;
      //   }, 0);
      //   return {
      //     ...order,
      //     orderAmount,
      //   };
      // }, 0);

      return { orders, ordersCount };
    } catch (e) {
      console.log(e);
      throw new HttpException(
        'Could not retrieve list of orders',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async generateOrderReport(query: GenerateOrderReportQueryDto) {
    try {
      const { orders } = await this.getOrders(query);

      // Format the data as a worksheet
      type GroupByTicketType = {
        [key in TicketType['name']]: {
          ticketTypeName: string;
          quantity: number;
        };
      };
      const worksheetData = orders.map((order) => {
        const groupedTickets: GroupByTicketType = order.tickets.reduce(
          (group, currTicket) => {
            if (group[currTicket.ticketType.name]) {
              group[currTicket.ticketType.name].quantity += 1;
            } else {
              group[currTicket.ticketType.name] = {
                ticketTypeName: currTicket.ticketType.name,
                quantity: 1,
              };
            }
            return group;
          },
          {} as GroupByTicketType,
        );
        const lastElementIndex = Object.values(groupedTickets).length - 1;
        const ticketOrderSummary = Object.values(groupedTickets).reduce(
          (summary, currGroup, index) => {
            return (
              summary +
              `${currGroup.quantity} ${currGroup.ticketTypeName} Ticket(s) ${index < lastElementIndex ? ', ' : ''}`
            );
          },
          '',
        );
        return {
          ID: order.id,
          'Order Date': order.createdAt.toDateString(),
          'Event Name': order.event.name,
          'Customer Name': `${order.firstName} ${order.lastName}`,
          Phone: order?.phone || 'N/A',
          Email: order?.email || 'N/A',
          'Ticket Order Summary': ticketOrderSummary,
          'Amount Spent': `${order.amountPaid?.toFixed(2)}`,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);

      // Step 2: Create a workbook and add the worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Order Report');

      // Step 3: Write the workbook to a buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return buffer;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Error generating order report');
    }
  }

  async generatePartyList(eventId: string) {
    console.log('----Generating party list----');
    try {
      const completedTickets = await this.prisma.ticket.findMany({
        where: {
          order: {
            eventId: eventId,
            paymentStatus: 'SUCCESSFUL',
            status: 'COMPLETED',
          },
        },
        include: {
          order: {
            include: {
              event: true,
            },
          },
        },
      });

      const event = completedTickets[0].order.event;

      const worksheetData = completedTickets.map((ticket, index) => {
        return {
          'S/N': index + 1,
          ID: ticket.id,
          'Order Date': ticket.createdAt.toDateString(),
          'Event Name': ticket.order.event.name,
          'Full Name': `${ticket.firstName} ${ticket.lastName}`,
          Phone: ticket?.phone || 'N/A',
          Email: ticket?.email || 'N/A',
          Gender: ticket.gender,
          'Checkin Code': `${ticket.checkinCode}`,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(worksheetData);

      // Step 2: Create a workbook and add the worksheet
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(
        workbook,
        worksheet,
        `${event.name.substring(0, 20)}-Party List`, // limit to 31 characters plus the suffix
      );

      // Step 3: Write the workbook to a buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return { buffer, event };
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Error generating party list');
    }
  }

  async fillTicketDetails(
    dto: FillTicketDetailsDto,
    requester: Pick<User, 'id' | 'role'>,
  ) {
    // before allowing filling ticket details, confirm that the order is paid for
    const order = await this.prisma.order.findFirst({
      where: {
        id: dto.orderId,
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    const canManageOrders = [UserRole.admin, UserRole.viewer].includes(
      requester.role,
    );
    if (!canManageOrders && order.userId !== requester.id) {
      throw new ForbiddenException('You cannot update this order');
    }
    if (order.paymentStatus !== 'SUCCESSFUL') {
      throw new InternalServerErrorException(
        'Payment for order has not been confirmed or completed',
      );
    }
    if (order.status === 'COMPLETED') {
      throw new InternalServerErrorException(
        'Ticket details has already been filled',
      );
    }
    try {
      // const checkinCodes: string[] = [];
      // Get checkin codes.. fail and return early if generating anyone fails
      // await Promise.all([
      //   dto.tickets.map(async () => {
      //     const checkinCode = await this.generateCheckinCode();
      //     if (checkinCode === false) {
      //       throw new InternalServerErrorException('Something went wrong');
      //     }
      //     return checkinCodes.push(checkinCode);
      //   }),
      // ]);

      const ticketIds = dto.tickets.map(({ ticketId }) => ticketId);
      if (new Set(ticketIds).size !== ticketIds.length) {
        throw new BadRequestException('Each ticket can only be submitted once');
      }

      await this.prisma.$transaction(async (prisma) => {
        const tickets = await prisma.ticket.findMany({
          where: { id: { in: ticketIds }, orderId: dto.orderId },
          select: { id: true },
        });
        const orderTicketCount = await prisma.ticket.count({
          where: { orderId: dto.orderId },
        });
        if (
          tickets.length !== ticketIds.length ||
          ticketIds.length !== orderTicketCount
        ) {
          throw new BadRequestException(
            'Submit details for every ticket in this order',
          );
        }

        const { count } = await prisma.order.updateMany({
          where: {
            id: dto.orderId,
            paymentStatus: 'SUCCESSFUL',
            status: 'PENDING',
          },
          data: { status: 'COMPLETED' },
        });
        if (count !== 1) {
          throw new BadRequestException('Ticket details have already been filled');
        }

        await Promise.all(
          dto.tickets.map(({ ticketId, ...details }) =>
            prisma.ticket.update({
              where: { id: ticketId },
              data: { ...details, checkinCode: nanoid() },
            }),
          ),
        );
      });

      return {
        message: 'Ticket details has been successfully filled',
        orderId: order.id,
      };
    } catch (e) {
      throw new InternalServerErrorException(
        'An error occurred while filling in ticket details',
      );
    }
  }

  async updateOrderPaymentStatus(
    orderId: string,
    status: Order['paymentStatus'],
    paymentId: string,
    amountPaid: number,
  ) {
    try {
      const order = await this.prisma.order.update({
        where: {
          id: orderId,
        },
        data: {
          paymentStatus: status,
          paymentId: paymentId,
          amountPaid: amountPaid,
        },
        include: {
          event: true,
          addonOrder: true,
          tickets: {
            include: {
              ticketType: true,
            },
          },
        },
      });
      return order;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(
        'Something went wrong while updating payment status',
      );
    }
  }

  /**
   * Atomically transition an order into its paid state. A Stripe webhook may be
   * delivered more than once, so only the request that performs this transition
   * should run post-payment work such as sending the confirmation email.
   */
  async markOrderPaymentSuccessful(
    orderId: string,
    paymentId: string,
    amountPaid: number,
  ): Promise<boolean> {
    try {
      const { count } = await this.prisma.order.updateMany({
        where: {
          id: orderId,
          paymentStatus: {
            not: 'SUCCESSFUL',
          },
        },
        data: {
          paymentStatus: 'SUCCESSFUL',
          paymentId,
          amountPaid,
        },
      });

      return count === 1;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(
        'Something went wrong while confirming order payment',
      );
    }
  }

  async sendOrderConfirmedEmail(orderId: string): Promise<void> {
    try {
      // Fetch order with all necessary relations
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          event: true,
          tickets: {
            include: {
              ticketType: true,
            },
          },
          addonOrder: true,
        },
      });

      if (!order) {
        throw new NotFoundException('Order not found');
      }

      if (order.paymentStatus !== 'SUCCESSFUL') {
        console.warn(
          `Skipping order confirmation email for unpaid order ${order.id}`,
        );
        return;
      }

      // Calculate ticketGroup
      const ticketGroup: Record<
        string,
        {
          name: string;
          quantity: number;
          price: number;
        }
      > = order.tickets.reduce((group, ticket) => {
        if (group[ticket.ticketType.name]) {
          group[ticket.ticketType.name].quantity =
            group[ticket.ticketType.name].quantity + 1;
        } else {
          group[ticket.ticketType.name] = {
            name: ticket.ticketType.name,
            quantity: 1,
            price: ticket.ticketType.price,
          };
        }
        return group;
      }, {});

      // Format ticketLink
      const ticketLink = `${this.configService.get(FRONTEND_URL)}/tickets/${order.id}/fill-details`;

      // Send order confirmed email
      await this.emailService.sendOrderConfirmed(order.email, {
        order,
        ticketLink: ticketLink,
        eventDate: getTimeZoneDateRange(
          new Date(order.event.startTime || Date.now()),
          new Date(order.event.endTime || Date.now()),
        ),
        orderDate: dateFnsTz.format(
          dateFnsTz.toZonedTime(order.createdAt, newYorkTimeZone),
          'MMMM d, yyyy',
        ),
        ticketGroups: Object.values(ticketGroup),
        totalDiscountInDollars: order.totalDiscount,
        totalChargesInDollars: order.totalCharges,
      });
    } catch (error) {
      console.error('Error sending order confirmed email:', error);
      // Don't throw - email failure shouldn't break the payment flow
    }
  }

  async setSessionIdAndCharges({
    orderId,
    sessionId,
    totalChargesInDollars,
    totalDiscountInDollars,
  }: {
    orderId: string;
    sessionId: string;
    totalDiscountInDollars: number;
    totalChargesInDollars: number;
  }) {
    return await this.prisma.order.update({
      where: { id: orderId },
      data: {
        sessionId: sessionId,
        totalDiscount: totalDiscountInDollars,
        totalCharges: totalChargesInDollars,
      },
    });
  }

  async checkPaymentStatus(
    orderId: string,
    requester: Pick<User, 'id' | 'role'>,
  ) {
    const order = await this.getOrder(orderId, requester);
    if (order.paymentStatus === 'SUCCESSFUL') {
      return { paid: true, message: 'Order has already been paid for' };
    }
    if (!order.sessionId) {
      return { paid: false, message: 'Order has not been paid for' };
    }
    const paymentStatus = await this.stripeService.checkPaymentStatus(
      order.sessionId,
    );
    if (paymentStatus.paid === true) {
      const paymentWasJustConfirmed = await this.markOrderPaymentSuccessful(
          order.id,
          paymentStatus.paymendId,
          paymentStatus.amount,
        );
      if (paymentWasJustConfirmed) {
        await this.sendOrderConfirmedEmail(order.id);
      }
      return {
        paid: true,
        message: 'Order has already been paid for',
      };
    } else {
      return {
        paid: false,
        message: 'Order has not been paid for',
      };
    }
  }

  async getRevenue(query: GetRevenueQueryDto) {
    const orders1 = await this.prisma.order.findMany({
      where: {
        createdAt: {
          gte: query.startDate,
          lte: query.endDate,
        },
        paymentStatus: 'SUCCESSFUL',
      },
    });

    // revenue in the range
    const revenue1 = orders1.reduce((accValue, currOrder) => {
      return (accValue += currOrder.amountPaid);
    }, 0);

    // revenue of the same distance apart as the selected range i.e this week and last week, two weeks and last two weeks
    let upTrend = true;

    if (query.endDate && query.startDate) {
      const daysDiff = dateFns.differenceInDays(query.endDate, query.startDate);

      const startDate2 = dateFns.subDays(query.startDate, daysDiff || 1);
      const endDate2 = dateFns.subMonths(query.endDate, daysDiff || 1);

      const orders2 = await this.prisma.order.findMany({
        where: {
          createdAt: {
            gte: startDate2,
            lte: endDate2,
          },
          paymentStatus: 'SUCCESSFUL',
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const revenue2 = orders2.reduce((accValue, currOrder) => {
        return (accValue += currOrder.amountPaid);
      }, 0);

      upTrend = revenue1 > revenue2 ? true : false;
    }

    return { revenue: revenue1, upTrend };
  }

  async getTicketTypeSales(eventId: string) {
    try {
      const ticketTypeSales = await this.prisma.ticketType.findMany({
        where: {
          eventId: eventId,
        },
        include: {
          tickets: true,
          _count: {
            select: {
              tickets: {
                where: {
                  order: {
                    paymentStatus: 'SUCCESSFUL',
                  },
                },
              },
            },
          },
        },
      });

      return ticketTypeSales;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unable to get ticket type sales');
    }
  }

  async ticketsSoldStats(query: DateRangeQueryDto) {
    const orders1 = (await this.getOrders(query)).orders.filter(
      (order) => order.paymentStatus === 'SUCCESSFUL',
    );
    const ticketsSold1 =
      orders1?.reduce((accValue, order) => {
        return accValue + order.tickets.length;
      }, 0) || 0;

    let upTrend = true;
    if (query.endDate && query.startDate) {
      const daysDiff = dateFns.differenceInDays(query.endDate, query.startDate);

      const startDate2 = dateFns.subDays(query.startDate, daysDiff || 1);
      const endDate2 = dateFns.subMonths(query.endDate, daysDiff || 1);

      const orders2 = (
        await this.getOrders({
          endDate: endDate2,
          startDate: startDate2,
        })
      ).orders.filter((order) => order.paymentStatus === 'SUCCESSFUL');

      const ticketsSold2 =
        orders2?.reduce((accValue, order) => {
          return accValue + order.tickets.length;
        }, 0) || 0;

      upTrend = ticketsSold1 > ticketsSold2 ? true : false;
    }

    return {
      ticketsSold: ticketsSold1,
      upTrend,
    };
  }

  // async generateCheckinCode(count: number = 0): Promise<string | false> {
  //   const checkinCode = nanoid();
  //   const MAX_CHECKIN_CODE_ITERATION = 100;
  //   try {
  //     const ticket = await this.prisma.ticket.findFirst({
  //       where: {
  //         checkinCode,
  //       },
  //     });
  //     if (!ticket) {
  //       return checkinCode;
  //     } else {
  //       // if it has tried generating checkinCode for up to 100 times, throw an error;
  //       if (count > MAX_CHECKIN_CODE_ITERATION) {
  //         throw new Error(
  //           `Max number of iterations (${MAX_CHECKIN_CODE_ITERATION}) has been met`,
  //         );
  //       }
  //       return await this.generateCheckinCode(count + 1);
  //     }
  //   } catch (e) {
  //     console.log(e);
  //     return false;
  //   }
  // }
}
