import { Test, TestingModule } from '@nestjs/testing';
import { PromoterService } from './promoter.service';

describe('PromoterService', () => {
  let service: PromoterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromoterService],
    }).compile();

    service = module.get<PromoterService>(PromoterService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
