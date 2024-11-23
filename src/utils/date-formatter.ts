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

export const getCurrentNewYorkDateTimeInUTC = () => {
  // Define the timezone

  // Get the current date in UTC
  const now = new Date();

  // Convert current time to New York time
  const newYorkTime = dateFnsTz.toZonedTime(now, newYorkTimeZone);
  // console.log('New york time (to zoned time)', newYorkTime.toISOString());

  // Convert New York time to UTC for Prisma query
  const utcDate = dateFnsTz.fromZonedTime(newYorkTime, newYorkTimeZone);
  // console.log('New york time to utc date', utcDate.toISOString());

  return utcDate;
};

export const convertDateToNewYorkTimeInUTC = (date: Date) => {
  // Convert current time to New York time
  const newYorkTime = dateFnsTz.toZonedTime(date, newYorkTimeZone);
  // console.log('New york time (to zoned time)', newYorkTime.toISOString());

  // Convert New York time to UTC for Prisma query
  const utcDate = dateFnsTz.fromZonedTime(newYorkTime, newYorkTimeZone);
  // console.log('New york time to utc date', utcDate.toISOString());

  return utcDate;
};

export const getEventStatus = (startTime: Date) => {
  const nowInNewYorkUTC = getCurrentNewYorkDateTimeInUTC();
  return startTime > nowInNewYorkUTC ? 'UPCOMING' : 'PAST';
};
