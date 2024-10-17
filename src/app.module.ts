import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { OrdersModule } from './orders/orders.module';
import { ContactusModule } from './contactus/contactus.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { PromoterModule } from './promoter/promoter.module';
import { AuthenticationModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { StripeModule } from './stripe/stripe.module';
// import { LoggerModule } from 'nestjs-pino';
import { SubscriberListModule } from './subscriber-list/subscriber-list.module';
import { SubscriberModule } from './subscriber/subscriber.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }), // Load environment variables
    // JwtModule.registerAsync({
    //   imports: [ConfigModule], // Import ConfigModule to use ConfigService
    //   useFactory: async (configService: ConfigService) => ({
    //     secret: configService.get<string>(JWT_ACCESS_TOKEN_SECRET),
    //     signOptions: { expiresIn: '1h' }, // Adjust as needed
    //   }),
    //   inject: [ConfigService],
    // }),
    UsersModule,
    AuthenticationModule,
    OrdersModule,
    ContactusModule,
    NewsletterModule,
    PromoterModule,
    EventsModule,
    StripeModule,
    SubscriberListModule,
    SubscriberModule,
    // ServeStaticModule.forRoot({
    //   rootPath: join(__dirname, '..', 'static'),
    // }),
    // LoggerModule.forRoot({
    //   pinoHttp: {
    //     customProps: (req, res) => ({
    //       context: 'HTTP',
    //     }),
    //     transport: {
    //       target: 'pino-pretty',
    //     },
    //   },
    // }),
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}

