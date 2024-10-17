import { IsOptional, IsString } from 'class-validator';

export class UpdateUserInfoDto {
  // User info fields
  @IsOptional()
  @IsString()
  firstname?: string;

  @IsOptional()
  @IsString()
  lastname?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  imgUrl?: string;

  @IsOptional()
  @IsString()
  addressPhone?: string;

  @IsOptional()
  @IsString()
  address1?: string;

  @IsOptional()
  @IsString()
  address2?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  zipCode?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  billingPhone?: string;

  @IsOptional()
  @IsString()
  billingAddress1?: string;

  @IsOptional()
  @IsString()
  billingAddress2?: string;

  @IsOptional()
  @IsString()
  billingCity?: string;

  @IsOptional()
  @IsString()
  billingCountry?: string;

  @IsOptional()
  @IsString()
  billingZipCode?: string;

  @IsOptional()
  @IsString()
  billingState?: string;
}
