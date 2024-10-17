import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { NewsletterService } from './newsletter.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UnsubscribeDto } from './dto/unsubscribe.dto';
import { SubscriptionStatusDto } from './dto/subscription-status.dto';
import { PaginationDto } from './dto/pagination-subscription.dto';

@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  subscribe(@Body() createSubscriptionDto: CreateSubscriptionDto) {
    return this.newsletterService.subscribe(createSubscriptionDto);
  }

  @Post('unsubscribe')
  unsubscribe(@Body() unsubscribeDto: UnsubscribeDto) {
    return this.newsletterService.unsubscribe(unsubscribeDto);
  }

  @Get('status')
  getStatus(@Query() subscriptionStatusDto: SubscriptionStatusDto) {
    return this.newsletterService.getStatus(subscriptionStatusDto);
  }

  @Get('subscribed')
  getAllSubscribed(@Query() paginationDto: PaginationDto) {
    const { page, limit } = paginationDto;
    return this.newsletterService.getAllSubscribed(Number(page), Number(limit));
  }
}
