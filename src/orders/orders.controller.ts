import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import {
  CreateOrderDto,
  // AssignGuestOrderDto,
  FillTicketDetailsDto,
  GetOrdersQuery,
  GetRevenueQueryDto,
  UserOrderPaginationDto,
} from './dto/orders.dto';
import { Roles } from 'src/auth/guards/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import JwtAuthenticationGuard from 'src/auth/guards/jwt-authentication.guard';
// import { PaginationQueryDto } from 'src/shared/dto/pagination-query.dto';
import RequestWithUser from 'src/auth/types/requestWithUser.interface';
import { UserRole } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CANCEL_URL, FRONTEND_URL, SUCCESS_URL } from 'src/constants';
import { StripeService } from 'src/stripe/stripe.service';
import { Response } from 'express';
import {} from 'src/events/dto/events.dto';
import { DateRangeQueryDto } from 'src/shared/dto/date-range-query.dto';
import { EmailsService } from 'src/emails/emails.service';
import { getPDTDate } from 'src/utils/date-formatter';
import * as dateFns from 'date-fns';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    private readonly emailService: EmailsService,
  ) {}

  // @Post('create')
  // async createOrder(@Body() dto: CreateOrderDto, @Req() req: Request) {
  //   const authHeader = req.headers['authorization'];
  //   let token = '';
  //   if (authHeader) {
  //     token = authHeader.split(' ')[1];
  //   }

  //   return this.ordersService.createOrder(dto, token);
  // }

  @Post('create')
  async checkout(
    @Body() body: CreateOrderDto,
    @Res() res: Response,
    @Req() req: Request,
  ) {
    const authHeader = req.headers['authorization'] as string;
    let token = '';
    if (authHeader) {
      token = authHeader.split(' ')[1];
    }
    const successUrl =
      body.successUrl ?? this.configService.get<string>(SUCCESS_URL);
    const cancelUrl =
      body.cancelUrl ?? this.configService.get<string>(CANCEL_URL);

    const order = await this.ordersService.createOrder(body, token);
    const { session, allLineItems } =
      await this.stripeService.createCheckoutSession(
        body,
        successUrl,
        cancelUrl,
        order.id,
      );
    await this.ordersService.setSessionId(order.id, session.id);

    // After successful order placement, send order received email
    const ticketLink = `${this.configService.get(FRONTEND_URL)}/tickets/`; // just take them to tickets page.
    const totalAmount = allLineItems.reduce((accValue, currItem) => {
      console.log(accValue, currItem);
      return accValue + Number(currItem.price_data.unit_amount);
    }, 0);

    // order.tickets.forEach((ticket) => {
    //   totalAmount += ticket.ticketType.price;
    // });
    // order.addonOrder.forEach((addonsOrder) => {
    //   totalAmount += addonsOrder.addon.price;
    // });

    await this.emailService.sendOrderReceived(order.email, {
      amountToPay: totalAmount / 100, // total amount is in cents, divide by 100 to convert to dollar
      order,
      ticketLink: ticketLink,
      eventDate: getPDTDate(
        new Date(order.event.startTime || Date.now()),
        new Date(order.event.endTime || Date.now()),
      ),
      orderDate: dateFns.format(
        new Date(order.createdAt || Date.now()),
        'MMMM d, yyyy',
      ),
    });
    res
      .status(200)
      .json({ ...order, sessionId: session.id, sessionUrl: session.url });
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles()
  @Post('fill-ticket-details')
  async fillTicketDetails(
    @Body() dto: FillTicketDetailsDto,
    // @Req() req: RequestWithUser,
  ) {
    // const userId = req.user.id;

    return this.ordersService.fillTicketDetails(dto);
  }

  @Get('get-order/:orderId')
  async getOrder(@Param('orderId') orderId: string) {
    return this.ordersService.getOrder(orderId);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles()
  @Get('user-orders')
  async getUserOrders(
    @Query() paginationQuery: UserOrderPaginationDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    return this.ordersService.getUserOrders(userId, paginationQuery);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles()
  @Get('user-upcoming-events-orders')
  async getUserUpcomingEventsOrders(
    @Query() paginationQuery: UserOrderPaginationDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    return this.ordersService.getUserUpcomingEventsOrders(
      userId,
      paginationQuery,
    );
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles()
  @Get('user-past-events-orders')
  async getUserPastEventsOrders(
    @Query() paginationQuery: UserOrderPaginationDto,
    @Req() req: RequestWithUser,
  ) {
    const userId = req.user.id;
    return this.ordersService.getUserPastEventsOrders(userId, paginationQuery);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Get('get-orders')
  async getOrders(@Query() query: GetOrdersQuery) {
    return this.ordersService.getOrders(query);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles()
  @Get('check-payment-status/:orderId')
  async checkPaymentStatus(@Param('orderId') orderId: string) {
    return this.ordersService.checkPaymentStatus(orderId);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Get('get-revenue')
  async getRevenue(@Query() query: GetRevenueQueryDto) {
    return this.ordersService.getRevenue(query);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Get('ticket-type-sales/:eventId')
  async getTicketTypeSales(@Param('eventId') eventId: string) {
    return this.ordersService.getTicketTypeSales(eventId);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles(UserRole.admin)
  @Get('tickets-sold-stats')
  async ticketsSoldStats(@Query() query: DateRangeQueryDto) {
    return this.ordersService.ticketsSoldStats(query);
  }
}
