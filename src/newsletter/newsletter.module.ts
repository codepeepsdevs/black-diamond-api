import { Module } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { NewsletterController } from './newsletter.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [NewsletterController],
  providers: [NewsletterService, PrismaService],
})
export class NewsletterModule {}
