import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { EmailProviderService } from './email-provider.service';
import { EmailsController } from './emails.controller';
import { EmailsService } from './emails.service';
import { EMAIL_PROVIDER } from './interfaces/email-provider.interface';
import { createEmailProvider } from './providers/create-email-provider';

@Module({
  imports: [ConfigModule],
  controllers: [EmailsController],
  providers: [
    {
      provide: EMAIL_PROVIDER,
      useFactory: (configService: ConfigService) =>
        createEmailProvider(configService),
      inject: [ConfigService],
    },
    EmailProviderService,
    EmailsService,
    JwtService,
  ],
  exports: [EmailsService, EmailProviderService],
})
export class EmailsModule {}
