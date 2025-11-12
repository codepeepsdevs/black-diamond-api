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
  GenerateOrderReportQueryDto,
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
import { getTimeZoneDateRange, newYorkTimeZone } from 'src/utils/helpers';
import * as dateFnsTz from 'date-fns-tz';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly stripeService: StripeService,
    private readonly emailService: EmailsService,
  ) {}

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
    const { order, promocode } = await this.ordersService.createOrder(
      body,
      token,
    );
    const successUrl = body.successUrl
      ? `${body.successUrl}/${order.id}/fill-details`
      : `${this.configService.get<string>(SUCCESS_URL)}/${order.id}/fill-details`;
    const cancelUrl =
      body.cancelUrl ?? this.configService.get<string>(CANCEL_URL);

    const {
      session,
      totalAmount,
      bypassStripe,
      totalChargesInDollars,
      totalDiscountInDollars,
    } = await this.stripeService.createCheckoutSession(
      body,
      successUrl,
      cancelUrl,
      order.id,
      promocode,
    );
    if (!bypassStripe) {
      await this.ordersService.setSessionIdAndCharges({
        orderId: order.id,
        sessionId: session.id,
        totalChargesInDollars,
        totalDiscountInDollars,
      });
    } else {
      // update payment status of order
      await this.ordersService.updateOrderPaymentStatus(
        order.id,
        'SUCCESSFUL',
        null,
        null, // convert from cent to dollarss
      );
    }
    // After successful order placement, send order received email
    const ticketLink = `${this.configService.get(FRONTEND_URL)}/tickets/`; // just take them to tickets page.

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
    await this.emailService.sendOrderReceived(order.email, {
      amountToPay: bypassStripe ? 0 : totalAmount / 100 + totalChargesInDollars, // total amount is in cents, divide by 100 to convert to dollar
      order,
      ticketLink: ticketLink,
      eventDate: getTimeZoneDateRange(
        new Date(order.event.startTime || Date.now()),
        new Date(order.event.endTime || Date.now()),
      ),
      orderDate: dateFnsTz.format(
        dateFnsTz.toZonedTime(order.createdAt, newYorkTimeZone),
        'MMMM d, yyyy',
        {
          timeZone: newYorkTimeZone,
        },
      ),
      ticketGroups: Object.values(ticketGroup),
      totalChargesInDollars: bypassStripe ? 0 : totalChargesInDollars,
      totalDiscountInDollars,
    });
    if (bypassStripe) {
      return res
        .status(200)
        .json({ ...order, sessionId: null, sessionUrl: null });
    }
    return res
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
  @Get('generate-order-report')
  async generateOrderReport(
    @Res() res: Response,
    @Query() query: GenerateOrderReportQueryDto,
  ) {
    const buffer = await this.ordersService.generateOrderReport(query);

    // Step 4: Send the buffer as a downloadable file
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Order_Report_${query.startDate || ''}-${query.endDate || ''}.xlsx"`,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.send(buffer);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles()
  @Get('generate-party-list/:eventId')
  async generatePartyList(
    @Res() res: Response,
    @Param('eventId') eventId: string,
  ) {
    const { buffer, event } =
      await this.ordersService.generatePartyList(eventId);

    // Step 4: Send the buffer as a downloadable file
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${event.name}-Party List.xlsx"`,
    );
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.send(buffer);
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
  @Roles(UserRole.admin, UserRole.viewer)
  // @UsePipes(new ValidationPipe({ transform: true }))
  @Get('get-orders')
  async getOrders(@Query() query: GetOrdersQuery) {
    console.log('query', query);
    return this.ordersService.getOrders(query);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles()
  @Get('check-payment-status/:orderId')
  async checkPaymentStatus(@Param('orderId') orderId: string) {
    return this.ordersService.checkPaymentStatus(orderId);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.viewer)
  @Get('get-revenue')
  async getRevenue(@Query() query: GetRevenueQueryDto) {
    return this.ordersService.getRevenue(query);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.viewer)
  @Get('ticket-type-sales/:eventId')
  async getTicketTypeSales(@Param('eventId') eventId: string) {
    return this.ordersService.getTicketTypeSales(eventId);
  }

  @UseGuards(JwtAuthenticationGuard, RolesGuard)
  @Roles(UserRole.admin, UserRole.viewer)
  @Get('tickets-sold-stats')
  async ticketsSoldStats(@Query() query: DateRangeQueryDto) {
    return this.ordersService.ticketsSoldStats(query);
  }
}
