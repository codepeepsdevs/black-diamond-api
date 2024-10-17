import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PaginationQueryDto } from 'src/shared/dto/pagination-query.dto';
import {
  BulkCreateSubscriberDto,
  CreateSubscriberDto,
} from './dto/subscriber.dto';

@Injectable()
export class SubscriberService {
  constructor(private readonly prisma: PrismaService) {}
  async create(dto: CreateSubscriberDto) {
    return await this.prisma.subscriber.create({
      data: dto,
    });
  }

  async bulkCreate(dto: BulkCreateSubscriberDto) {
    return await this.prisma.subscriber.createMany({
      data: dto.subscribers,
    });
  }

  async findAll(paginationQuery: PaginationQueryDto) {
    const { page = 1, limit = 10 } = paginationQuery;
    const skip = Math.abs((Number(page) - 1) * Number(limit));
    return await this.prisma.subscriber.findMany({
      take: Number(limit),
      skip,
      orderBy: {
        subscribedAt: 'desc',
      },
    });
  }

  async findOneById(id: string) {
    const subscriber = await this.prisma.subscriber.findUnique({
      where: {
        id: id,
      },
    });

    if (!subscriber) {
      throw new NotFoundException('Subscriber not found');
    }

    return subscriber;
  }

  async findUnsubscribed(paginationQuery: PaginationQueryDto) {
    const { page = 1, limit = 10 } = paginationQuery;
    const skip = Math.abs((Number(page) - 1) * Number(limit));
    const subscriber = this.prisma.subscriber.findMany({
      where: {
        isSubscribed: false,
      },
      take: Number(limit),
      skip,
      orderBy: {
        subscribedAt: 'desc',
      },
    });

    if (!subscriber) {
      throw new NotFoundException('Subscriber not found');
    }

    return subscriber;
  }

  findOneByEmail(email: string) {
    const subscriber = this.prisma.subscriber.findUnique({
      where: {
        email: email,
      },
    });

    if (!subscriber) {
      throw new NotFoundException('Subscriber not found');
    }

    return subscriber;
  }

  // update(id: string, dto: UpdateSubscriberDto) {
  //   return `This action updates a #${id} subscriber`;
  // }

  async deleteSubscriber(id: string) {
    const usersList = await this.prisma.subscriber.findUnique({
      where: { id },
    });

    for (const listId of usersList.id)
      this.prisma.subscriberList.update({
        where: {
          id: listId,
        },
        data: {
          subscribers: {
            disconnect: { id },
          },
        },
      });

    return this.prisma.subscriber.update({
      where: {
        id,
      },
      data: {
        isSubscribed: false,
        unsubscribedAt: new Date(),
        subscriberListIds: [], // Empty the subscriber list
      },
    });
  }
}
