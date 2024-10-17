import { IsOptional, IsString } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;

  @IsOptional()
  @IsString()
  email?: string;
}
