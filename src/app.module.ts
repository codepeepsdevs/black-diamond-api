import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { ConfigModule } from '@nestjs/config';
import { OrdersModule } from './orders/orders.module';
import { ContactusModule } from './contactus/contactus.module';
import { NewsletterModule } from './newsletter/newsletter.module';
import { PromoterModule } from './promoter/promoter.module';
import { AuthenticationModule } from './auth/auth.module';
import { EventsModule } from './events/events.module';
import { StripeModule } from './stripe/stripe.module';
import { LoggerModule } from 'nestjs-pino';
import { SubscriberListModule } from './subscriber-list/subscriber-list.module';
import { SubscriberModule } from './subscriber/subscriber.module';
import { PrismaModule } from './prisma/prisma.module';
import { CheckinModule } from './checkin/checkin.module';

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
    PrismaModule,
    CheckinModule,
    // ServeStaticModule.forRoot({
    //   rootPath: join(__dirname, '..', 'static'),
    // }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        // Pretty + color output for dev
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  singleLine: false,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                },
              }
            : undefined,
        // Quiet health/spam endpoints and reduce noise
        autoLogging: {
          ignore: (req) => req.url === '/api/health' || req.url.startsWith('/api/health'),
        },
        quietReqLogger: true,
        customLogLevel: (req, res, err) => {
          if (res.statusCode >= 500 || err) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
        // Redact sensitive headers
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["stripe-signature"]'],
          remove: true,
        },
        // Auto-add request details (safe serializable form)
        serializers: {
          req(req) {
            return {
              id: req.id,
              method: req.method,
              url: req.url,
              query: req.query,
              // params omitted intentionally (redundant with url)
            };
          },
          res(res) {
            return {
              statusCode: res.statusCode,
            };
          },
        },
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
