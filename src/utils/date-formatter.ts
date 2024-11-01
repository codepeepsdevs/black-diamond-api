import * as dateFns from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export function getPDTDate(startDate: Date, endDate: Date) {
  return `${dateFns.format(startDate, 'EEEE, MMMM d · haaa')} - ${dateFns.format(endDate, "haaa 'PDT'")}`;
}

export const getCurrentNewYorkDateTimeInUTC = () => {
  // Define the timezone
  const timeZone = 'America/New_York';

  // Get the current date in UTC
  const now = new Date();

  // Convert current time to New York time
  const newYorkTime = toZonedTime(now, timeZone);
  console.log('New york time (to zoned time)', newYorkTime.toISOString());

  // Convert New York time to UTC for Prisma query
  const utcDate = fromZonedTime(newYorkTime, timeZone);
  console.log('New york time to utc date', utcDate.toISOString());

  return utcDate;
};

export const convertDateToNewYorkTimeInUTC = (date: Date) => {
  // Define the timezone
  const timeZone = 'America/New_York';

  // Convert current time to New York time
  const newYorkTime = toZonedTime(date, timeZone);
  console.log('New york time (to zoned time)', newYorkTime.toISOString());

  // Convert New York time to UTC for Prisma query
  const utcDate = fromZonedTime(newYorkTime, timeZone);
  console.log('New york time to utc date', utcDate.toISOString());

  return utcDate;
};

export const getEventStatus = (startTime: Date) => {
  const nowInNewYorkUTC = getCurrentNewYorkDateTimeInUTC();
  return startTime > nowInNewYorkUTC ? 'UPCOMING' : 'PAST';
};
