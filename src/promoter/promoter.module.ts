import { Module } from '@nestjs/common';
import { PromoterService } from './promoter.service';
import { PromoterController } from './promoter.controller';

@Module({
  controllers: [PromoterController],
  providers: [PromoterService],
})
export class PromoterModule {}
