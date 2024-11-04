import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import {
  CreateEventAddonDto,
  CreateEventDetailsDto,
  CreateEventPromoCode,
  CreateEventTicketTypeDto,
  GetPromocodeDto,
  UpdateEventDto,
  UpdatEventTicketTypeDto,
} from './dto/events.dto';
import { Event, TicketType } from '@prisma/client';
import { PaginationQueryDto } from 'src/shared/dto/pagination-query.dto';
import { EventStatusPaginationQueryDto as EventsPaginationQueryDto } from './dto/events.dto';
import { getPagination } from 'src/utils/get-pagination';
import {
  getCurrentNewYorkDateTimeInUTC,
  getEventStatus,
} from 'src/utils/date-formatter';
// import { cloudinary } from 'src/cloudinary/cloudinary.config';

export type EventStatus = { eventStatus: 'UPCOMING' | 'PAST' };

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async createEventDetails(
    dto: CreateEventDetailsDto,
    coverImage: Express.Multer.File[],
    images: Express.Multer.File[],
  ) {
    try {
      const event = await this.prisma.event.create({
        data: {
          ...dto,
          coverImage: coverImage[0].path,
          images: images.map((image) => image.path),
        },
        include: {
          ticketTypes: true,
        },
      });

      return event;
    } catch (e) {
      console.log(e);
      throw new HttpException(
        'Error occurred while creating event details',

        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async createEventTicketType(dto: CreateEventTicketTypeDto) {
    try {
      const ticketType = await this.prisma.ticketType.create({
        data: dto,
      });

      // const eventTicketTypes = this.prisma.ticketType.findMany({
      //   where: {
      //     eventId: dto.eventId,
      //   },
      // });

      return ticketType;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(
        'Unable to create ticket types for the event',
      );
    }
  }

  async createEventPromoCode(dto: CreateEventPromoCode) {
    try {
      const newPromoCode = await this.prisma.promoCode.create({
        data: {
          absoluteDiscountAmount: dto.absoluteDiscountAmount || 0,
          key: dto.key,
          limit: dto.limit,
          name: dto.name,
          percentageDiscountAmount: dto.percentageDiscountAmount || 0,
          promoEndDate: dto.promoEndDate,
          promoStartDate: dto.promoStartDate,
          ticketTypes: {
            connect: dto.applyToTicketIds.map((ticketTypeId) => ({
              id: ticketTypeId,
            })),
          },
        },
        include: {
          ticketTypes: true,
        },
      });

      return newPromoCode;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(
        'Unable to create promocode to the tickets',
      );
    }
  }

  async createEventAddon(dto: CreateEventAddonDto, image: Express.Multer.File) {
    try {
      const createdAddOn = await this.prisma.eventAddons.create({
        data: { ...dto, image: image.path },
      });

      return createdAddOn;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(
        'Unable to create the addon for the event',
      );
    }
  }

  async getEvent(eventId: Event['id']) {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
      },
      include: {
        ticketTypes: true,
        addons: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }
    event['eventStatus'] = getEventStatus(event.startTime);
    return event as typeof event & EventStatus;
  }

  async getPromocode(dto: GetPromocodeDto) {
    const promocode = await this.prisma.promoCode.findFirst({
      where: {
        key: dto.key,
      },
      include: {
        ticketTypes: true,
      },
    });

    if (!promocode) {
      throw new NotFoundException('Promocode not found');
    }

    return promocode;
  }
  async getPromocodeById(id: string) {
    const promocode = await this.prisma.promoCode.findFirst({
      where: {
        id: id,
      },
      include: {
        ticketTypes: true,
      },
    });

    if (!promocode) {
      throw new NotFoundException('Promocode not found');
    }

    return promocode;
  }

  async getEvents(paginationQuery: EventsPaginationQueryDto) {
    try {
      const {
        page: _page,
        limit: _limit,
        eventStatus = 'all',
        search,
      } = paginationQuery;

      const { skip, take } = getPagination({ _page, _limit });
      const nowInNewYorkUTC = getCurrentNewYorkDateTimeInUTC();

      const [events, eventsCount] = await Promise.all([
        this.prisma.event.findMany({
          where: {
            isPublished: true,
            name: {
              contains: search,
              mode: 'insensitive',
            },
            startTime:
              eventStatus === 'past'
                ? {
                    lt: nowInNewYorkUTC,
                  }
                : eventStatus === 'upcoming'
                  ? {
                      gt: nowInNewYorkUTC,
                    }
                  : undefined,
          },
          include: {
            _count: true,
            ticketTypes: {
              include: {
                tickets: true,
              },
            },
          },
          take,
          skip,
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.event.count({
          where: {
            isPublished: true,
            name: {
              contains: search,
              mode: 'insensitive',
            },
            startTime:
              eventStatus === 'past'
                ? {
                    lt: nowInNewYorkUTC,
                  }
                : eventStatus === 'upcoming'
                  ? {
                      gt: nowInNewYorkUTC,
                    }
                  : undefined,
          },
          take,
          skip,
        }),
      ]);

      const extendedEvents = events.map((event) => {
        // let eventGross = 0;
        // let totalTickets = 0;
        // let totalSales = 0;
        const eventStatus = getEventStatus(event.startTime);

        // event.ticketTypes.forEach((ticketType) => {
        //   eventGross =
        //     eventGross + ticketType.price * ticketType.tickets.length;

        //   totalTickets = totalSales + ticketType.quantity;
        //   totalSales = totalSales + ticketType.tickets.length;
        // });

        return {
          ...event,
          // totalTickets,
          eventStatus,
        };
      });

      return {
        events: extendedEvents,
        eventsCount,
      };
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(
        'Something went wrong while retrieving events',
      );
    }
  }

  async adminGetEvents(paginationQuery: EventsPaginationQueryDto) {
    try {
      const {
        page: _page,
        limit: _limit,
        eventStatus = 'all',
        search,
      } = paginationQuery;

      const { skip, take } = getPagination({ _page, _limit });
      const nowInNewYorkUTC = getCurrentNewYorkDateTimeInUTC();

      const [events, eventsCount] = await Promise.all([
        this.prisma.event.findMany({
          where: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
            startTime:
              eventStatus === 'past'
                ? {
                    lt: nowInNewYorkUTC,
                  }
                : eventStatus === 'upcoming'
                  ? {
                      gt: nowInNewYorkUTC,
                    }
                  : undefined,
          },
          include: {
            _count: true,
            ticketTypes: {
              include: {
                tickets: true,
              },
            },
          },
          take,
          skip,
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.event.count({
          where: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
            startTime:
              eventStatus === 'past'
                ? {
                    lt: nowInNewYorkUTC,
                  }
                : eventStatus === 'upcoming'
                  ? {
                      gt: nowInNewYorkUTC,
                    }
                  : undefined,
          },
          take,
          skip,
        }),
      ]);

      const extendedEvents = events.map((event) => {
        let eventGross = 0;
        let totalTickets = 0;
        let totalSales = 0;
        const eventStatus = getEventStatus(event.startTime);

        event.ticketTypes.forEach((ticketType) => {
          eventGross =
            eventGross + ticketType.price * ticketType.tickets.length;

          totalTickets = totalSales + ticketType.quantity;
          totalSales = totalSales + ticketType.tickets.length;
        });

        return {
          ...event,
          gross: eventGross,
          totalTickets,
          totalSales,
          eventStatus,
        };
      });

      return {
        events: extendedEvents,
        eventsCount,
      };
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(
        'Something went wrong while retrieving events',
      );
    }
  }

  async getEventTicketTypes(eventId: Event['id']) {
    try {
      const ticketTypes = await this.prisma.ticketType.findMany({
        where: {
          eventId: eventId,
        },
        include: {
          promoCodes: true,
          _count: {
            select: {
              tickets: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return ticketTypes;
    } catch (e) {
      console.log(e);
      throw new HttpException(
        'Unable to retrieve ticket types',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getEventPromocodes(eventId: Event['id']) {
    try {
      const promocodes = await this.prisma.promoCode.findMany({
        where: {
          ticketTypes: {
            every: {
              eventId: eventId,
            },
          },
        },
        include: {
          ticketTypes: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      return promocodes;
    } catch (e) {
      console.log(e);
      throw new HttpException(
        'Unable to retrieve promocodes',

        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getAddons(eventId: Event['id']) {
    try {
      const addons = await this.prisma.eventAddons.findMany({
        where: {
          eventId,
        },
        include: {
          event: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });
      return addons;
    } catch (e) {
      console.log(e);
      throw new HttpException(
        'Unable to retrieve addons',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUpcomingEvents(paginationQuery: PaginationQueryDto) {
    const { page, limit } = paginationQuery;
    const skip = page ? Math.abs((Number(page) - 1) * Number(limit)) : page;
    const take = limit ? Number(limit) : undefined;
    const nowInNewYorkUTC = getCurrentNewYorkDateTimeInUTC();
    const event = await this.prisma.event.findMany({
      where: {
        startTime: {
          gt: nowInNewYorkUTC,
        },
      },
      include: {
        ticketTypes: true,
      },
      take,
      skip,
      orderBy: {
        startTime: 'desc',
      },
    });

    return event;
  }

  async getPastEvents(paginationQuery: PaginationQueryDto) {
    const { page, limit } = paginationQuery;
    const skip = page ? Math.abs((Number(page) - 1) * Number(limit)) : page;
    const take = limit ? Number(limit) : undefined;
    const nowInNewYorkUTC = getCurrentNewYorkDateTimeInUTC();
    const event = await this.prisma.event.findMany({
      where: {
        startTime: {
          lt: nowInNewYorkUTC,
        },
      },
      include: {
        ticketTypes: true,
      },
      take,
      skip,
      orderBy: {
        startTime: 'desc',
      },
    });

    return event;
  }

  async updateEvent(
    eventId: Event['id'],
    dto: UpdateEventDto,
    coverImage?: Express.Multer.File[],
    images?: Express.Multer.File[],
  ) {
    const oldDetails = await this.prisma.event.findFirst({
      where: {
        id: eventId,
      },
    });

    if (!oldDetails) {
      throw new NotFoundException('Event to update not found');
    }

    const newCoverImage = coverImage
      ? coverImage[0].path
      : oldDetails.coverImage;
    const newImages = images
      ? [...images.map((image) => image.path), ...oldDetails.images]
      : oldDetails.images;

    try {
      const event = await this.prisma.event.update({
        where: {
          id: eventId,
        },
        data: { ...dto, images: newImages, coverImage: newCoverImage },
      });

      return event;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(
        'Something went wrong while updating event details',
      );
    }
  }

  async updateTicketType(
    ticketTypeId: TicketType['id'],
    dto: UpdatEventTicketTypeDto,
  ) {
    const event = await this.prisma.ticketType.update({
      where: {
        id: ticketTypeId,
      },
      data: dto,
    });

    return event;
  }

  async getRevenue(eventId: string) {
    try {
      const orders = await this.prisma.order.findMany({
        where: {
          eventId: eventId,
        },
      });

      const revenue = orders.reduce((accValue, currOrder) => {
        return (accValue += currOrder.amountPaid);
      }, 0);

      return {
        revenue,
      };
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Unable to getch event revenue');
    }
  }

  async removeImageFromSlide(eventId: string, image: string) {
    const oldEvent = await this.prisma.event.findFirst({
      where: {
        id: eventId,
      },
    });
    if (oldEvent.images.length === 1) {
      throw new InternalServerErrorException(
        'There must be at least one slide left',
      );
    }
    let imageToRemove = '';
    const updatedImages = oldEvent.images.filter((_image) => {
      if (image === _image) {
        imageToRemove = _image;
      }
      return image !== _image;
    });
    console.log('Image to remove', imageToRemove);
    console.log('Updated Images', updatedImages);

    if (!imageToRemove) {
      throw new NotFoundException('Image to remove not found');
    }
    // Strip the file extension to get the public_id
    // const publicId = imageToRemove.replace(/\.[^/.]+$/, ''); // Removes the extension

    try {
      await this.prisma.$transaction(
        async (prisma) => {
          await prisma.event.update({
            where: {
              id: eventId,
            },
            data: {
              images: updatedImages,
            },
          });
          // TODO: Delete the file from cloudinary
          // await cloudinary.uploader.destroy(publicId);
        },
        {
          maxWait: 250000, // Maximum time (in milliseconds) to wait for the transaction to start
          timeout: 250000, // Maximum time (in milliseconds) for the transaction to complete
        },
      );
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(
        'Unable to remove image from slide',
      );
    }
    return {
      message: 'Image removed successfully',
      eventId: eventId,
    };
  }

  async publishEvent(eventId: string) {
    const eventExists = await this.prisma.event.findFirst({
      where: {
        id: eventId,
      },
    });
    if (!eventExists) {
      throw new NotFoundException('Event to publish was not found');
    }
    try {
      const updatedEvent = await this.prisma.event.update({
        where: {
          id: eventId,
        },
        data: {
          isPublished: true,
        },
      });

      return updatedEvent;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(
        'Something went wrong while publishing event',
      );
    }
  }

  async unpublishEvent(eventId: string) {
    const eventExists = await this.prisma.event.findFirst({
      where: {
        id: eventId,
      },
    });
    if (!eventExists) {
      throw new NotFoundException('Event to unpublish was not found');
    }
    try {
      const updatedEvent = await this.prisma.event.update({
        where: {
          id: eventId,
        },
        data: {
          isPublished: false,
        },
      });

      return updatedEvent;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(
        'Something went wrong while unpublishing event',
      );
    }
  }

  async deleteEvent(ticketId: Event['id']) {
    const event = await this.prisma.event.delete({
      where: {
        id: ticketId,
      },
    });

    return event;
  }
}
