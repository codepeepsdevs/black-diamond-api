import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  CreateOrderDto,
  FillTicketDetailsDto,
  GenerateOrderReportQueryDto,
  GetOrdersQuery,
  GetRevenueQueryDto,
  GeneratePartyListDto,
  UserOrderPaginationDto,
} from './dto/orders.dto';
// import { PaginationQueryDto } from 'src/shared/dto/pagination-query.dto';
import { Order, Prisma, TicketType, User } from '@prisma/client';
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
  getCurrentNewYorkDateTimeInUTC,
  getEventStatus,
} from 'src/utils/date-formatter';
import { EventsService } from 'src/events/events.service';
import * as XLSX from 'xlsx';
import { AuthenticationService } from 'src/auth/services/auth.service';
import { NewsletterService } from 'src/newsletter/newsletter.service';

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

    this.newsletterService
      .subscribe({
        email: dto.email,
      })
      .then(() => {
        console.log('Successfully subscribed to newletter');
      })
      .catch((e) => console.log(e));

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
          } catch (e) {
            throw new UnauthorizedException(
              'The user session has expired, please login to place your order',
            );
          }

          if (!user) {
            throw new NotFoundException('User not found');
          }
        } else {
          const userExists = await this.userService.findOneByEmail(dto.email);

          if (userExists) {
            user = userExists;
            newAccount = false;
          } else {
            newAccount = true;
            const hashedPassword = await bcrypt.hash('DEFAULT_PASSWORD', 10);
            try {
              user = await prisma.user.create({
                data: {
                  email: dto.email,
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

        const allTicketOrders: { ticketTypeId: string }[] = [];
        const addonsOrders: { addonId: string; quantity: number }[] = [];

        // dto.ticketOrders.forEach(async (ticketTypeOrder) => {
        // using for in loop because throwing error in a callback in javascript for rolling back the transaction occurs in another context
        for (const ticketTypeOrder of dto.ticketOrders) {
          const { quantity: totalQuantity, name: ticketName } =
            event.ticketTypes.find(
              (ticketType) => ticketType.id === ticketTypeOrder.ticketTypeId,
            );
          // get the number of tickets for a tickettype of this event that has already been successfully paid for
          const soldQuantity = await this.prisma.ticket.count({
            where: {
              ticketTypeId: ticketTypeOrder.ticketTypeId,
              order: {
                paymentStatus: 'SUCCESSFUL',
                eventId: dto.eventId,
              },
            },
          });
          const quantityAvailable = totalQuantity - soldQuantity;
          if (ticketTypeOrder.quantity > quantityAvailable) {
            throw new InternalServerErrorException(
              `Unable to place order, only ${quantityAvailable} slot(s) are available for ${ticketName} ticket type, please go back and edit your order`,
            );
          }
          for (let i = 0; i < ticketTypeOrder.quantity; i++) {
            allTicketOrders.push({
              ticketTypeId: ticketTypeOrder.ticketTypeId,
            });
          }
        }
        // });

        if (allTicketOrders.length < 1) {
          throw new BadRequestException(
            'At least one ticket must be placed for order',
          );
        }

        if (dto.addonOrders) {
          dto.addonOrders.forEach((addonOrder) => {
            if (addonOrder.quantity > 0) {
              addonsOrders.push(addonOrder);
            }
          });
        }
        try {
          const order = await prisma.order.create({
            data: {
              userId: user.id,
              eventId: dto.eventId,
              firstName: dto.firstName,
              lastName: dto.lastName,
              email: dto.email,
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
            await this.authService.sendCompleteSignupLink(dto.email);
          }

          return order;
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
    const nowInNewYorkUTC = getCurrentNewYorkDateTimeInUTC();
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
                      lt: nowInNewYorkUTC,
                    }
                  : {
                      gt: nowInNewYorkUTC,
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
    const nowInNewYorkUTC = getCurrentNewYorkDateTimeInUTC();

    const whereObject: Prisma.OrderWhereInput = {
      userId,
      AND: {
        event: {
          startTime: {
            gt: nowInNewYorkUTC,
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
    const nowInNewYorkUTC = getCurrentNewYorkDateTimeInUTC();

    const whereObject: Prisma.OrderWhereInput = {
      userId,
      AND: {
        event: {
          startTime: {
            lt: nowInNewYorkUTC,
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

  async getOrder(orderId: string) {
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

    order.event['eventStatus'] = getEventStatus(order.event.startTime);
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
    const nowInNewYorkUTC = getCurrentNewYorkDateTimeInUTC();
    const whereObject: Prisma.OrderWhereInput = {
      event: {
        startTime:
          eventStatus === 'past'
            ? {
                lt: nowInNewYorkUTC,
              }
            : eventStatus === 'upcoming'
              ? {
                  gt: nowInNewYorkUTC,
                }
              : undefined,
      },
      createdAt: {
        gte: dateFns.startOfDay(startDate),
        lte: dateFns.endOfDay(endDate),
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

      const extendedOrder = orders.map((order) => {
        const orderAmount = order.tickets.reduce((accValue, currTicket) => {
          return accValue + currTicket.ticketType.price;
        }, 0);
        return {
          ...order,
          orderAmount,
        };
      }, 0);

      return { orders: extendedOrder, ordersCount };
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
          'Amount Spent': `$${order.amountPaid.toFixed(2)}`,
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

  async generatePartyList(dto: GeneratePartyListDto) {
    console.log('----Generating party list----');
    try {
      const completedTickets = await this.prisma.ticket.findMany({
        where: {
          order: {
            eventId: dto.eventId,
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
        `${event.name}-Party List`,
      );

      // Step 3: Write the workbook to a buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      return { buffer, event };
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Error generating party list');
    }
  }

  async fillTicketDetails(dto: FillTicketDetailsDto) {
    // before allowing filling ticket details, confirm that the order is paid for
    const order = await this.prisma.order.findFirst({
      where: {
        id: dto.orderId,
      },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
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

      await Promise.all([
        ...dto.tickets.map((_, index) => {
          const { ticketId, ...details } = dto.tickets[index];
          return this.prisma.ticket.update({
            where: {
              id: ticketId,
            },
            data: { ...details, checkinCode: nanoid() }, // Select from one of them using the index
          });
        }),
      ]);

      await this.prisma.order.update({
        where: {
          id: dto.orderId,
        },
        data: {
          status: 'COMPLETED', /// set the order status to completed after they have filled it
        },
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

  async setSessionId(orderId: string, sessionId: string) {
    return await this.prisma.order.update({
      where: { id: orderId },
      data: {
        sessionId: sessionId,
      },
    });
  }

  async checkPaymentStatus(orderId: string) {
    const order = await this.getOrder(orderId);
    const paymentStatus = await this.stripeService.checkPaymentStatus(
      order.sessionId,
    );
    if (paymentStatus.paid === true) {
      if (order.paymentStatus !== 'SUCCESSFUL') {
        this.updateOrderPaymentStatus(
          order.id,
          'SUCCESSFUL',
          paymentStatus.paymendId,
          paymentStatus.amount,
        );
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
