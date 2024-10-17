import { Module } from '@nestjs/common';
import { ContactusService } from './contactus.service';
import { ContactusController } from './contactus.controller';
import { PrismaService } from 'src/prisma.service';

@Module({
  controllers: [ContactusController],
  providers: [ContactusService, PrismaService],
})
export class ContactusModule {}
