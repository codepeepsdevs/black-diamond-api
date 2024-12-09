import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserInfoDto } from './dto/update.user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { excludePrisma } from 'src/helpers/exclude.helper';
import { AuthMethod, User } from '@prisma/client';
import { PaginationQueryDto } from 'src/shared/dto/pagination-query.dto';
import { GetUsersStatsDto } from './dto/users.dto';
import * as dateFns from 'date-fns';
import { convertDateToNewYorkTimeInUTC } from 'src/utils/helpers';
import * as XLSX from 'xlsx';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(
    dto: CreateUserDto & {
      authMethod: AuthMethod;
    },
  ) {
    const user = await this.findOneByEmail(dto.email);

    if (user) {
      throw new HttpException(
        'User with that email already exists',
        HttpStatus.BAD_REQUEST,
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          firstname: dto.firstname,
          lastname: dto.lastname,
          password: hashedPassword,
          authMethod: 'EMAIL',
          // Create related Address and BillingInfo with just their IDs
          address: {
            create: {},
          },
          billingInfo: {
            create: {},
          },
        },
        include: {
          address: true,
          billingInfo: true,
        },
      });

      user.password = undefined;
      return user;
    } catch (error) {
      console.log(error);
      throw new HttpException(
        'Something went wrong',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getUser(userId: User['id']) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        address: true,
        billingInfo: true,
      },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return excludePrisma(user, [
      'authMethod',
      'confirmToken',
      'refreshToken',
      'resetToken',
      'resetTokenExpiry',
      'password',
    ]);
  }

  async getUsers(paginationQuery: PaginationQueryDto) {
    const { page: _page, limit: _limit } = paginationQuery;
    const page = Number(_page);
    const limit = Number(_limit);
    const skip =
      !isNaN(page) && !isNaN(limit)
        ? Math.abs((page - 1) * Number(limit))
        : undefined;
    const take = limit ? Number(limit) : undefined;

    const [users, usersCount] = await Promise.all([
      this.prisma.user.findMany({
        include: {
          address: true,
          billingInfo: true,
          order: {
            where: {
              paymentStatus: 'SUCCESSFUL',
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take,
      }),
      this.prisma.user.count(),
    ]);
    // if (!user) {
    //   throw new NotFoundException('User not found');
    // }
    const _users = users.map((user) => {
      const amountSpent = user.order.reduce((accValue, currOrder) => {
        return (accValue += currOrder.amountPaid);
      }, 0);

      return excludePrisma(
        {
          ...user,
          billingInfo: user.billingInfo,
          address: user.address,
          amountSpent,
        },
        [
          'authMethod',
          'confirmToken',
          'refreshToken',
          'resetToken',
          'resetTokenExpiry',
          'password',
        ],
      );
    });

    return { users: _users, usersCount };
  }

  async exportUsersToExcel() {
    const { users } = await this.getUsers({
      page: undefined,
      limit: undefined,
    });
    // Format the data as a worksheet
    const worksheetData = users.map((user) => {
      return {
        ID: user.id,
        'First Name': user.firstname,
        'Last Name': user.lastname,
        Email: user.email,
        Phone: user.phone || 'N/A',
        City: user.address?.city || 'N/A',
        Country: user.address?.country || 'N/A',
        State: user.address?.state || 'N/A',
        'Date Joined': user.createdAt.toDateString(),
        'Amount Spent': `$${user.amountSpent.toFixed(2)}`,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);

    // Step 2: Create a workbook and add the worksheet
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'User Details');

    // Step 3: Write the workbook to a buffer
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return buffer;
  }

  async updateUserInfo(userId: string, updateUserInfoDto: UpdateUserInfoDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    // Update user info
    try {
      const { firstname, lastname, imgUrl, phone } = updateUserInfoDto;
      if (firstname || lastname) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { firstname, lastname, imgUrl, phone },
        });
      }
    } catch (e) {
      throw new InternalServerErrorException(
        'Something went wrong while updating user details',
      );
    }

    // Update address
    if (user.addressId) {
      try {
        await this.prisma.address.update({
          where: { id: user.addressId },
          data: {
            phone: updateUserInfoDto.addressPhone,
            address1: updateUserInfoDto.address1,
            address2: updateUserInfoDto.address2,
            city: updateUserInfoDto.city,
            country: updateUserInfoDto.country,
            zipCode: updateUserInfoDto.zipCode,
            state: updateUserInfoDto.state,
          },
        });
      } catch (e) {
        throw new InternalServerErrorException(
          'Something went wrong while updating user address.',
        );
      }
    } else {
      // Handle case where address doesn't exist, e.g., create it or throw an error
      throw new BadRequestException('Address not found for this user');
    }

    // Update billing info
    if (user.billingInfoId) {
      try {
        await this.prisma.billingInfo.update({
          where: { id: user.billingInfoId },
          data: {
            phone: updateUserInfoDto.billingPhone,
            address1: updateUserInfoDto.billingAddress1,
            address2: updateUserInfoDto.billingAddress2,
            city: updateUserInfoDto.billingCity,
            country: updateUserInfoDto.billingCountry,
            zipCode: updateUserInfoDto.billingZipCode,
            state: updateUserInfoDto.billingState,
          },
        });
      } catch (e) {
        throw new InternalServerErrorException(
          'Something went wrong while updating billing address',
        );
      }
    } else {
      // Handle case where billing info doesn't exist, e.g., create it or throw an error
      throw new BadRequestException('Billing info not found for this user');
    }

    const uptUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        address: true,
        billingInfo: true,
      },
    });

    return excludePrisma(uptUser, ['password']);
  }

  async remove(id: string) {
    return this.prisma.user.delete({
      where: { id },
    });
  }

  async changeEmail(id: string, newEmail: string) {
    return this.prisma.user.update({
      where: { id },
      data: { email: newEmail },
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid)
      throw new UnauthorizedException('Current password is incorrect');

    if (dto.newPassword !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    return { message: 'Password successfully changed' };
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });
    if (user && (await bcrypt.compare(password, user.password))) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async findOneByEmail(email: User['email']) {
    return await this.prisma.user.findUnique({
      where: {
        email,
      },
    });
  }

  async findOneById(userId: User['id']) {
    return await this.prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
  }

  async setCurrentRefreshToken(
    token: User['refreshToken'],
    userId: User['id'],
  ) {
    await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        refreshToken: token,
      },
    });
  }

  async removeRefreshToken(userId: User['id']) {
    const user = await this.findOneById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    user.refreshToken = undefined;
    this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        refreshToken: undefined,
      },
    });
  }

  async getUserIfRefreshTokenMatches(
    refreshToken: User['refreshToken'],
    userId: User['id'],
  ) {
    const user = await this.findOneById(userId);
    if (!user || user.refreshToken !== refreshToken) {
      throw new UnauthorizedException(
        'User is not authorized to make this request',
      );
    }
    return user;
  }

  async usersStats(query: GetUsersStatsDto) {
    const { page: _page, limit: _limit } = query;
    const page = Number(_page);
    const limit = Number(_limit);
    const skip =
      !isNaN(page) && !isNaN(limit)
        ? Math.abs((page - 1) * Number(limit))
        : undefined;
    const take = limit ? Number(limit) : undefined;

    const users1Count = await this.prisma.user.count({
      where: {
        createdAt: {
          gte: query.startDate,
          lte: query.endDate,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take,
    });

    let upTrend = true;

    if (query.endDate && query.startDate) {
      const daysDiff = dateFns.differenceInDays(query.endDate, query.startDate);

      const startDate2 = dateFns.subDays(query.startDate, daysDiff || 1);
      const endDate2 = dateFns.subMonths(query.endDate, daysDiff || 1);

      const users2Count = await this.prisma.user.count({
        where: {
          createdAt: {
            gte: startDate2,
            lte: endDate2,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take,
      });

      upTrend = users1Count > users2Count ? true : false;
    }

    return { usersCount: users1Count, upTrend };
  }

  async newUsersTodayStats() {
    // Get the start and end of the current day in New York time
    const startOfTodayNY = convertDateToNewYorkTimeInUTC(
      dateFns.startOfDay(new Date()),
    );
    const endOfTodayNY = convertDateToNewYorkTimeInUTC(
      dateFns.endOfDay(new Date()),
    );

    const startOfYesterdayNY = convertDateToNewYorkTimeInUTC(
      dateFns.subDays(dateFns.startOfDay(new Date()), 1),
    );

    const [newUsersTodayCount, newUsersYesterdayCount] = await Promise.all([
      await this.prisma.user.count({
        where: {
          createdAt: {
            gte: startOfTodayNY,
            lt: endOfTodayNY,
          },
        },
      }),
      await this.prisma.user.count({
        where: {
          createdAt: {
            gte: startOfYesterdayNY,
            lt: startOfTodayNY,
          },
        },
      }),
    ]);

    const upTrend = newUsersTodayCount > newUsersYesterdayCount ? true : false;

    return { newUsersCount: newUsersTodayCount, upTrend };
  }

  async adminUsersStats() {
    const adminsCount = await this.prisma.user.count({
      where: {
        role: 'admin',
      },
    });

    return { adminsCount };
  }
}
