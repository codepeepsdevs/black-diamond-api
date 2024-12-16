import { IsOptional } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;

  @IsOptional()
  search?: string;
}
