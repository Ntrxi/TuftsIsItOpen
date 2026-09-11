import { addDays } from '../src/engine/time';

export const NOW = new Date('2026-09-10T16:00:00Z');
export const libcal = () => ({ locations: [20832, 20834, 20836, 15418, 14360].map((lid) => ({ lid, weeks: [Object.fromEntries(
  Array.from({ length: 8 }, (_, n) => { const date = addDays('2026-09-09', n); return [date, { date, times: { status: 'open', hours: [{ from: '9am', to: '9pm' }] } }]; }),
)] })) });

/** Shaped like the real "Open Hours" feed: weekly masters, an edited instance, removed holidays, an all-day closure. */
export const BRAY_OPEN_ICS = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Google Inc//Google Calendar 70.9054//EN', 'X-WR-CALNAME:Open Hours', 'X-WR-TIMEZONE:America/New_York',
  'BEGIN:VEVENT', 'DTSTART;TZID=America/New_York:20260907T100000', 'DTEND;TZID=America/New_York:20260907T200000',
  'RRULE:FREQ=WEEKLY;WKST=SU;UNTIL=20261215T045959Z;BYDAY=MO,WE,TU,TH',
  'EXDATE;TZID=America/New_York:20260907T100000', 'EXDATE;TZID=America/New_York:20261012T100000', 'EXDATE;TZID=America/New_York:20261125T100000', 'EXDATE;TZID=America/New_York:20261126T100000',
  'UID:weekday@google.com', 'STATUS:CONFIRMED', 'SUMMARY:Open Hours', 'END:VEVENT',
  'BEGIN:VEVENT', 'DTSTART;TZID=America/New_York:20260909T100000', 'DTEND;TZID=America/New_York:20260909T170000', 'UID:weekday@google.com',
  'RECURRENCE-ID;TZID=America/New_York:20260909T100000', 'STATUS:CONFIRMED', 'SUMMARY:Open Hours', 'END:VEVENT',
  'BEGIN:VEVENT', 'DTSTART;TZID=America/New_York:20260911T100000', 'DTEND;TZID=America/New_York:20260911T170000',
  'RRULE:FREQ=WEEKLY;WKST=SU;UNTIL=20261212T045959Z;BYDAY=FR', 'EXDATE;TZID=America/New_York:20261127T100000',
  'UID:friday@google.com', 'STATUS:CONFIRMED', 'SUMMARY:Open Hours', 'END:VEVENT',
  'BEGIN:VEVENT', 'DTSTART;TZID=America/New_York:20260912T120000', 'DTEND;TZID=America/New_York:20260912T170000',
  'RRULE:FREQ=WEEKLY;WKST=SU;UNTIL=20261215T045959Z;BYDAY=SA,SU', 'UID:weekend@google.com', 'STATUS:CONFIRMED', 'SUMMARY:Open Hours', 'END:VEVENT',
  'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20260914', 'DTEND;VALUE=DATE:20260915', 'UID:holiday@google.com', 'STATUS:CONFIRMED',
  'SUMMARY:University Holiday: Shop Closed', 'END:VEVENT',
  'BEGIN:VEVENT', 'DTSTART;TZID=America/New_York:20260915T130000', 'DTEND;TZID=America/New_York:20260915T140000', 'UID:consult@google.com',
  'STATUS:CONFIRMED', 'SUMMARY:ME74 consultations', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

/** Shaped like the real "In-Shop Labs" feed: course labs (not closures) and a timed heat closure in UTC. */
export const BRAY_LABS_ICS = [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Google Inc//Google Calendar 70.9054//EN', 'X-WR-CALNAME:In-Shop Labs',
  'BEGIN:VEVENT', 'DTSTART;TZID=America/New_York:20260910T120000', 'DTEND;TZID=America/New_York:20260910T131500',
  'RRULE:FREQ=WEEKLY;WKST=SU;UNTIL=20261215T045959Z;BYDAY=TH', 'UID:me10@google.com', 'STATUS:CONFIRMED', 'SUMMARY:ME10 L1', 'END:VEVENT',
  'BEGIN:VEVENT', 'DTSTART:20260910T190000Z', 'DTEND:20260910T201500Z', 'UID:heat@google.com', 'STATUS:CONFIRMED',
  'SUMMARY:Machine Shop Closed (due to heat)', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

export function feedBody(url: string): unknown {
  if (url.includes('libcal')) return libcal();
  if (url.includes('passiogo')) return { buses: { a: { busId: '1', routeId: '63771', outOfService: 0 } } };
  if (url.includes('carmichael')) return { days: [{ date: '2026-09-12', menu_items: [{ text: 'Closed for testing', is_holiday: true, food: null }] }] };
  if (url.includes('calendar.google.com')) return url.includes('braypalls') ? BRAY_LABS_ICS : BRAY_OPEN_ICS;
  return { days: [] };
}
export const response = (value: unknown) => typeof value === 'string'
  ? new Response(value, { headers: { 'content-type': 'text/calendar; charset=utf-8' } })
  : new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
