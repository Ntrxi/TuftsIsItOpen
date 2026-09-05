import type { Location, WeekHours } from '../engine/types';
import { r } from '../engine/format';

const PUBLIC = 'Open to public';
const LATE = 'Tufts ID only · late-night study';

// Tisch building hours (Fall 2026, from LibCal lid 20832). Public access ends 9 PM daily.
const tischWeek: WeekHours = [
  [r('8:45am', '9pm', PUBLIC), r('9pm', '4am', LATE)], // Sun
  [r('7:45am', '9pm', PUBLIC), r('9pm', '4am', LATE)], // Mon
  [r('7:45am', '9pm', PUBLIC), r('9pm', '4am', LATE)],
  [r('7:45am', '9pm', PUBLIC), r('9pm', '4am', LATE)],
  [r('7:45am', '9pm', PUBLIC), r('9pm', '4am', LATE)], // Thu
  [r('7:45am', '9pm', PUBLIC), r('9pm', '10:45pm', LATE)], // Fri
  [r('8:45am', '9pm', PUBLIC), r('9pm', '10:45pm', LATE)], // Sat
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
        // Sunday after the recess follows the regular schedule; LibCal overrides this once published.
        hours: [tischWeek[0], [], [], [r('7:45am', '6pm')], [], [], []],
        note: 'Thanksgiving recess hours (confirm on the library calendar)',
      },
    ],
    overrides: [
      { from: '2026-08-31', to: '2026-09-04', hours: [r('8:45am', '9pm')], note: 'Pre-semester hours' },
      { from: '2026-09-05', to: '2026-09-06', hours: 'closed', note: 'Closed Labor Day weekend' },
    ],
    links: {
      source: 'https://tischlibrary.tufts.edu/about-library/visit/hours',
      schedule: 'https://tufts.libcal.com/hours',
    },
    note: 'Hours update live from the library calendar.',
    verified: '2026-09-03',
    confidence: 'high',
  },
  {
    id: 'ginn-library',
    name: 'Ginn Library',
    category: 'library',
    building: 'Mugar Hall, 1st floor (Fletcher School)',
    description: 'Fletcher School library, open to all Tufts students. Public access ends 9 PM.',
    hours: [
      [r('10am', '11pm')], // Sun
      [r('8am', '11pm')],
      [r('8am', '11pm')],
      [r('8am', '11pm')],
      [r('8am', '11pm')],
      [r('8am', '7pm')], // Fri
      [r('10am', '7pm')], // Sat
    ],
    holidays: 'closed',
    breaks: 'unknown',
    periods: [
      {
        period: 'thanksgiving-2026',
        hours: [[r('10am', '11pm')], [], [], [r('8am', '5pm')], [], [], []],
        note: 'Thanksgiving recess hours',
      },
      {
        period: 'winter-2026',
        hours: [[], [r('9am', '5pm')], [r('9am', '5pm')], [r('9am', '5pm')], [r('9am', '5pm')], [r('9am', '5pm')], []],
        note: 'Winter break hours',
      },
    ],
    overrides: [
      { from: '2026-08-31', to: '2026-09-04', hours: [r('9am', '5pm')], note: 'Pre-semester hours' },
      { from: '2026-09-05', to: '2026-09-06', hours: 'closed', note: 'Closed Labor Day weekend' },
      { from: '2026-12-23', hours: [r('8am', '5pm')], note: 'Winter break hours' },
      { from: '2026-12-24', to: '2027-01-03', hours: 'closed', note: 'Closed for winter break' },
    ],
    links: {
      source: 'https://ginnlibrary.tufts.edu/about-library/visit/hours',
      schedule: 'https://tufts.libcal.com/hours',
    },
    verified: '2026-09-03',
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
      { from: '2026-08-31', to: '2026-09-04', hours: [r('9am', '5pm')], note: 'Pre-semester hours' },
      { from: '2026-09-05', to: '2026-09-06', hours: 'closed', note: 'Closed Labor Day weekend' },
    ],
    links: {
      source: 'https://tufts.libcal.com/hours',
      schedule: 'https://tufts.libcal.com/hours',
    },
    verified: '2026-09-03',
    confidence: 'high',
  },
];
