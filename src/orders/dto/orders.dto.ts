import { Gender } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
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

  @IsOptional()
  @IsBoolean()
  eventUpdates: boolean;

  @IsString()
  @IsOptional()
  promocodeId?: string;

}

export class TicketOrderDto {
  @IsMongoId()
  @IsNotEmpty()
  ticketTypeId: string;

  @IsNotEmpty()
  @IsInt()
  @Type(() => Number)
  quantity: number;
}

export class AddonOrderDto {
  @IsInt()
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
  @Transform(({ value }: { value: string }) => value.toLowerCase())
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

// export class GeneratePartyListDto {
//   @IsNotEmpty({ message: 'Event to generate party list for is required' })
//   @IsString({ message: 'Event to generate party list for is required' })
//   eventId: string;
// }

export class GetOrdersQuery extends DateRangeQueryDto {
  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
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

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    const allowed = ['PENDING', 'SUCCESSFUL', 'FAILED', 'CANCELLED', 'PROCESSING', 'all'];
    if (typeof value !== 'string') return undefined;
    const v = value.toUpperCase();
    return allowed.includes(v) ? (v === 'ALL' ? undefined : v) : undefined;
  })
  paymentStatus?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => {
    const allowed = ['PENDING', 'COMPLETED', 'CANCELLED', 'all'];
    if (typeof value !== 'string') return undefined;
    const v = value.toUpperCase();
    return allowed.includes(v) ? (v === 'ALL' ? undefined : v) : undefined;
  })
  status?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' && value.length === 24 ? value : undefined))
  eventId?: string;
}

export class BulkReconcileDto {
  @IsArray()
  @IsMongoId({ each: true })
  @IsNotEmpty()
  orderIds: string[];
}
