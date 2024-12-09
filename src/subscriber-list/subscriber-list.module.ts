import { Module } from '@nestjs/common';
import { SubscriberListService } from './subscriber-list.service';
import { SubscriberListController } from './subscriber-list.controller';
import { SubscriberService } from 'src/subscriber/subscriber.service';
import { PrismaModule } from 'src/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriberListController],
  providers: [SubscriberListService, SubscriberService],
})
export class SubscriberListModule {}
