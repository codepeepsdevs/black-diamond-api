import { Transform } from 'class-transformer';
import { IsOptional, IsDate } from 'class-validator';
import { subMonths, startOfDay } from 'date-fns';
import { IsStartDateBeforeEndDate } from 'src/events/dto/custom-validator';

export class DateRangeQueryDto {
  @IsOptional()
  @IsDate()
  // @Type(() => Date)
  @Transform(
    ({ value }) => {
      let date: Date;
      // If value is undefined or invalid, set default to one month ago
      if (!value || isNaN(Date.parse(value))) {
        date = subMonths(startOfDay(new Date()), 1); // One month ago, start of the day
      } else {
        date = new Date(value); // Otherwise, return the supplied date
      }
      return date;
    },
    { toClassOnly: true },
  )
  startDate?: Date | undefined;

  @IsOptional()
  @IsDate()
  // @Type(() => Date)
  @Transform(
    ({ value }) => {
      let date: Date;
      // If value is undefined or invalid, set default to today
      if (!value || isNaN(Date.parse(value))) {
        date = startOfDay(new Date()); // Today, start of the day
      } else {
        date = new Date(value); // Otherwise, return the supplied date
      }

      return date;
    },
    { toClassOnly: true },
  )
  @IsStartDateBeforeEndDate('startDate', {
    message: 'End date must be after start date',
  })
  endDate?: Date | undefined;
}
