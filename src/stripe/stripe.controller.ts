// import { Controller } from '@nestjs/common';

// @Controller('stripe')
// export class StripeController {}

import { Controller, Post, RawBodyRequest, Req } from '@nestjs/common';
import Stripe from 'stripe';

import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from 'src/orders/orders.service';

@Controller('stripe')
export class StripeController {
  constructor(
    private stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly orderService: OrdersService,
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

    if (event.type === 'checkout.session.completed') {
      const checkoutSession = event.data.object as Stripe.Checkout.Session;
      const payment = await this.stripeService.getPaidCheckoutSession(
        checkoutSession.id,
      );

      if (!payment) {
        console.warn(
          `Ignoring unpaid or invalid Checkout Session webhook ${event.id}`,
        );
        return { received: true };
      }

      const paymentWasJustConfirmed =
        await this.orderService.confirmCheckoutSessionPayment(
          payment,
        );

      if (paymentWasJustConfirmed) {
        // Send the confirmation only for the first successful payment transition.
        await this.orderService.sendOrderConfirmedEmail(payment.orderId);
      } else {
        console.log(`Ignoring duplicate payment webhook ${event.id}`);
      }
    }

    return { received: true };
  }
}
