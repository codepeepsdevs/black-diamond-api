import { Module } from '@nestjs/common';
import { ContactusService } from './contactus.service';
import { ContactusController } from './contactus.controller';

@Module({
  controllers: [ContactusController],
  providers: [ContactusService],
})
export class ContactusModule {}
