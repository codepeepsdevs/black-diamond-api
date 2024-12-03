import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';
import { IsAOrB, IsStartDateBeforeEndDate } from './custom-validator';
import { LocationType, TicketTypeVisibility } from '@prisma/client';
import { Optional } from '@nestjs/common';

// class TicketTypeDto {
//   @IsString()
//   name: string;

//   @IsNumber()
//   @Type(() => Number)
//   maxSale: number;

//   @IsDate()
//   @Type(() => Date)
//   startDate: Date;

//   @IsDate()
//   @Type(() => Date)
//   endDate: Date;

//   @IsNumber()
//   @Type(() => Number)
//   price: number;

//   @IsNumber()
//   @Type(() => Number)
//   fee: number;

//   // @IsString()
//   // eventId: string;
// }

export class CreateEventDetailsDto {
  @IsString()
  name: string;

  @IsString()
  summary: string;

  @IsOptional()
  @IsString()
  description: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights: string[]; // images of past events

  // @IsArray()
  // @IsString({ each: true })
  // images: string[]; // images, graphics or flyers for event promotion

  // @IsString()
  // coverImage: string; // poster image/graphic for the event thumbnail

  @IsOptional()
  @IsString()
  location: string;

  @IsDate()
  @Type(() => Date)
  startTime: Date;

  @IsDate()
  @Type(() => Date)
  @IsStartDateBeforeEndDate('startTime', {
    message: 'End date-time must be after start-time date',
  })
  endTime: Date;

  // @IsDate()
  // @Type(() => Date)
  // startDateOfSale: Date;

  // @IsDate()
  // @Type(() => Date)
  // endDateOfSale: Date;

  // @IsArray()
  // @ValidateNested({ each: true })
  // @Type(() => TicketTypeDto)
  // ticketTypes: TicketTypeDto[];

  @IsOptional()
  @IsString()
  refundPolicy: string;

  @IsOptional()
  @IsString()
  locationType: LocationType;

  // @IsNumber()
  // @Type(() => Number)
  // price: number;
}

export class CreateEventTicketTypeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  quantity: number;

  @ValidateIf((dto) => dto.visibility === 'CUSTOM_SCHEDULE')
  @IsDate({ message: 'Start date must be a valid date' })
  @Type(() => Date)
  @IsNotEmpty({
    message: 'Start date is required when visibility is a custom schedule',
  })
  startDate: Date;

  @ValidateIf((dto) => dto.visibility === 'CUSTOM_SCHEDULE')
  @IsString({ message: 'Start time must be a string' })
  @IsNotEmpty({
    message: 'Start time is required when visibility is a custom schedule',
  })
  startTime: string;

  @ValidateIf((dto) => dto.visibility === 'CUSTOM_SCHEDULE')
  @IsDate({ message: 'End date must be a valid date' })
  @Type(() => Date)
  @IsNotEmpty({
    message: 'End date is required when visibility is custom schedule',
  })
  endDate: Date;

  @ValidateIf((dto) => dto.visibility === 'CUSTOM_SCHEDULE')
  @IsString({ message: 'End time must be a string' })
  @IsNotEmpty({
    message: 'End time is required when visibility is custom schedule',
  })
  endTime: string;

  @Type(() => Number)
  @IsNotEmpty()
  price: number;

  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsEnum(TicketTypeVisibility, {
    message:
      'Visibility must be on of hidden, visible, custom, hidden when not on sale',
  })
  visibility: TicketTypeVisibility;

  @ValidateIf((o) => o.maxQty != undefined) // Only validate if minQty is provided
  @Optional()
  @IsInt({ message: 'minQty must be a number' })
  @Min(1, { message: 'minQty must be at least 1' })
  @Type(() => Number)
  minQty?: number;

  @ValidateIf((o) => o.maxQty != undefined) // Only validate if maxQty is provided
  @Optional()
  @IsInt({ message: 'maxQty must be a number' })
  @Min(1, { message: 'maxQty must be at least 1' })
  @Type(() => Number)
  maxQty?: number;
}

export class CreateEventPromoCode {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  key: string;

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  limit: number;

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  @IsOptional()
  absoluteDiscountAmount?: number;

  @IsAOrB(
    { fieldA: 'percentageDiscountAmount', fieldB: 'absoluteDiscountAmount' },
    {
      message:
        'Either Percentage Discount Amount or Absolute Discount Amount must be present, but not both.',
    },
  )
  condition: boolean;

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  @IsOptional()
  percentageDiscountAmount?: number;

