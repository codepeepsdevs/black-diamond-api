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
  GetOrdersQuery,
  GetRevenueQueryDto,
  UserOrderPaginationDto,
} from './dto/orders.dto';
import { PaginationQueryDto } from 'src/shared/dto/pagination-query.dto';
import { Order, User } from '@prisma/client';
import { StripeService } from 'src/stripe/stripe.service';
import { EmailsService } from 'src/emails/emails.service';
import { ConfigService } from '@nestjs/config';
import {
  FRONTEND_URL,
  JWT_ACCESS_TOKEN_SECRET,
  JWT_EMAIL_SECRET,
} from 'src/constants';
import { JwtService } from '@nestjs/jwt';
import { TokenPayload } from 'src/auth/types/tokenPayload.interface';
import { UsersService } from 'src/users/users.service';
import * as bcrypt from 'bcryptjs';
import * as dateFns from 'date-fns';
import { getPagination } from 'src/utils/get-pagination';
import { DateRangeQueryDto } from 'src/shared/dto/date-range-query.dto';
import { customAlphabet } from 'nanoid';

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
  ) {}

  // async createOrder(userId: string, dto: CreateOrderDto) {
  //   const { orderItems } = dto;

  //   const orderItemsData = await Promise.all(
  //     orderItems.map(async (item) => {
  //       const ticketType = await this.prisma.ticketType.findUnique({
  //         where: { id: item.ticketTypeId },
  //       });

  //       return {
  //         ticketTypeId: item.ticketTypeId,
  //         quantity: item.quantity,
  //         unitPrice: ticketType.price,
  //         totalPrice: ticketType.price * item.quantity,
  //       };
  //     }),
  //   );

  //   const totalAmount = orderItemsData.reduce((sum, item) => {
  //     return sum + item.totalPrice;
  //   }, 0);

  //   const order = await this.prisma.order.create({
  //     data: {
  //       userId,
  //       orderItems: {
  //         create: orderItemsData,
  //       },
  //       totalAmount,
  //     },
  //     include: { orderItems: true },
  //   });

  //   return order;
  // }

  async createOrder(dto: CreateOrderDto, token: string | undefined) {
    let user: User | null = null;
    let newAccount = false;
    return await this.prisma.$transaction(
      async (prisma) => {
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
                'Error occurred while creating user',
                HttpStatus.INTERNAL_SERVER_ERROR,
              );
            }
          }
        }

        const allTicketOrders: { ticketTypeId: string }[] = [];
        const addonsOrders: { addonId: string; quantity: number }[] = [];

        // TODO: Handle ticket max sales
        dto.ticketOrders.forEach((ticket) => {
          for (let i = 0; i < ticket.quantity; i++) {
            allTicketOrders.push({
              ticketTypeId: ticket.ticketTypeId,
            });
          }
        });

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

          // After placing the order, create the payment intent
          // const { clientSecret } = await this.stripeService.checkout(dto);
          // const newOrder = await this.getOrder(order.id);

          // TODO: Send email for the user to complete account creation
          if (newAccount) {
            const emailToken = await this.jwtService.signAsync(
              {
                email: dto.email,
              },
              {
                secret: this.configService.get(JWT_EMAIL_SECRET),
              },
            );
            const completeSignupLink = `${this.configService.get(FRONTEND_URL)}/complete-signup?token=${emailToken}`;
            await this.emailService.sendCompleteSignup(
              dto.email,
              completeSignupLink,
            );
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

  // async createGuestOrder(dto: CreateOrderDto) {
  //   const allTicketOrders: { ticketTypeId: string }[] = [];
  //   const addonsOrders: { addonId: string; quantity: number }[] = [];

  //   // TODO: Handle ticket max sales
  //   dto.ticketOrders.forEach((ticket) => {
  //     for (let i = 0; i < ticket.quantity; i++) {
  //       allTicketOrders.push({
  //         ticketTypeId: ticket.ticketTypeId,
  //       });
  //     }
  //   });

  //   if (allTicketOrders.length < 1) {
  //     throw new BadRequestException(
  //       'At least one ticket must be placed for order',
  //     );
  //   }

  //   if (dto.addonOrders) {
  //     dto.addonOrders.forEach((addonOrder) => {
  //       if (addonOrder.quantity > 0) {
  //         addonsOrders.push(addonOrder);
  //       }
  //     });
  //   }

  //   const order = await this.prisma.order.create({
  //     data: {
  //       contactEmail: dto.contactEmail,
  //       contactName: dto.contactName,
  //       contactPhone: dto.contactPhone,
  //       eventId: dto.eventId,
  //       tickets: {
  //         create: allTicketOrders,
  //       },
  //       addonOrder: {
  //         create: addonsOrders,
  //       },
  //     },
  //     include: {
  //       tickets: true,
  //       addonOrder: true,
  //     },
  //   });

  //   const emailData = {
  //     contactName: order.contactName,
  //     orderUrl: `${this.configService.get(FRONTEND_URL)}/signup?type=claim-order&orderId=${order.id}`, // Link to the tickets page
  //     eventName: 'Best Sunny Day Party',
  //     eventImageUrl: 'https://example.com/event-image.jpg', // URL for the event image
  //     ticketCount: order.tickets.length, // Number of tickets
  //     eventDate: 'March 16 - 8pm - March 17 - 12am EDT', // TODO: Event date and time
  //     orderId: order.id, // Order ID
  //     orderDate: order.createdAt.toLocaleDateString(), // Date when the order was made
  //     ticketDetails: [
  //       { quantity: 1, type: 'Diamond', price: 37.85 },
  //       { quantity: 1, type: 'General', price: 10.0 },
  //     ], // List of ticket types and their prices
  //     totalPrice: 47.85, // Total price of the order
  //   };

  //   // Send email to the contact details
  //   try {
  //     this.emailService.sendDynamic(
  //       order.contactEmail,
  //       emailData,
  //       'purchase/claim-order.ejs',
  //       'Login/Signup to claim your order',
  //     );
  //   } catch (e) {
  //     console.log('Error sending email.');
  //   }

  //   // After placing the order, create the payment intent
  //   const { clientSecret } = await this.stripeService.checkout(dto);
  //   const newOrder = await this.getOrder(order.id);

  //   return {
  //     message: 'Order placed successfully',
  //     data: newOrder,
  //     clientSecret,
  //   };
  // }

  // async assignGuestOrder(dto: AssignGuestOrderDto, userId: string) {
  //   await this.getOrder(dto.orderId); // would throw if the order is not found

  //   try {
  //     this.prisma.order.update({
  //       where: {
  //         id: dto.orderId,
  //       },
  //       data: {
  //         userId,
  //       },
  //     });

  //     return { message: 'Order assigned successfully' };
  //   } catch (e) {
  //     console.log(e);
  //     throw new InternalServerErrorException(
  //       'An error occurred while assigning the order',
  //     );
  //   }
  // }

  async getUserOrders(
    userId: User['id'],
    paginationQuery: UserOrderPaginationDto,
  ) {
    const { page: _page, limit: _limit, eventStatus } = paginationQuery;

    const { skip, take } = getPagination({ _page, _limit });
    const userOrders = await this.prisma.order.findMany({
      where: {
        userId,
        AND: {
          event: {
            eventStatus:
              eventStatus === 'all'
                ? undefined
                : eventStatus === 'past'
                  ? 'PAST'
                  : 'UPCOMING',
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
    paginationQuery: PaginationQueryDto,
  ) {
    const { page: _page, limit: _limit } = paginationQuery;
    const { skip, take } = getPagination({ _page, _limit });
    const userOrders = await this.prisma.order.findMany({
      where: {
        userId,
        AND: {
          event: {
            eventStatus: 'UPCOMING',
          },
          paymentStatus: 'SUCCESSFUL',
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

  async getUserPastEventsOrders(
    userId: User['id'],
    paginationQuery: PaginationQueryDto,
  ) {
    const { page: _page, limit: _limit } = paginationQuery;
    const { skip, take } = getPagination({ _page, _limit });
    try {
      const userOrders = await this.prisma.order.findMany({
        where: {
          userId,
          AND: {
            event: {
              eventStatus: 'PAST',
            },
            paymentStatus: 'SUCCESSFUL',
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
    try {
      const orders = await this.prisma.order.findMany({
        where: {
          event: {
            eventStatus:
              eventStatus === 'past'
                ? 'PAST'
                : eventStatus === 'upcoming'
                  ? 'UPCOMING'
                  : undefined,
          },
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
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
      });

      const extendedOrder = orders.map((order) => {
        const orderAmount = order.tickets.reduce((accValue, currTicket) => {
          return accValue + currTicket.ticketType.price;
        }, 0);
        return {
          ...order,
          orderAmount,
        };
      }, 0);

      return extendedOrder;
    } catch (e) {
      console.log(e);
      throw new HttpException(
        'Could not retrieve list of orders',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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
        success: true,
        message: 'Ticket details has been successfully filled',
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
              tickets: true,
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
    const orders1 = await this.getOrders(query);
    const ticketsSold1 =
      orders1?.reduce((accValue, order) => {
        return accValue + order.tickets.length;
      }, 0) || 0;

    let upTrend = true;
    if (query.endDate && query.startDate) {
      const daysDiff = dateFns.differenceInDays(query.endDate, query.startDate);

      const startDate2 = dateFns.subDays(query.startDate, daysDiff || 1);
      const endDate2 = dateFns.subMonths(query.endDate, daysDiff || 1);

      const orders2 = await this.getOrders({
        endDate: endDate2,
        startDate: startDate2,
      });

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
