import { Module } from '@nestjs/common';
import { PromoterService } from './promoter.service';
import { PromoterController } from './promoter.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [PromoterController],
  providers: [PromoterService, PrismaService],
})
export class PromoterModule {}
