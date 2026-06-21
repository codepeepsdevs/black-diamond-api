import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { JwtService } from '@nestjs/jwt';
import { StripeService } from 'src/stripe/stripe.service';
import { EventsService } from 'src/events/events.service';
import { EmailsModule } from 'src/emails/emails.module';
import { UsersService } from 'src/users/users.service';
import { NewsletterService } from 'src/newsletter/newsletter.service';
import { AuthenticationModule } from 'src/auth/auth.module';

@Module({
  imports: [AuthenticationModule, EmailsModule],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    JwtService,
    StripeService,
    EventsService,
    UsersService,
    NewsletterService,
  ],
})
export class OrdersModule {}
