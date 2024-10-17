import { Test, TestingModule } from '@nestjs/testing';
import { PromoterController } from './promoter.controller';
import { PromoterService } from './promoter.service';

describe('PromoterController', () => {
  let controller: PromoterController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromoterController],
      providers: [PromoterService],
    }).compile();

    controller = module.get<PromoterController>(PromoterController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
