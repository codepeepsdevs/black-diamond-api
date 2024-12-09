import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // constructor() {
  //   super({
  //     log: ['query', 'info', 'warn', 'error'], // Enable logging
  //   });
  // }

  async onModuleInit() {
    try {
      await this.$connect().then(() => console.log('DB Connected'));
    } catch (e) {
      console.log(e);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
