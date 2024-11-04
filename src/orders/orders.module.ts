import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaService } from 'src/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { StripeService } from 'src/stripe/stripe.service';
import { EventsService } from 'src/events/events.service';
import { EmailsService } from 'src/emails/emails.service';
import { UsersService } from 'src/users/users.service';
import { AuthenticationService } from 'src/auth/services/auth.service';

@Module({
  controllers: [OrdersController],
  providers: [
    OrdersService,
    PrismaService,
    JwtService,
    StripeService,
    EventsService,
    EmailsService,
    UsersService,
    AuthenticationService,
  ],
})
export class OrdersModule {}
