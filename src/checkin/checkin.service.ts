import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  CheckInByQRCodeDto,
  CheckInByIdDto,
  SearchTicketsDto,
  CheckInStatsDto,
  TicketCheckInInfo,
} from './dto/checkin.dto';
import { getPagination } from 'src/utils/get-pagination';
import { Prisma } from '@prisma/client';

@Injectable()
export class CheckinService {
  constructor(private prisma: PrismaService) {}

  async getTicketByCheckinCode(checkinCode: string) {
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        checkinCode,
        order: {
          paymentStatus: 'SUCCESSFUL',
        },
      },
      include: {
        ticketType: {
          select: {
            name: true,
          },
        },
        order: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found with this check-in code');
    }

    return {
      id: ticket.id,
      firstName: ticket.firstName,
      lastName: ticket.lastName,
      email: ticket.email,
      checkedIn: ticket.checkedIn,
      checkinCode: ticket.checkinCode,
      ticketType: ticket.ticketType,
      order: ticket.order,
    };
  }

  async checkInByQRCode(dto: CheckInByQRCodeDto) {
    console.log('dto', dto);
    const ticket = await this.prisma.ticket.findFirst({
      where: {
        checkinCode: dto.checkinCode,
      },
      include: {
        order: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found with this QR code');
    }

    if (ticket.checkedIn) {
      throw new BadRequestException('Ticket has already been checked in');
    }

    if (ticket.order.paymentStatus !== 'SUCCESSFUL') {
      throw new BadRequestException('Ticket order is not paid');
    }

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        checkedIn: true,
        checkedInAt: new Date(),
      },
    });

    return {
      message: 'Ticket checked in successfully',
    };
  }

  async checkInById(dto: CheckInByIdDto) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: dto.ticketId },
      include: {
        order: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (ticket.checkedIn) {
      throw new BadRequestException('Ticket has already been checked in');
    }

    if (ticket.order.paymentStatus !== 'SUCCESSFUL') {
      throw new BadRequestException('Ticket order is not paid');
    }

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        checkedIn: true,
        checkedInAt: new Date(),
      },
    });

    return {
      message: 'Ticket checked in successfully',
    };
  }

  async getTicketsForEvent(
    eventId: string,
    searchQuery: SearchTicketsDto,
  ): Promise<{
    tickets: TicketCheckInInfo[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    // Verify event exists, more performant than using joins when querying a large number of tickets and also allows database level filtering
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const { skip, take } = getPagination({
      _page: searchQuery.page,
      _limit: searchQuery.limit,
    });

    const whereClause: Prisma.TicketWhereInput = {
      order: {
        eventId: eventId,
        paymentStatus: 'SUCCESSFUL', // Only show paid tickets
      },
    };

    // Add search functionality
    if (searchQuery.search) {
      const s = searchQuery.search.trim();
      const isValidObjectId = /^[a-fA-F0-9]{24}$/.test(s);

      const orFilters: Prisma.TicketWhereInput[] = [
        {
          firstName: {
            contains: s,
            mode: 'insensitive',
          },
        },
        {
          lastName: {
            contains: s,
            mode: 'insensitive',
          },
        },
        {
          email: {
            contains: s,
            mode: 'insensitive',
          },
        },
        {
          checkinCode: {
            contains: s,
            mode: 'insensitive',
          },
        },
      ];

      if (isValidObjectId) {
        // Only search by id if it's a valid ObjectId; use equals
        orFilters.push({ id: s });
      }

      whereClause.OR = orFilters;
    }

    const [tickets, total] = await Promise.all([
      this.prisma.ticket.findMany({
        where: whereClause,
        include: {
          ticketType: {
            select: {
              name: true,
            },
          },
          order: {
            select: {
              id: true,
              status: true,
              paymentStatus: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take,
      }),
      this.prisma.ticket.count({
        where: whereClause,
      }),
    ]);

    const totalPages =
      searchQuery.limit > 0 ? Math.ceil(total / searchQuery.limit) : 1;

    return {
      tickets: tickets.map((ticket) => ({
        id: ticket.id,
        checkinCode: ticket.checkinCode,
        firstName: ticket.firstName,
        lastName: ticket.lastName,
        email: ticket.email,
        phone: ticket.phone,
        checkedIn: ticket.checkedIn,
        checkedInAt: ticket.checkedInAt,
        ticketType: ticket.ticketType,
        order: ticket.order,
      })),
      pagination: {
        page: searchQuery.page,
        limit: searchQuery.limit,
        total,
        totalPages,
      },
    };
  }

  async getCheckInStats(eventId: string): Promise<CheckInStatsDto> {
    // Verify event exists
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const [totalTickets, checkedInTickets] = await Promise.all([
      this.prisma.ticket.count({
        where: {
          order: {
            eventId: eventId,
            paymentStatus: 'SUCCESSFUL',
          },
        },
      }),
      this.prisma.ticket.count({
        where: {
          order: {
            eventId: eventId,
            paymentStatus: 'SUCCESSFUL',
          },
          checkedIn: true,
        },
      }),
    ]);

    const notCheckedInTickets = totalTickets - checkedInTickets;
    const checkInRate =
      totalTickets > 0 ? (checkedInTickets / totalTickets) * 100 : 0;

    return {
      totalTickets,
      checkedInTickets,
      notCheckedInTickets,
      checkInRate: Math.round(checkInRate * 100) / 100, // Round to 2 decimal places
    };
  }

  async undoCheckIn(ticketId: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: ticketId },
      include: {
        order: {
          include: {
            event: true,
          },
        },
        ticketType: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }

    if (!ticket.checkedIn) {
      throw new BadRequestException('Ticket is not checked in');
    }

    await this.prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        checkedIn: false,
        checkedInAt: null,
      },
    });

    return {
      message: 'Check-in undone successfully',
    };
  }
}