  @IsDate()
  @Type(() => Date)
  @IsNotEmpty()
  promoStartDate: Date;

  @IsDate()
  @Type(() => Date)
  promoEndDate: Date;

  @IsArray()
  @IsString({ each: true })
  applyToTicketIds: string[];
}

export class GetPromocodeDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  // @IsString()
  // @IsNotEmpty()
  // eventId: string;
}

export class CreateEventAddonDto {
  @IsString()
  @IsNotEmpty()
  eventId: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @Type(() => Number)
  @IsNumber()
  price: number;

  @IsNumber()
  @Type(() => Number)
  totalQuantity: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  // @IsString()
  // @IsNotEmpty()
  // image: string;

  @IsNumber()
  @Type(() => Number)
  minimumQuantityPerOrder: number;

  @IsNumber()
  @Type(() => Number)
  maximumQuantityPerOrder: number;

  @IsDate()
  @Type(() => Date)
  startTime: Date;

  @IsDate()
  @Type(() => Date)
  endTime: Date;

  // @IsBoolean()
  // @Type(() => Boolean)
  // showSaleAndStatusOnCheckout: boolean;

  // @IsBoolean()
  // @Type(() => Boolean)
  // visible: boolean;

  // @IsBoolean()
  // @Type(() => Boolean)
  // eTicket: boolean;

  // @IsBoolean()
  // @Type(() => Boolean)
  // willCall: boolean;
}

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[]; // images of past events

  // @IsArray()
  // @IsString({ each: true })
  // images: string[]; // images, graphics or flyers for event promotion

  // @IsString()
  // coverImage: string; // poster image/graphic for the event thumbnail

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  locationType?: LocationType;

  @IsDate()
  @Type(() => Date)
  startTime?: Date;

  @IsDate()
  @Type(() => Date)
  endTime?: Date;

  // @IsDate()
  // @Type(() => Date)
  // startDateOfSale: Date;

  // @IsDate()
  // @Type(() => Date)
  // endDateOfSale: Date;

  // @IsArray()
  // @ValidateNested({ each: true })
  // @Type(() => TicketTypeDto)
  // ticketTypes: TicketTypeDto[];

  @IsOptional()
  @IsString()
  refundPolicy?: string;

  // @IsNumber()
  // @Type(() => Number)
  // price: number;
}

export class UpdatEventTicketTypeDto {
  @IsOptional()
  @IsString()
  name: string;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  quantity: number;

  @ValidateIf(
    (dto: UpdatEventTicketTypeDto) => dto.visibility === 'CUSTOM_SCHEDULE',
  )
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @ValidateIf(
    (dto: UpdatEventTicketTypeDto) => dto.visibility === 'CUSTOM_SCHEDULE',
  )
  @IsString()
  @IsNotEmpty()
  startTime: string;

  @ValidateIf(
    (dto: UpdatEventTicketTypeDto) => dto.visibility === 'CUSTOM_SCHEDULE',
  )
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @ValidateIf(
    (dto: UpdatEventTicketTypeDto) => dto.visibility === 'CUSTOM_SCHEDULE',
  )
  @IsString()
  @IsNotEmpty()
  endTime: string;

  @IsOptional()
  @Type(() => Number)
  price: number;

  @IsString()
  @IsEnum(TicketTypeVisibility, {
    message:
      'Visibility must be on of hidden, visible, custom, hidden when not on sale',
  })
  visibility: TicketTypeVisibility;

  @ValidateIf((o) => o.maxQty != undefined) // Only validate if minQty is provided
  @Optional()
  @IsInt({ message: 'minQty must be a number' })
  @Min(1, { message: 'minQty must be at least 1' })
  @Type(() => Number)
  minQty?: number;

  @ValidateIf((o) => o.maxQty != undefined) // Only validate if maxQty is provided
  @Optional()
  @IsInt({ message: 'maxQty must be a number' })
  @Min(1, { message: 'maxQty must be at least 1' })
  @Type(() => Number)
  maxQty?: number;
}

const EventStatus = ['all', 'past', 'upcoming'] as const;

export class EventStatusQuery {
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
export class EventStatusPaginationQueryDto extends EventStatusQuery {
  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

export class RemoveImageDto {
  @IsString({ message: 'Image to delete must be provided' })
  @IsNotEmpty({ message: 'Image to delete must be provided' })
  image: string;
}
