import { Module } from '@nestjs/common';
import { StripeController } from './stripe.controller';
import { StripeService } from './stripe.service';
import { ConfigService } from '@nestjs/config';
import { EventsService } from 'src/events/events.service';
import { OrdersService } from 'src/orders/orders.service';
import { EmailsModule } from 'src/emails/emails.module';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/users/users.service';
import { AuthenticationService } from 'src/auth/services/auth.service';
import { NewsletterService } from 'src/newsletter/newsletter.service';

@Module({
  imports: [EmailsModule],
  controllers: [StripeController],
  providers: [
    StripeService,
    ConfigService,
    EventsService,
    OrdersService,
    JwtService,
    UsersService,
    AuthenticationService,
    NewsletterService,
  ],
})
export class StripeModule {}
