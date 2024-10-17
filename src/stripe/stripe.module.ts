import { Module } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';
import { EventsService } from 'src/events/events.service';
import { PrismaService } from 'src/prisma.service';
import { OrdersService } from 'src/orders/orders.service';
import { EmailsService } from 'src/emails/emails.service';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';

@Module({
  controllers: [StripeController],
  providers: [
    StripeService,
    ConfigService,
    EventsService,
    PrismaService,
    OrdersService,
    EmailsService,
    JwtService,
    UsersService,
  ],
})
export class StripeModule {}
