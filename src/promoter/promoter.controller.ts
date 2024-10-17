import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { PromoterService } from './promoter.service';
import { CreatePromoterDto } from './dto/promoter.dto';
import { PaginationQueryDto } from 'src/shared/dto/pagination-query.dto';

@Controller('promoters')
export class PromoterController {
  constructor(private readonly promoterService: PromoterService) {}

  @Post()
  async create(@Body() createPromoterDto: CreatePromoterDto) {
    return await this.promoterService.create(createPromoterDto);
  }

  @Get()
  async findAll(@Query() paginationQuery: PaginationQueryDto) {
    const { page, limit } = paginationQuery;
    return await this.promoterService.findAll(Number(page), Number(limit));
  }
}
