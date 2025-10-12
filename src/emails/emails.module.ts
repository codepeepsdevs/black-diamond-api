import { Module } from '@nestjs/common';
import { EmailsController } from './emails.controller';
import { EmailsService } from './emails.service';
import { EmailResendService } from './resend.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [EmailsController],
  providers: [EmailsService, EmailResendService, JwtService],
  exports: [EmailsService, EmailResendService],
})
export class EmailsModule {}
