import { PromoCode } from '@prisma/client';
import * as dateFnsTz from 'date-fns-tz';

export const newYorkTimeZone = 'America/New_York';

export function getTimeZoneDateRange(startDate: Date, endDate: Date) {
  const timeZoneAbbr = new Date(startDate || endDate || Date.now())
    .toLocaleTimeString('en-US', {
      timeZoneName: 'short',
      timeZone: newYorkTimeZone,
    })
    .split(' ')[2];
  return `${dateFnsTz.format(dateFnsTz.toZonedTime(startDate, newYorkTimeZone), 'EEEE, MMMM d · h:mmaaa', { timeZone: newYorkTimeZone })} - ${dateFnsTz.format(dateFnsTz.toZonedTime(endDate, newYorkTimeZone), `haaa '${timeZoneAbbr}'`, { timeZone: newYorkTimeZone })}`;
}

// export const getCurrentNewYorkDateTimeInUTC = () => {
//   // Define the timezone

//   // Get the current date in UTC
//   const now = new Date();

//   // Convert current time to New York time
//   const newYorkTime = dateFnsTz.toZonedTime(now, newYorkTimeZone);
//   // console.log('New york time (to zoned time)', newYorkTime.toISOString());

//   // Convert New York time to UTC for Prisma query
//   const utcDate = dateFnsTz.fromZonedTime(newYorkTime, newYorkTimeZone);
//   // console.log('New york time to utc date', utcDate.toISOString());

//   return utcDate;
// };

export const convertDateToNewYorkTimeInUTC = (date: Date) => {
  // Convert current time to New York time
  const newYorkTime = dateFnsTz.toZonedTime(date, newYorkTimeZone);
  // console.log('New york time (to zoned time)', newYorkTime.toISOString());

  // Convert New York time to UTC for Prisma query
  const utcDate = dateFnsTz.fromZonedTime(newYorkTime, newYorkTimeZone);
  // console.log('New york time to utc date', utcDate.toISOString());

  return utcDate;
};

export const getEventStatus = (endTime: Date) => {
  const nowUTC = new Date();
  // const zonedStartTime = dateFnsTz.toZonedTime(endTime, newYorkTimeZone);
  return endTime.getTime() > nowUTC.getTime() ? 'UPCOMING' : 'PAST';
};

export const isTicketTypeVisible = (startDate: Date, endDate: Date) => {
  const nowUTC = new Date();

  if (
    nowUTC.getTime() >= startDate.getTime() &&
    nowUTC.getTime() <= endDate.getTime()
  ) {
    return true;
  } else {
    return false;
  }
};

export const combineDateAndTime = (date: Date, time: string) => {
  const [hours, minutes] = time.split(':').map((value) => Number(value));
  date.setHours(hours, minutes, 0, 0);
  const utcDate = dateFnsTz.fromZonedTime(date, newYorkTimeZone);

  return utcDate;
};

export const isPromocodeActive = (promocode: PromoCode, orderCount: number) => {
  let isActive = false;
  const nowUTC = new Date();
  if (orderCount < promocode.limit) {
    isActive = true;
  } else if (
    nowUTC.getTime() >= promocode.promoStartDate.getTime() &&
    nowUTC.getTime() < promocode.promoEndDate.getTime()
  ) {
    isActive = true;
  } else {
    isActive = false;
  }

  return isActive;
};
