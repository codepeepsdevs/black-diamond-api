// import { Controller } from '@nestjs/common';

// @Controller('stripe')
// export class StripeController {}

import { Controller, Post, RawBodyRequest, Req } from '@nestjs/common';

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

    if (event.type === 'payment_intent.succeeded') {
      console.log('----------webhook called------------');
      const paymentIntent = event.data.object;
      const orderId = event.data.object.metadata.orderId;

      // update payment status of order
      await this.orderService.updateOrderPaymentStatus(
        orderId,
        'SUCCESSFUL',
        paymentIntent.id,
        paymentIntent.amount_received / 100, // convert from cent to dollarss
      );

      // Send order confirmed email
      await this.orderService.sendOrderConfirmedEmail(orderId);
    }

    return { received: true };
  }
}
