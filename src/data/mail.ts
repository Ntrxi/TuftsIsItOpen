import type { DateOverride, Location } from '../engine/types';
import { r } from '../engine/format';

// USPS observes federal holidays that Tufts does not (and vice versa).
const federalHolidays: DateOverride[] = [
  ['2026-09-07', 'Labor Day'],
  ['2026-10-12', 'Columbus Day'],
  ['2026-11-11', 'Veterans Day'],
  ['2026-11-26', 'Thanksgiving'],
  ['2026-12-25', 'Christmas Day'],
  ['2027-01-01', "New Year's Day"],
  ['2027-01-18', 'Martin Luther King Jr. Day'],
  ['2027-02-15', "Presidents' Day"],
  ['2027-05-31', 'Memorial Day'],
  ['2027-06-18', 'Juneteenth (observed)'],
  ['2027-07-05', 'Independence Day (observed)'],
].map(([from, name]) => ({ from: from!, hours: 'closed' as const, note: `Closed for ${name} (federal holiday)` }));

export const mail: Location[] = [
  {
    id: 'medford-mailroom',
    name: 'Medford Student Mailroom',
    category: 'mail',
    building: 'Campus Store lower level, 46 Professors Row',
    description:
      'Package pickup with your Tufts ID. Enter through the Campus Store front doors and take the stairs or elevator down.',
    hours: [[], [r('9am', '5pm')], [r('9am', '5pm')], [r('9am', '5pm')], [r('9am', '5pm')], [r('9am', '5pm')], []],
    holidays: 'closed',
    breaks: 'regular',
    overrides: [
      { from: '2026-08-28', hours: [r('8am', '5pm')], note: 'Move-in extended hours' },
      { from: '2026-09-02', hours: [r('8am', '5pm')], note: 'Move-in extended hours' },
      { from: '2026-09-06', hours: [r('10am', '4pm')], note: 'Move-in weekend hours' },
      { from: '2026-09-07', hours: [r('10am', '5pm')], note: 'Open Labor Day (move-in hours)' },
      { from: '2026-09-12', hours: [r('12pm', '4pm')], note: 'September Saturday hours' },
      { from: '2026-09-19', hours: [r('12pm', '4pm')], note: 'September Saturday hours' },
      { from: '2026-09-26', hours: [r('12pm', '4pm')], note: 'September Saturday hours' },
    ],
    links: {
      source: 'https://access.tufts.edu/mail-services-hours-and-contacts',
      schedule: 'https://access.tufts.edu/studentmail-fall',
    },
    note: 'Break hours follow the regular weekday schedule; closed on university holidays.',
    verified: '2026-09-07',
    confidence: 'high',
  },
  {
    id: 'campus-store',
    name: 'Campus Store (Bookstore)',
    category: 'mail',
    building: '46 Professors Row',
    description: 'Tufts University Official Bookstore, run by Barnes & Noble College. Textbooks, supplies, and Tufts gear.',
    hours: [[], [r('9am', '5pm')], [r('9am', '5pm')], [r('8am', '5pm')], [r('9am', '5pm')], [r('9am', '5pm')], [r('12pm', '4pm')]],
    holidays: 'closed',
    breaks: 'regular',
    overrides: [
      { from: '2026-09-07', hours: 'unknown', note: 'The bookstore lists Monday 10 AM–5 PM without calendar dates; Labor Day applicability is unconfirmed.' },
      {
        from: '2026-08-31',
        to: '2026-09-06',
        hours: [[r('10am', '4pm')], [r('10am', '5pm')], [r('9am', '5pm')], [r('8am', '5pm')], [r('9am', '5pm')], [r('9am', '5pm')], []],
        note: 'Back-to-school hours',
      },
    ],
    links: {
      source: 'https://tufts.bncollege.com/',
    },
    note: 'The store site lists hours without effective dates, and they changed between Sep 7 (Mon 10–5, Sun 10–4) and Sep 11 (Mon 9–5, Sun closed). The site is served behind Akamai bot protection with no machine-readable hours, so it cannot be read live; the pattern shown is not verified as a semester schedule. Confirm before a special trip.',
    verified: '2026-09-11',
    confidence: 'medium',
  },
  {
    id: 'tufts-post-office',
    name: 'Tufts Post Office (Curtis Hall)',
    category: 'mail',
    building: '470 Boston Ave (USPS)',
    description: 'USPS retail window with money orders, PO boxes, and package drop-off. Lobby open 9 AM – 5 PM weekdays. Last weekday collection 5:15 PM.',
    hours: [
      [],
      [r('9am', '1pm'), r('2pm', '5pm')],
      [r('9am', '1pm'), r('2pm', '5pm')],
      [r('9am', '1pm'), r('2pm', '5pm')],
      [r('9am', '1pm'), r('2pm', '5pm')],
      [r('9am', '1pm'), r('2pm', '5pm')],
      [],
    ],
    holidays: 'regular',
    breaks: 'regular',
    overrides: federalHolidays,
    links: {
      source: 'https://tools.usps.com/locations/details/1434341',
    },
    note: 'Closed 1–2 PM for lunch. Follows the federal holiday calendar, not the Tufts one.',
    verified: '2026-09-07',
    confidence: 'high',
  },
];
