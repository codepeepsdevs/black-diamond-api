import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CreateSubscriberDto {
  @IsString()
  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase())
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;
}

export class BulkCreateSubscriberDto {
  @IsArray()
  @Type(() => CreateSubscriberDto)
  @ValidateNested({ each: true })
  subscribers: CreateSubscriberDto[];
}

export class UpdateSubscriberDto {}
