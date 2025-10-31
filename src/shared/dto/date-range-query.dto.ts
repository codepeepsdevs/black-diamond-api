import { Transform, Type } from 'class-transformer';
import { IsOptional, IsDate } from 'class-validator';
import { subMonths, startOfDay } from 'date-fns';
import { IsStartDateBeforeEndDate } from 'src/events/dto/custom-validator';

export class DateRangeQueryDto {
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @Transform(
    ({ value }) => {
      console.log('value', value);
      // Handle empty strings, null, undefined, or invalid dates
      if (!value || value === '' || value === null) {
        return subMonths(startOfDay(new Date()), 1);
      }

      const parsedDate = new Date(value);
      if (isNaN(parsedDate.getTime())) {
        return subMonths(startOfDay(new Date()), 1);
      }

      console.log(parsedDate);
      return parsedDate;
    },
    { toClassOnly: true },
  )
  startDate?: Date | undefined;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  @Transform(
    ({ value }) => {
      // Handle empty strings, null, undefined, or invalid dates
      if (!value || value === '' || value === null) {
        return startOfDay(new Date());
      }

      const parsedDate = new Date(value);
      if (isNaN(parsedDate.getTime())) {
        return startOfDay(new Date());
      }

      return parsedDate;
    },
    { toClassOnly: true },
  )
  @IsStartDateBeforeEndDate('startDate', {
    message: 'End date must be after start date',
  })
  endDate?: Date | undefined;
}
