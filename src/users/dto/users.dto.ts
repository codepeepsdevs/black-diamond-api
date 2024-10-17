import { IsOptional, IsString } from 'class-validator';
import { DateRangeQueryDto } from 'src/shared/dto/date-range-query.dto';

export class GetUsersStatsDto extends DateRangeQueryDto {
  @IsOptional()
  page?: string;

  @IsOptional()
  limit?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
