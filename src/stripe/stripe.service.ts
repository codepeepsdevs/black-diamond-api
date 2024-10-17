import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from 'src/constants';
import { EventsService } from 'src/events/events.service';
import { CreateOrderDto } from 'src/orders/dto/orders.dto';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private stripe: Stripe;

  constructor(
    private readonly eventService: EventsService,
    private readonly configService: ConfigService,
  ) {
    this.stripe = new Stripe(configService.get(STRIPE_SECRET_KEY), {
      apiVersion: '2024-06-20',
    });
  }

  // async checkout(order: CreateOrderDto) {
  //   try {
  //     const event = await this.eventService.getEvent(order.eventId);
  //     const ticketOrders = order.ticketOrders.map((ticketOrder) => {
  //       // get the details of each ticket order from the event tickets
  //       const ticketType = event.ticketTypes.find(
  //         (ticketType) => ticketType.id === ticketOrder.ticketTypeId,
  //       );
  //       if (!ticketType) {
  //         throw new InternalServerErrorException('Ticket order is invalid');
  //       }
  //       return {
  //         ticketTypeId: ticketType.id,
  //         totalPrice: ticketType.price,
  //         quantity: ticketOrder.quantity,
  //       };
  //     });
  //     const grandTotal = ticketOrders.reduce(
  //       (acc, ticketOrder) =>
  //         acc + ticketOrder.quantity * ticketOrder.totalPrice,
  //       0,
  //     );

  //     const paymentIntent = await this.stripe.paymentIntents.create({
  //       amount: +grandTotal.toFixed(2) * 100, // cents
  //       currency: 'usd', // set currency
  //       payment_method_types: ['card'],
  //     });

  //     return { clientSecret: paymentIntent.client_secret };
  //   } catch (e) {
  //     throw new InternalServerErrorException(
  //       'An error occurreed while processing payment',
  //     );
  //   }
  // }

  async createCheckoutSession(
    order: CreateOrderDto,
    successUrl: string,
    cancelUrl: string,
    orderId: string,
  ) {
    let customerId: string;

    const existingCustomers = await this.stripe.customers.list({
      email: order.email,
      limit: 1,
    });

    if (existingCustomers.data.length > 0) {
      customerId = existingCustomers.data[0].id;
    } else {
      customerId = await this.createCustomer({
        email: order.email,
        name: order.firstName + ' ' + order.lastName,
        phone: order.phone,
      });
    }

    const ticketLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
    const orderLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    try {
      const event = await this.eventService.getEvent(order.eventId);
      let promocode: Awaited<
        ReturnType<typeof this.eventService.getPromocodeById>
      > = null;
      if (order.promocodeId) {
        promocode = await this.eventService.getPromocodeById(order.promocodeId);
      }

      // process ticket orders
      order.ticketOrders.forEach((ticketOrder) => {
        // get the details of each ticket order from the event tickets
        if (ticketOrder.quantity <= 0) {
          return;
        }
        const ticketType = event.ticketTypes.find(
          (ticketType) => ticketType.id === ticketOrder.ticketTypeId,
        );

        if (!ticketType) {
          throw new InternalServerErrorException('Ticket order is invalid');
        }

        let discountInDollars = 0;
        if (promocode && ticketType.promoCodeIds.includes(promocode.id)) {
          if (promocode.absoluteDiscountAmount) {
            discountInDollars =
              promocode.absoluteDiscountAmount * ticketOrder.quantity;
          } else if (promocode.percentageDiscountAmount) {
            discountInDollars =
              promocode.percentageDiscountAmount *
              0.01 *
              ticketType.price *
              ticketOrder.quantity;
          } else {
            discountInDollars = 0;
          }

          if (discountInDollars >= ticketType.price * ticketOrder.quantity) {
            discountInDollars = ticketType.price * ticketOrder.quantity;
          }
        }
        const unitAmountInCents = (ticketType.price - discountInDollars) * 100;

        ticketLineItems.push({
          quantity: ticketOrder.quantity,
          price_data: {
            product_data: {
              name: `${ticketType.name} x${ticketOrder.quantity}`,
            },
            currency: 'usd',
            unit_amount: unitAmountInCents,
          },
        });
      });

      // process addon orders
      if (order.addonOrders) {
        order.addonOrders.forEach((addonOrder) => {
          const addonDetails = event.addons.find(
            (addon) => addon.id === addonOrder.addonId,
          );
          const unitAmountInCents =
            addonOrder.quantity * addonDetails.price * 100;

          if (addonOrder.quantity > 0) {
            orderLineItems.push({
              quantity: addonOrder.quantity,
              price_data: {
                product_data: {
                  name: `${addonDetails.name} x${addonOrder.quantity}`,
                },
                currency: 'usd',
                unit_amount: unitAmountInCents,
              },
            });
          }
        });
      }
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(
        'An error occurreed while processing payment',
      );
    }

    if (ticketLineItems.length <= 0) {
      throw new InternalServerErrorException(
        'Please select at least one ticket for checkout',
      );
    }

    const allLineItems = [...ticketLineItems, ...orderLineItems];
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer: customerId,
      line_items: allLineItems,
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        orderId: orderId,
      },
      payment_intent_data: {
        metadata: {
          orderId: orderId,
        },
      },
    });

    return { session, allLineItems };
  }

  async createCustomer(createCustomerData: CreateCustomer): Promise<string> {
    const customer = await this.stripe.customers.create(createCustomerData);
    return customer.id;
  }

  // async verifyStripSignature(
  //   req: RawBodyRequest<Request>,
  //   sig: string | string[],
  // ) {
  //   let event: Stripe.Event;

  //   // console.log('request body', req.body);
  //   try {
  //     event = this.stripe.webhooks.constructEvent(
  //       req.rawBody,
  //       sig,
  //       this.configService.get<string>('STRIPE_WEBHOOK_SECRET'),
  //     );
  //     return event;
  //   } catch (err) {
  //     console.log(⚠ Webhook signature verification failed:, err.message);
  //     throw err;
  //   }
  // }

  constructEvent(payload: any, signature: any) {
    const endpointSecret = this.configService.get(STRIPE_WEBHOOK_SECRET);

    return this.stripe.webhooks.constructEvent(
      payload,
      signature,
      endpointSecret,
    );
  }

  async checkPaymentStatus(sessionId: string) {
    try {
      // Retrieve the session using the session ID
      const session = await this.stripe.checkout.sessions.retrieve(sessionId);

      // Check the payment status
      if (session.payment_status === 'paid') {
        console.log('Payment is completed!');
        return {
          paid: true,
          amount: session.amount_total,
          paymendId: session.payment_intent.toString(),
        };
      } else {
        console.log(
          'Payment is not completed yet. Status:',
          session.payment_status,
        );
        return { paid: false };
      }
    } catch (error) {
      console.log(error);
      throw new InternalServerErrorException(
        'Something went wrong while checking payment status of order',
      );
    }
  }
}

type CreateCustomer = {
  name: string;
  email: string;
  phone: string;
};
