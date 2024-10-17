import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { SubscriberService } from './subscriber.service';
import {
  BulkCreateSubscriberDto,
  CreateSubscriberDto,
} from './dto/subscriber.dto';
import { PaginationQueryDto } from 'src/shared/dto/pagination-query.dto';

@Controller('subscribers')
export class SubscriberController {
  constructor(private readonly subscriberService: SubscriberService) {}

  @Post()
  create(@Body() dto: CreateSubscriberDto) {
    return this.subscriberService.create(dto);
  }

  @Post()
  bukCreate(@Body() dto: BulkCreateSubscriberDto) {
    return this.subscriberService.bulkCreate(dto);
  }

  @Get()
  findAll(@Query() paginationQuery: PaginationQueryDto) {
    return this.subscriberService.findAll(paginationQuery);
  }

  @Get('by-id:id')
  findById(@Param('id') id: string) {
    return this.subscriberService.findOneById(id);
  }

  @Get('by-email:id')
  findByEmail(@Param('id') id: string) {
    return this.subscriberService.findOneByEmail(id);
  }

  @Get('unsubscribed')
  findUnsubscribed(@Body() paginationQuery: PaginationQueryDto) {
    return this.subscriberService.findUnsubscribed(paginationQuery);
  }

  // @Patch(':id')
  // update(@Param('id') id: string, @Body() dto: UpdateSubscriberDto) {
  //   return this.subscriberService.update(id, dto);
  // }
  @Delete(':id')
  deleteSubscriber(@Param('id') id: string) {
    return this.subscriberService.deleteSubscriber(id);
  }
}
