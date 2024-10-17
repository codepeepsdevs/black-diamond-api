import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { PaginationQueryDto } from './dto/pagination-query.dto';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactusService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createContactDto: CreateContactDto,
    attachment?: Express.Multer.File,
  ) {
    return this.prisma.contactUs.create({
      data: { ...createContactDto, attachment: attachment.path },
    });
  }

  async findAll(paginationQuery: PaginationQueryDto) {
    const { page = 1, limit = 10, email } = paginationQuery;
    const skip = Math.abs((Number(page) - 1) * Number(limit));

    return this.prisma.contactUs.findMany({
      where: email ? { email } : undefined,
      skip,
      take: Number(limit),
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    return this.prisma.contactUs.findUnique({
      where: { id },
    });
  }
}
