import type { Location, WeekHours } from '../engine/types';
import { r } from '../engine/format';

const PUBLIC = 'Open to public';
const LATE = 'Tufts ID only · late-night study';

// Tisch building hours (Fall 2026, from LibCal lid 20832). Public access ends 9 PM daily.
const tischWeek: WeekHours = [
  [r('8:45am', '9pm', PUBLIC), r('9pm', '4am', LATE, 'special')], // Sun
  [r('7:45am', '9pm', PUBLIC), r('9pm', '4am', LATE, 'special')], // Mon
  [r('7:45am', '9pm', PUBLIC), r('9pm', '4am', LATE, 'special')],
  [r('7:45am', '9pm', PUBLIC), r('9pm', '4am', LATE, 'special')],
  [r('7:45am', '9pm', PUBLIC), r('9pm', '4am', LATE, 'special')], // Thu
  [r('7:45am', '9pm', PUBLIC), r('9pm', '10:45pm', LATE, 'special')], // Fri
  [r('8:45am', '9pm', PUBLIC), r('9pm', '10:45pm', LATE, 'special')], // Sat
];

export const library: Location[] = [
  {
    id: 'tisch-library',
    name: 'Tisch Library',
    category: 'library',
    building: '35 Professors Row',
    description:
      'Main library. After the main desk closes (11 PM Sun–Thu, 9 PM Fri–Sat) the building stays open for late-night study with self-checkout; a Tufts ID is required after 9 PM.',
    hours: tischWeek,
    holidays: 'closed',
    breaks: 'unknown',
    periods: [
      {
        period: 'thanksgiving-2026',
        hours: 'unknown',
        note: 'Tisch building hours after Nov 28 are not yet set in LibCal',
      },
    ],
    overrides: [
      { from: '2026-08-31', to: '2026-09-04', hours: [r('8:45am', '9pm')], note: 'Pre-semester hours' },
      { from: '2026-09-05', to: '2026-09-06', hours: 'closed', note: 'Closed Labor Day weekend' },
      { from: '2026-10-12', hours: 'regular', note: 'Regular building hours published in LibCal' },
      { from: '2026-11-11', hours: 'regular', note: 'Regular building hours published in LibCal' },
      { from: '2026-11-25', hours: [r('7:45am', '6pm', PUBLIC)], note: 'Published Thanksgiving hours' },
      { from: '2026-11-26', to: '2026-11-28', hours: 'closed', note: 'Closed for Thanksgiving per LibCal' },
    ],
    links: {
      source: 'https://tischlibrary.tufts.edu/about-library/visit/hours',
      schedule: 'https://tufts.libcal.com/hours',
    },
    validThrough: '2026-11-28',
    note: 'Hours update live from the library calendar. Building hours after Nov 28 are not yet set; no finals schedule is assumed.',
    verified: '2026-09-07',
    confidence: 'high',
  },
  {
    id: 'ginn-library',
    name: 'Ginn Library',
    category: 'library',
    building: 'Mugar Hall, 1st floor (Fletcher School)',
    description: 'Fletcher School library, open to all Tufts students. Public access ends 9 PM.',
    hours: [
      [r('10am', '9pm'), r('9pm', '11pm', 'Tufts ID only', 'special')], // Sun
      [r('8am', '9pm'), r('9pm', '11pm', 'Tufts ID only', 'special')],
      [r('8am', '9pm'), r('9pm', '11pm', 'Tufts ID only', 'special')],
      [r('8am', '9pm'), r('9pm', '11pm', 'Tufts ID only', 'special')],
      [r('8am', '9pm'), r('9pm', '11pm', 'Tufts ID only', 'special')],
      [r('8am', '7pm')], // Fri
      [r('10am', '7pm')], // Sat
    ],
    holidays: 'closed',
    breaks: 'unknown',
    periods: [
      {
        period: 'thanksgiving-2026',
        hours: [[r('10am', '9pm'), r('9pm', '11pm', 'Tufts ID only', 'special')], [], [], [r('8am', '5pm')], [], [], []],
        note: 'Thanksgiving recess hours',
      },
    ],
    overrides: [
      { from: '2026-08-31', to: '2026-09-04', hours: [r('9am', '5pm')], note: 'Pre-semester hours' },
      { from: '2026-09-05', to: '2026-09-06', hours: 'closed', note: 'Closed Labor Day weekend' },
      { from: '2026-10-12', hours: 'regular', note: 'Regular building hours published in LibCal' },
      { from: '2026-11-11', hours: 'regular', note: 'Regular building hours published in LibCal' },
      { from: '2026-12-23', hours: [r('8am', '5pm')], note: 'Winter break hours' },
      { from: '2026-12-24', to: '2027-01-03', hours: 'closed', note: 'Closed for winter break' },
      { from: '2027-01-04', to: '2027-01-10', hours: [[], [r('9am', '5pm')], [r('9am', '5pm')], [r('9am', '5pm')], [r('9am', '5pm')], [r('9am', '5pm')], []], note: 'Published January break hours' },
      { from: '2027-01-11', to: '2027-01-17', hours: [[], [r('8am', '5pm')], [r('8am', '5pm')], [r('8am', '5pm')], [r('8am', '5pm')], [r('8am', '5pm')], []], note: 'Published January break hours' },
    ],
    links: {
      source: 'https://ginnlibrary.tufts.edu/about-library/visit/hours',
      schedule: 'https://tufts.libcal.com/hours',
    },
    validThrough: '2027-01-18',
    note: 'LibCal hours from Jan 19 onward are not yet set; no spring schedule is assumed.',
    verified: '2026-09-07',
    confidence: 'high',
  },
  {
    id: 'lilly-music-library',
    name: 'Lilly Music Library',
    category: 'library',
    building: 'Granoff Music Center, room M030',
    hours: [
      [r('12pm', '10pm')], // Sun
      [r('9am', '10pm')],
      [r('9am', '10pm')],
      [r('9am', '10pm')],
      [r('9am', '10pm')],
      [r('9am', '6pm')], // Fri
      [r('12pm', '6pm')], // Sat
    ],
    holidays: 'closed',
    breaks: 'unknown',
    overrides: [
      { from: '2026-10-10', hours: [r('10am', '6pm')], note: 'Parents and Family Weekend' },
      { from: '2026-11-24', hours: [r('9am', '5pm')], note: 'Thanksgiving hours' },
      { from: '2026-11-25', to: '2026-11-28', hours: 'closed', note: 'Closed for Thanksgiving' },
      { from: '2026-11-29', hours: [r('2pm', '10pm')], note: 'Thanksgiving Sunday hours' },
      { from: '2026-12-23', hours: [r('9am', '5pm')], note: 'Last day of finals' },
      { from: '2026-12-24', to: '2027-01-03', hours: 'closed', note: 'Closed for winter break' },
      { from: '2027-01-04', to: '2027-01-17', hours: [[], [r('11am', '5pm')], [r('11am', '5pm')], [r('11am', '5pm')], [r('11am', '5pm')], [r('11am', '5pm')], []], note: 'Published January break hours' },
      { from: '2027-01-19', hours: 'regular', note: 'Regular Lilly hours resume Jan 19 per LibCal' },
      { from: '2026-08-31', to: '2026-09-04', hours: [r('11am', '5pm')], note: 'Pre-semester hours from Lilly LibCal calendar' },
      { from: '2026-09-05', to: '2026-09-06', hours: 'closed', note: 'Closed Labor Day weekend' },
    ],
    links: {
      source: 'https://tufts.libcal.com/hours',
      schedule: 'https://tufts.libcal.com/hours',
    },
    verified: '2026-09-07',
    confidence: 'high',
  },
];
