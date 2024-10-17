import * as dateFns from 'date-fns';

export function getPDTDate(startDate: Date, endDate: Date) {
  return `${dateFns.format(startDate, 'EEEE, MMMM d · haaa')} - ${dateFns.format(endDate, "haaa 'PDT'")}`;
}
