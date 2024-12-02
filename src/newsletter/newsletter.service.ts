import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UnsubscribeDto } from './dto/unsubscribe.dto';
import { SubscriptionStatusDto } from './dto/subscription-status.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class NewsletterService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(createSubscriptionDto: CreateSubscriptionDto) {
    const { email } = createSubscriptionDto;

    const existingSubscription =
      await this.prisma.newsletterSubscription.findUnique({
        where: { email },
      });

    if (existingSubscription && existingSubscription.isSubscribed) {
      throw new InternalServerErrorException('Already subscribed.');
    }

    try {
      await this.prisma.newsletterSubscription.upsert({
        where: { email },
        update: {
          unsubscribedAt: null,
          isSubscribed: true,
          subscribedAt: new Date(),
        },
        create: { email, isSubscribed: true },
      });

      return { message: 'Subscription to newsletter was successful' };
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(
        'Something went wrong while signing up to newsletter',
      );
    }
  }

  async unsubscribe(unsubscribeDto: UnsubscribeDto) {
    const { email } = unsubscribeDto;

    const subscription = await this.prisma.newsletterSubscription.findUnique({
      where: { email },
    });

    if (!subscription || subscription.unsubscribedAt) {
      throw new NotFoundException(
        'Subscription not found or already unsubscribed.',
      );
    }

    return this.prisma.newsletterSubscription.update({
      where: { email },
      data: { unsubscribedAt: new Date(), isSubscribed: false },
    });
  }

  async getStatus(subscriptionStatusDto: SubscriptionStatusDto) {
    const { email } = subscriptionStatusDto;

    const subscription = await this.prisma.newsletterSubscription.findUnique({
      where: { email },
    });

    if (!subscription) {
      return { subscribed: false, message: 'Not subscribed.' };
    }

    return {
      subscribed: !subscription.unsubscribedAt,
      subscribedAt: subscription.subscribedAt,
      unsubscribedAt: subscription.unsubscribedAt,
    };
  }

  async getAllSubscribed(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;
    const take = limit;

    const [totalCount, subscriptions] = await Promise.all([
      this.prisma.newsletterSubscription.count({
        where: { isSubscribed: true },
      }),
      this.prisma.newsletterSubscription.findMany({
        where: { isSubscribed: true },
        skip,
        take,
      }),
    ]);

    return {
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      page,
      limit,
      data: subscriptions,
    };
  }
}
