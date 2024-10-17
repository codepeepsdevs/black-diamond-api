import { Test, TestingModule } from '@nestjs/testing';
import { ContactusService } from './contactus.service';

describe('ContactusService', () => {
  let service: ContactusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ContactusService],
    }).compile();

    service = module.get<ContactusService>(ContactusService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
