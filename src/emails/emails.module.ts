import { Module } from '@nestjs/common';
import { EmailsController } from './emails.controller';
import { EmailsService } from './emails.service';
import { JwtService } from '@nestjs/jwt';

@Module({
  controllers: [EmailsController],
  providers: [EmailsService, JwtService],
})
export class EmailsModule {}
