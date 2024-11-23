import { Gender } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsString, IsEmail, IsOptional, IsEnum } from 'class-validator';

export class CreatePromoterDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  @Transform(({ value }: { value: string }) => value.toLowerCase())
  email: string;

  @IsString()
  phoneNumber: string;

  @IsEnum(Gender)
  gender: Gender;

  @IsString()
  location: string;

  @IsOptional()
  @IsString()
  tiktokHandle?: string;

  @IsOptional()
  @IsString()
  instagramHandle?: string;

  @IsOptional()
  @IsString()
  twitterHandle?: string;

  @IsOptional()
  @IsString()
  facebookHandle?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
