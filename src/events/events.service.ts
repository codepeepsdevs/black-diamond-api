import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CreateEventAddonDto,
  CreateEventDetailsDto,
  CreateEventPromoCode,
  CreateEventTicketTypeDto,
  GetPromocodeDto,
  PageViewDto,
  UpdateEventDto,
  UpdatePromocodeDto,
  UpdatEventTicketTypeDto,
} from './dto/events.dto';
import { Event, Prisma, TicketType } from '@prisma/client';
import { PaginationQueryDto } from 'src/shared/dto/pagination-query.dto';
import { EventStatusPaginationQueryDto as EventsPaginationQueryDto } from './dto/events.dto';
import { getPagination } from 'src/utils/get-pagination';
import {
  combineDateAndTime,
  getEventStatus,
  isPromocodeActive,
  isTicketTypeVisible,
} from 'src/utils/helpers';
// import { cloudinary } from 'src/cloudinary/cloudinary.config';

export type EventStatus = { eventStatus: 'UPCOMING' | 'PAST' };

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async createEventDetails(
    { startDate, startTime, endDate, endTime, ...dto }: CreateEventDetailsDto,
    coverImage: Express.Multer.File[],
    images: Express.Multer.File[],
  ) {
    const utcStartTime = combineDateAndTime(startDate, startTime);
    const utcEndTime = combineDateAndTime(endDate, endTime);

    if (utcStartTime.getTime() > utcEndTime.getTime()) {
      throw new InternalServerErrorException(
        'End date must be after start date',
      );
    }

    try {
      const event = await this.prisma.event.create({
        data: {
          ...dto,
          coverImage: coverImage[0].path,
          images: images.map((image) => image.path),
          startTime: utcStartTime,
          endTime: utcEndTime,
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

  async createEventTicketType({
    startDate,
    startTime,
    endDate,
    endTime,
    ...dto
  }: CreateEventTicketTypeDto) {
    const utcStartDate =
      dto.visibility === 'CUSTOM_SCHEDULE'
        ? combineDateAndTime(startDate, startTime)
        : null;
    const utcEndDate =
      dto.visibility === 'CUSTOM_SCHEDULE'
        ? combineDateAndTime(endDate, endTime)
        : null;

    if (
      dto.visibility === 'CUSTOM_SCHEDULE' &&
      utcEndDate.getTime() < utcStartDate.getTime()
    ) {
      throw new InternalServerErrorException(
        'Start time must be after than end time',
      );
    }

    try {
      const ticketType = await this.prisma.ticketType.create({
        data: { ...dto, startDate: utcStartDate, endDate: utcEndDate },
      });

      return ticketType;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException(
        'Unable to create ticket types for the event',
      );
    }
  }

  async createEventPromoCode(
    eventId: string,
    {
      absoluteDiscountAmount,
      percentageDiscountAmount,
      applyToTicketIds,
      ...dto
    }: CreateEventPromoCode,
  ) {
    try {
      const utcStartDate = combineDateAndTime(dto.startDate, dto.startTime);
      const utcEndDate = combineDateAndTime(dto.endDate, dto.endTime);
      const newPromoCode = await this.prisma.promoCode.create({
        data: {
          absoluteDiscountAmount: absoluteDiscountAmount || 0,
          key: dto.key,
          eventId: eventId,
          limit: dto.limit,
          name: dto.name,
          percentageDiscountAmount: percentageDiscountAmount || 0,
          promoEndDate: utcEndDate,
          promoStartDate: utcStartDate,
          ticketTypes: {
            connect: applyToTicketIds.map((ticketTypeId) => ({
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
        ticketTypes: {
          include: {
            tickets: {
              where: {
                order: {
                  paymentStatus: 'SUCCESSFUL',
                },
              },
            },
          },
        },
        addons: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    event.ticketTypes = event.ticketTypes.filter((ticketType, index) => {
      const soldQuantity = ticketType.tickets.length;

      event.ticketTypes[index]['soldQuantity'] = soldQuantity;
      // TODO: Handle the fact that it should not be showing in typescript also
      // Delete the tickets field
      delete event.ticketTypes[index].tickets;

      // removing ticket types that are not yet displayable
      if (ticketType.visibility === 'VISIBLE') {
        return true;
      } else if (ticketType.visibility === 'HIDDEN') {
        return false;
      } else if (ticketType.visibility === 'CUSTOM_SCHEDULE') {
        // check if it is within the time period the ticket should show
        // this is done by comparing if current date is within start and end date
        return isTicketTypeVisible(ticketType.startDate, ticketType.endDate);
      } else {
        return true;
      }
    });

    event['eventStatus'] = getEventStatus(event.endTime);

    return event as typeof event & EventStatus;
  }

  async getPromocode(dto: GetPromocodeDto) {
    const promocode = await this.prisma.promoCode.findFirst({
      where: {
        key: dto.key,
      },
      include: {
        ticketTypes: true,
        _count: {
          select: {
            order: {
              where: {
                paymentStatus: 'SUCCESSFUL',
              },
            },
          },
        },
      },
    });

    if (!promocode) {
      throw new NotFoundException('Invalid promocode');
    }

    return {
      ...promocode,
      isActive: isPromocodeActive(promocode, promocode._count.order),
    };
  }
  async getPromocodeById(id: string) {
    const promocode = await this.prisma.promoCode.findFirst({
      where: {
        id: id,
      },
      include: {
        ticketTypes: true,
        _count: {
          select: {
            order: {
              where: {
                paymentStatus: 'SUCCESSFUL',
              },
            },
          },
        },
      },
    });

    if (!promocode) {
      throw new NotFoundException('Promocode not found');
    }

    return {
      ...promocode,
      isActive: isPromocodeActive(promocode, promocode._count.order),
    };
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
      const nowUTC = new Date();
      const whereObject: Prisma.EventWhereInput = {
        isPublished: true,
        name: {
          contains: search,
          mode: 'insensitive',
        },
        startTime:
          eventStatus === 'past'
            ? {
                lt: nowUTC,
              }
            : eventStatus === 'upcoming'
              ? {
                  gt: nowUTC,
                }
              : undefined,
      };

      const [events, eventsCount] = await Promise.all([
        this.prisma.event.findMany({
          where: { ...whereObject },
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
          where: { ...whereObject },
          take,
          skip,
        }),
      ]);

      const extendedEvents = events.map((event) => {
        // let eventGross = 0;
        // let totalTickets = 0;
        // let totalSales = 0;
        const eventStatus = getEventStatus(event.endTime);

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
      const nowUTC = new Date();
      const whereObject: Prisma.EventWhereInput = {
        name: {
          contains: search,
          mode: 'insensitive',
        },
        startTime:
          eventStatus === 'past'
            ? {
                lt: nowUTC,
              }
            : eventStatus === 'upcoming'
              ? {
                  gt: nowUTC,
                }
              : undefined,
      };

      const [events, eventsCount] = await Promise.all([
        this.prisma.event.findMany({
          where: { ...whereObject },
          include: {
            _count: true,
            ticketTypes: {
              include: {
                tickets: {
                  where: {
                    order: {
                      paymentStatus: 'SUCCESSFUL',
                    },
                  },
                },
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
            ...whereObject,
          },
          take,
          skip,
        }),
      ]);

      const extendedEvents = events.map((event) => {
        let eventGross = 0;
        let totalTickets = 0;
        let totalSales = 0;
        const eventStatus = getEventStatus(event.endTime);

        event.ticketTypes.forEach((ticketType) => {
          eventGross =
            eventGross + ticketType.price * ticketType.tickets.length;

          totalTickets = totalTickets + ticketType.quantity;
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
          _count: {
            select: {
              order: {
                where: {
                  paymentStatus: 'SUCCESSFUL',
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      const extendedPromocodes = promocodes.map((promocode) => {
        return {
          ...promocode,
          isActive: isPromocodeActive(promocode, promocode._count.order),
          used: promocode._count.order,
        };
      });
      return extendedPromocodes;
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
    const nowUTC = new Date();
    const event = await this.prisma.event.findMany({
      where: {
        startTime: {
          gt: nowUTC,
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
    const nowUTC = new Date();
    const event = await this.prisma.event.findMany({
      where: {
        startTime: {
          lt: nowUTC,
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
    { startDate, startTime, endDate, endTime, ...dto }: UpdateEventDto,
    coverImage?: Express.Multer.File[],
    images?: Express.Multer.File[],
  ) {
    const utcStartTime = combineDateAndTime(startDate, startTime);
    const utcEndTime = combineDateAndTime(endDate, endTime);

    if (utcStartTime.getTime() > utcEndTime.getTime()) {
      throw new InternalServerErrorException(
        'End date must be after start date',
      );
    }

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
        data: {
          ...dto,
          images: newImages,
          coverImage: newCoverImage,
          startTime: utcStartTime,
          endTime: utcEndTime,
        },
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
    { startDate, startTime, endDate, endTime, ...dto }: UpdatEventTicketTypeDto,
  ) {
    const utcStartDate =
      dto.visibility === 'CUSTOM_SCHEDULE'
        ? combineDateAndTime(startDate, startTime)
        : null;
    const utcEndDate =
      dto.visibility === 'CUSTOM_SCHEDULE'
        ? combineDateAndTime(endDate, endTime)
        : null;

    if (
      dto.visibility === 'CUSTOM_SCHEDULE' &&
      utcEndDate.getTime() < utcStartDate.getTime()
    ) {
      throw new InternalServerErrorException(
        'Start time must be lesser than end time',
      );
    }

    const event = await this.prisma.ticketType.update({
      where: {
        id: ticketTypeId,
      },
      data: {
        ...dto,
        startDate: utcStartDate,
        endDate: utcEndDate,
        maxQty: dto.maxQty || null,
        minQty: dto.minQty || 1,
      },
    });

    return event;
  }

  async updatePromocode(
    promocodeId: string,
    {
      startDate,
      startTime,
      endDate,
      endTime,
      applyToTicketIds,
      ...dto
    }: UpdatePromocodeDto,
  ) {
    const utcStartDate = combineDateAndTime(startDate, startTime);
    const utcEndDate = combineDateAndTime(endDate, endTime);

    const promocode = await this.prisma.promoCode.findFirst({
      where: {
        id: promocodeId,
      },
    });

    if (!promocode) {
      throw new NotFoundException('Item to update not found');
    }

    const idsToRemove = promocode.ticketTypeIds
      .filter((ticketTypeId) => !applyToTicketIds.includes(ticketTypeId))
      .map((ticketTypeId) => ({
        id: ticketTypeId,
      }));

    const updatedPromocode = await this.prisma.promoCode.update({
      where: {
        id: promocodeId,
      },
      data: {
        ...dto,
        promoStartDate: utcStartDate,
        promoEndDate: utcEndDate,
        ticketTypes: {
          disconnect: idsToRemove,
          connect: applyToTicketIds.map((ticketTypeId) => ({
            id: ticketTypeId,
          })),
        },
      },
    });

    return updatedPromocode;
  }

  async getRevenue(eventId: string) {
    try {
      const orders = await this.prisma.order.findMany({
        where: {
          eventId: eventId,
          paymentStatus: 'SUCCESSFUL',
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

  async incPageView(dto: PageViewDto) {
    const eventId = dto.eventId;
    await this.prisma.pageView.upsert({
      where: {
        eventId,
      },
      create: { eventId, views: 1, createdAt: new Date() },
      update: { views: { increment: 1 } },
    });

    return;
  }

  async viewCount(dto: PageViewDto) {
    const eventId = dto.eventId;

    try {
      const pageView = await this.prisma.pageView.findFirst({
        where: {
          eventId,
        },
      });

      if (!pageView) {
        return {
          views: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
          eventId: dto.eventId,
        };
      }

      return pageView;
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Error fetching page view');
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

  async deleteEvent(eventId: Event['id']) {
    const eventDetails = await this.prisma.event.findFirst({
      where: {
        id: eventId,
      },
      include: {
        addons: {
          select: {
            id: true,
            addonOrder: {
              select: {
                id: true,
              },
            },
          },
        },
        order: {
          select: {
            id: true,
          },
        },
        ticketTypes: {
          select: {
            id: true,
            promoCodeIds: true,
            tickets: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    if (!eventDetails) {
      throw new NotFoundException('Event to delete not found');
    }

    // const allPromocodes = eventDetails.ticketTypes.reduce(
    //   (accValue: string[], ticketType) => {
    //     return accValue.concat(ticketType.promoCodeIds);
    //   },
    //   [],
    // );
    const allTickets = eventDetails.ticketTypes.reduce(
      (accValue: string[], ticketType) => {
        return accValue.concat(ticketType.tickets.map((ticket) => ticket.id));
      },
      [],
    );
    const allTicketTypes = eventDetails.ticketTypes.map(
      (ticketType) => ticketType.id,
    );
    const allAddonOrders = eventDetails.addons.reduce(
      (accValue: string[], addon) => {
        return accValue.concat(addon.addonOrder.map((ticket) => ticket.id));
      },
      [],
    );
    const allAddons = eventDetails.addons.map((addon) => addon.id);
    const allOrders = eventDetails.order.map((order) => order.id);

    // DELETE QUERIES
    const deletePromocodes = this.prisma.promoCode.deleteMany({
      where: {
        eventId: eventId,
      },
    });
    const deleteTickets = this.prisma.ticket.deleteMany({
      where: {
        id: {
          in: allTickets,
        },
      },
    });
    const deleteTicketTypes = this.prisma.ticketType.deleteMany({
      where: {
        id: {
          in: allTicketTypes,
        },
      },
    });
    const deleteAddonOrders = this.prisma.addonOrder.deleteMany({
      where: {
        id: {
          in: allAddonOrders,
        },
      },
    });
    const deleteAddons = this.prisma.eventAddons.deleteMany({
      where: {
        id: {
          in: allAddons,
        },
      },
    });
    const deleteOrders = this.prisma.eventAddons.deleteMany({
      where: {
        id: {
          in: allOrders,
        },
      },
    });
    const deletePageViews = this.prisma.pageView.deleteMany({
      where: {
        eventId: eventDetails.id,
      },
    });

    const deleteEvent = this.prisma.event.delete({
      where: {
        id: eventDetails.id,
      },
    });
    // TODO: Delete images from cloudinary
    // END DELETE QUERIES

    try {
      await this.prisma.$transaction([
        deletePromocodes,
        deleteTickets,
        deleteTicketTypes,
        deleteAddonOrders,
        deleteAddons,
        deleteOrders,
        deletePageViews,
        deleteEvent,
      ]);

      return {
        message: 'Event deleted successfully',
        eventId: eventId,
      };
    } catch (e) {
      console.log(e);
      throw new InternalServerErrorException('Error deleting event');
    }
  }

  async deleteTicketType(ticketTypeId: string) {
    const ticketType = await this.prisma.ticketType.findFirst({
      where: {
        id: ticketTypeId,
      },
      include: {
        tickets: true,
        promoCodes: true,
      },
    });

    if (!ticketType) {
      throw new NotFoundException('Ticket type not found');
    }

    const deletePromocodes = ticketType.promoCodeIds.map(
      (promocodeId, index) => {
        const ticketTypeIds = ticketType.promoCodes[index].ticketTypeIds.filter(
          (_ticketTypeId) => _ticketTypeId !== ticketTypeId,
        );
        return this.prisma.promoCode.updateMany({
          where: {
            id: promocodeId,
          },
          data: {
            ticketTypeIds: ticketTypeIds,
          },
        });
      },
    );

    const deleteTickets = this.prisma.ticket.deleteMany({
      where: {
        ticketTypeId: ticketTypeId,
      },
    });

    const deleteTicketType = this.prisma.ticketType.delete({
      where: {
        id: ticketTypeId,
      },
    });

    try {
      // Start a transaction to ensure atomic operations
      await this.prisma.$transaction([
        // Update PromoCodes to remove the deleted TicketType ID
        ...deletePromocodes,
        // Delete Tickets of tickettype
        deleteTickets,
        // Delete the TicketType
        deleteTicketType,
      ]);
      console.log('TicketType and related records deleted successfully');

      return {
        message: 'Ticket type successfully deleted',
        ticketTypeId: ticketTypeId,
        eventId: ticketType.eventId,
      };
    } catch (error) {
      console.error('Error deleting TicketType:', error);
    }
  }

  async deletePromocode(promocodeId: string) {
    const promocode = await this.prisma.promoCode.findFirst({
      where: {
        id: promocodeId,
      },
      include: {
        order: {
          select: {
            id: true,
          },
        },
        ticketTypes: {
          select: {
            id: true,
            promoCodeIds: true,
          },
        },
      },
    });

    const removeFromOrder = promocode.order.map((order) => {
      return this.prisma.order.update({
        where: {
          id: order.id,
        },
        data: {
          promocodeId: null,
        },
      });
    });
    // const removeFromTicketType = promocode.ticketTypes.map((ticketType) => {
    const removeFromTicketType = this.prisma.promoCode.update({
      where: {
        id: promocodeId,
      },
      data: {
        ticketTypes: {
          set: [],
        },
      },
    });
    // });
    const _deletePromocode = this.prisma.promoCode.delete({
      where: {
        id: promocodeId,
      },
    });

    try {
      // Start a transaction to ensure atomic operations
      await this.prisma.$transaction([
        // Update orders to remove the promocode
        ...removeFromOrder,
        // update the ticket types the promocode was applied to and remove it from it's array of promocodes
        removeFromTicketType,
        // Delete the TicketType
        _deletePromocode,
      ]);

      return {
        message: 'Promocode successfully deleted',
        promocodeId: promocodeId,
      };
    } catch (error) {
      console.error('Error deleting TicketType:', error);
    }
  }
}
