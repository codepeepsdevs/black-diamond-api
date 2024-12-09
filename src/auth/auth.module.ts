import { Module, forwardRef } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthenticationService } from './services/auth.service';
import { LocalStrategy } from './services/local.strategy';
import { JwtStrategy } from './services/jwt.strategy';
import { AuthenticationController } from './auth.controller';
import { JwtRefreshTokenStrategy } from './services/jwt.refreshtoken.strategy';
import { FacebookStrategy } from './services/facebook.strategy';
import { GoogleStrategy } from './services/google.strategy';
import { UsersModule } from 'src/users/users.module';
import { EmailsModule } from 'src/emails/emails.module';
import {
  JWT_ACCESS_TOKEN_EXPIRATION_TIME,
  JWT_ACCESS_TOKEN_SECRET,
} from 'src/constants';
import { UsersService } from 'src/users/users.service';
import { EmailsService } from 'src/emails/emails.service';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    PassportModule,
    ConfigModule,
    EmailsModule,

    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get(JWT_ACCESS_TOKEN_SECRET),
        signOptions: {
          expiresIn: `${configService.get(JWT_ACCESS_TOKEN_EXPIRATION_TIME)}s`,
        },
      }),
    }),
  ],
  providers: [
    UsersService,
    AuthenticationService,
    EmailsService,
    ConfigService,
    LocalStrategy,
    JwtStrategy,
    JwtService,
    JwtRefreshTokenStrategy,
    FacebookStrategy,
    GoogleStrategy,
  ],
  controllers: [AuthenticationController],
  exports: [AuthenticationService],
})
export class AuthenticationModule {}
