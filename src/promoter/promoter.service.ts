import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { Promoter } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { CreatePromoterDto } from './dto/promoter.dto';

@Injectable()
export class PromoterService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createPromoterDto: CreatePromoterDto): Promise<Promoter> {
    const exstPromoter = await this.prisma.promoter.findUnique({
      where: { email: createPromoterDto.email },
    });

    if (exstPromoter) {
      throw new HttpException(
        'promoter with email already registered',
        HttpStatus.CONFLICT,
      );
    }

    const promoter = await this.prisma.promoter.create({
      data: createPromoterDto,
    });
    return promoter;
  }

  async findAll(page: number, limit: number): Promise<Promoter[]> {
    const promoters = await this.prisma.promoter.findMany({
      skip: (page - 1) * limit,
      take: limit,
    });
    return promoters;
  }
}
