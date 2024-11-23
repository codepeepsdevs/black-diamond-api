// import { Controller } from '@nestjs/common';

// @Controller('stripe')
// export class StripeController {}

import { Controller, Post, RawBodyRequest, Req } from '@nestjs/common';

import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from 'src/orders/orders.service';
import { EmailsService } from 'src/emails/emails.service';
import { FRONTEND_URL } from 'src/constants';
import {
  getTimeZoneDateRange,
  newYorkTimeZone,
} from 'src/utils/date-formatter';
import * as dateFnsTz from 'date-fns-tz';

@Controller('stripe')
export class StripeController {
  constructor(
    private stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly orderService: OrdersService,
    private readonly emailService: EmailsService,
  ) {}

  // @HttpCode(HttpStatus.OK)
  // @Post('create-payment-intent')
  // checkout(@Body() dto: CreateOrderDto) {
  //   return this.stripeService.checkout(dto);
  // }

  // @Post('checkout')
  // async createCheckoutSession(
  //   @Body() body: CreateOrderDto,
  //   @Res() res: Response,
  //   @Req() req: Request,
  // ) {
  //   const authHeader = req.headers['authorization'] as string;
  //   let token = '';
  //   if (authHeader) {
  //     token = authHeader.split(' ')[1];
  //   }
  //   const successUrl =
  //     body.successUrl ?? this.configService.get<string>(SUCCESS_URL);
  //   const cancelUrl =
  //     body.cancelUrl ?? this.configService.get<string>(CANCEL_URL);

  //   const session = await this.stripeService.createCheckoutSession(
  //     body,
  //     successUrl,
  //     cancelUrl,
  //   );

  //   const order = await this.orderService.createOrder(body, token, session.id);
  //   return { ...order, sessionId: session.id };
  // }

  @Post('webhook')
  async handleWebhook(@Req() request: RawBodyRequest<Request>) {
    const signature = request.headers['stripe-signature'];
    const event = this.stripeService.constructEvent(request.rawBody, signature);

    if (event.type === 'payment_intent.succeeded') {
      console.log('----------webhook called------------');
      const paymentIntent = event.data.object;
      const orderId = event.data.object.metadata.orderId;

      // update payment status of order
      const order = await this.orderService.updateOrderPaymentStatus(
        orderId,
        'SUCCESSFUL',
        paymentIntent.id,
        paymentIntent.amount_received / 100, // convert from cent to dollarss
      );

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

      const ticketLink = `${this.configService.get(FRONTEND_URL)}/tickets/${order.id}/fill-details`; // should automatically redirect if the user has filled it before.
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
      });
    }

    return { received: true };
  }
}
