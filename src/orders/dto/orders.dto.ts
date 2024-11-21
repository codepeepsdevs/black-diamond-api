import { Gender } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  // IsNumber,
  IsString,
  ValidateNested,
} from 'class-validator';
import { DateRangeQueryDto } from 'src/shared/dto/date-range-query.dto';

export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TicketOrderDto)
  ticketOrders: TicketOrderDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddonOrderDto)
  addonOrders?: AddonOrderDto[];

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  promocodeId?: string;

  @IsString()
  @IsOptional()
  cancelUrl?: string;

  @IsString()
  @IsOptional()
  successUrl?: string;
}

export class TicketOrderDto {
  @IsMongoId()
  @IsNotEmpty()
  ticketTypeId: string;

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  quantity: number;
}

export class AddonOrderDto {
  @IsNumber()
  @Type(() => Number)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  addonId: string;
}

export class FillTicketDetailsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TicketDetails)
  tickets: TicketDetails[];

  @IsString()
  @IsNotEmpty()
  orderId: string;
}

class TicketDetails {
  @IsString()
  @IsNotEmpty()
  @IsMongoId()
  ticketId: string; // the ticket id

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  gender: Gender;
}

const EventStatus = ['all', 'past', 'upcoming'] as const;
export class UserOrderPaginationDto {
  @IsOptional()
  @IsString()
  // @IsIn(EventStatus, {
  //   message: 'event status must be one of the following: all, past, upcoming',
  // })
  eventStatus?: (typeof EventStatus)[number];

  @IsOptional()
  page: string;

  @IsOptional()
  limit: string;
}

export class GetRevenueQueryDto extends DateRangeQueryDto {}

export class GenerateOrderReportQueryDto extends DateRangeQueryDto {}

export class GetOrdersQuery extends DateRangeQueryDto {
  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  // @IsIn(EventStatus, {
  //   message: 'event status must be one of the following: all, past, upcoming',
  // })
  @Transform(({ value }) => {
    // Set to undefined if value is not 'all', 'upcoming', or 'past'
    return EventStatus.includes(value) ? value : undefined;
  })
  eventStatus?: (typeof EventStatus)[number];
}
