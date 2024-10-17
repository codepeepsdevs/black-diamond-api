import { Module } from '@nestjs/common';
import { SubscriberListService } from './subscriber-list.service';
import { SubscriberListController } from './subscriber-list.controller';
import { PrismaService } from 'src/prisma.service';
import { SubscriberService } from 'src/subscriber/subscriber.service';

@Module({
  controllers: [SubscriberListController],
  providers: [SubscriberListService, PrismaService, SubscriberService],
})
export class SubscriberListModule {}
