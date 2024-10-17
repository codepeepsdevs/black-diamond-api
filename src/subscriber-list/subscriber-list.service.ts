import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  AddOneSubscriberToListDto,
  AddSubscriberByDetailsDto,
  ChangeSubscriberListNameDto,
  CreateSubscriberListDto,
  UpdateSubscribersListDto,
} from './dto/subscriber-list.dto';
import { PrismaService } from 'src/prisma.service';
import { PaginationQueryDto } from 'src/shared/dto/pagination-query.dto';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Subscriber } from '@prisma/client';
import * as csv from 'csv-parser';
import { SubscriberService } from 'src/subscriber/subscriber.service';
import { Readable } from 'stream';

@Injectable()
export class SubscriberListService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriberService: SubscriberService,
  ) {}

  async create(dto: CreateSubscriberListDto) {
    try {
      const newList = await this.prisma.subscriberList.create({
        data: {
          name: dto.name,
        },
        include: {
          subscribers: true,
        },
      });

      return newList;
    } catch (e) {
      throw new HttpException(
        'An error occurred while creating subscriber list',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(paginationQuery?: PaginationQueryDto) {
    const { page = 1, limit = 10 } = paginationQuery;
    const skip = Math.abs((Number(page) - 1) * Number(limit));
    try {
      const lists = await this.prisma.subscriberList.findMany({
        include: {
          subscribers: true,
          _count: {
            select: {
              subscribers: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: Number(limit),
      });

      return lists;
    } catch (e) {
      throw new HttpException(
        'An error occurred while fetching subscriber list',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(listId: string) {
    const list = await this.prisma.subscriberList.findUnique({
      where: {
        id: listId,
      },
      include: {
        subscribers: true,
      },
    });

    if (!list) {
      throw new NotFoundException('Subscriber list not found');
    }

    return list;
  }

  async changeName(listId: string, dto: ChangeSubscriberListNameDto) {
    try {
      const updatedList = await this.prisma.subscriberList.update({
        where: {
          id: listId,
        },
        data: {
          name: dto.name,
        },
        include: {
          subscribers: true,
        },
      });

      return updatedList;
    } catch (e) {
      throw new InternalServerErrorException(
        'Unable to update subscriber list details',
      );
    }
  }

  async addSubscribers(listId: string, dto: UpdateSubscribersListDto) {
    const listExists = await this.prisma.subscriberList.findUnique({
      where: {
        id: listId,
      },
    });

    // Check if the list exists
    if (!listExists) {
      throw new NotFoundException('Subscriber list to add to not found');
    }

    try {
      const updatedList = this.prisma.subscriberList.update({
        where: {
          id: listId,
        },
        data: {
          subscribers: {
            connect: dto.subscriberIds.map((id) => ({
              id,
            })),
          },
        },
      });

      return updatedList;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Subscriber to add not found');
      }
      throw new InternalServerErrorException(
        'Error occurred while add subscriber to list',
      );
    }
  }

  async addSubscriber(listId: string, dto: AddOneSubscriberToListDto) {
    try {
      const listExists = await this.prisma.subscriberList.findUnique({
        where: {
          id: listId,
        },
      });
      console.log('List exists');

      // Check if the list exists
      if (!listExists) {
        throw new NotFoundException('Subscriber list to add to not found');
      }

      // Check if the subscriber exists
      const subscriberExists = await this.prisma.subscriber.findUnique({
        where: {
          email: dto.email,
        },
      });

      console.log('Subscriber exists');

      let newSubscriber;
      // if subscriber does not exist create it
      if (!subscriberExists) {
        newSubscriber = await this.prisma.subscriber.create({
          data: {
            ...dto,
          },
        });
      }

      const updatedList = await this.prisma.subscriberList.update({
        where: {
          id: listId,
        },
        data: {
          subscribers: {
            connect: {
              id: subscriberExists.id || newSubscriber.id,
            },
          },
        },
      });

      return updatedList;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Subscriber to add not found');
      }
      throw new InternalServerErrorException(
        'Error occurred while add subscriber to list',
      );
    }
  }

  async addSubscribersByDetails(
    listId: string,
    dto: AddSubscriberByDetailsDto,
  ) {
    const parsedDetails = dto.details
      .trim() // Remove any leading/trailing whitespace
      .split('\n') // Split by lines
      .map((line) => {
        const [name, email] = line.split(','); // Split each line by comma
        return { name, email }; // Create an object with name and email
      });

    try {
      const listExists = await this.prisma.subscriberList.findUnique({
        where: {
          id: listId,
        },
      });

      // Check if the list exists
      if (!listExists) {
        throw new NotFoundException('Subscriber list to add to not found');
      }

      // Check if the subscriber exists
      await Promise.all([
        parsedDetails.map(async (subscriber) => {
          const subscriberExists = await this.prisma.subscriber.findUnique({
            where: {
              email: subscriber.email,
            },
          });

          let newSubscriber;
          // if subscriber does not exist create it
          if (!subscriberExists) {
            newSubscriber = await this.prisma.subscriber.create({
              data: {
                ...subscriber,
              },
            });
          }

          await this.prisma.subscriberList.update({
            where: {
              id: listId,
            },
            data: {
              subscribers: {
                connect: {
                  id: subscriberExists?.id || newSubscriber.id,
                },
              },
            },
          });
        }),
      ]);

      return { message: 'Subscribers added successfully', listId };
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Subscriber to add not found');
      }
      throw new InternalServerErrorException(
        'Error occurred while add subscriber to list',
      );
    }
  }

  async removeSubscribers(listId: string, dto: UpdateSubscribersListDto) {
    const listExists = await this.prisma.subscriberList.findUnique({
      where: {
        id: listId,
      },
    });

    // Check if the list exists
    if (!listExists) {
      throw new NotFoundException('Subscriber list to remove from not found');
    }

    try {
      const updatedList = this.prisma.subscriberList.update({
        where: {
          id: listId,
        },
        data: {
          subscribers: {
            disconnect: dto.subscriberIds.map((id) => ({
              id,
            })),
          },
        },
      });

      return updatedList;
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new NotFoundException('Subscriber to remove not found');
      }
      throw new InternalServerErrorException(
        'Error occurred while removing subscriber from list',
      );
    }
  }

  async addSubscribersFromCSV(csvFile: Express.Multer.File, listId: string) {
    const subscribers: Pick<Subscriber, 'email' | 'name'>[] = [];
    const newSubscriberIds: string[] = [];

    return new Promise<{ message: string; listId: string }>(
      (resolve, reject) => {
        Readable.from(csvFile.buffer)
          .pipe(csv())
          .on('data', (row: Subscriber) => {
            subscribers.push({
              name: row.name,
              email: row.email,
            });
          })
          .on('end', async () => {
            for (const subscriber of subscribers) {
              // await this.prisma.subscriber.create({
              //   data: {
              //     ...subscriber,
              //     subscriberList: {
              //       connect: { id: listId },
              //     },
              //   },

              //   include: {
              //     subscriberList: true,
              //   },
              // });

              const newSubscriber =
                await this.subscriberService.create(subscriber); // Create subscriber
              newSubscriberIds.push(newSubscriber.id);
            }
            // Add to the passed list
            this.addSubscribers(listId, { subscriberIds: newSubscriberIds });
            resolve({
              message: 'Subscribers added successfully',
              listId: listId,
            });
          })
          .on('error', (err) => {
            reject(err);
          });
      },
    );
  }

  // remove(id: number) {
  //   return `This action removes a #${id} subscriberList`;
  // }
}
