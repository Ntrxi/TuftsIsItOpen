import type { Location, WeekHours } from '../engine/types';
import { r } from '../engine/format';

const REC = 'Rec swim';

const summerFitness: WeekHours = [
  [r('4pm', '8pm')], // Sun
  [r('7am', '8:30pm')],
  [r('7am', '8:30pm')],
  [r('7am', '8:30pm')],
  [r('7am', '8:30pm')],
  [r('7am', '6pm')], // Fri
  [r('8am', '12pm')], // Sat
];

export const recreation: Location[] = [
  {
    id: 'tisch-fitness-center',
    name: 'Tisch Sports & Fitness Center',
    category: 'recreation',
    building: '161 College Ave',
    description: 'Fitness center, gym, squash courts, and pool. Tufts ID or membership required.',
    hours: [
      [r('10am', '10:30pm')], // Sun
      [r('6:30am', '11pm')],
      [r('6:30am', '11pm')],
      [r('6:30am', '11pm')],
      [r('6:30am', '11pm')],
      [r('6:30am', '11pm')], // Fri
      [r('8am', '8pm')], // Sat
    ],
    holidays: 'regular',
    breaks: 'regular',
    periods: [
      { period: 'thanksgiving-2026', hours: 'closed', note: 'Closed Nov 25–28' },
    ],
    overrides: [
      { from: '2026-11-25', to: '2026-11-28', hours: 'closed', note: 'Closed for Thanksgiving' },
      { from: '2026-11-29', hours: 'regular', note: 'Reopens after Thanksgiving' },
      { from: '2026-12-23', to: '2027-01-04', hours: 'closed', note: 'Closed for winter break' },
      { from: '2027-01-05', to: '2027-01-19', hours: 'regular', note: 'Open during January break' },
      { from: '2027-05-23', hours: 'closed', note: 'Closed May 23' },
      { from: '2027-05-24', to: '2027-07-02', hours: summerFitness, note: 'Published summer hours begin May 24' },
      { from: '2027-07-03', to: '2027-07-05', hours: 'closed', note: 'Closed for Independence Day' },
      { from: '2027-07-06', to: '2027-08-06', hours: summerFitness, note: 'Published summer hours end Aug 6' },
      { from: '2027-08-07', to: '2027-08-24', hours: 'closed', note: 'Closed for annual maintenance' },
    ],
    links: {
      source: 'https://gotuftsjumbos.com/sports/2022/5/6/facilities-Reservation.aspx',
    },
    validThrough: '2027-08-24',
    note: 'Published Aug 26–Dec 22 fall hours include Labor Day; no Sep 7 closure is listed. Spring hours run Jan 5–May 22; summer hours May 24–Aug 6.',
    verified: '2026-09-07',
    confidence: 'high',
  },
  {
    id: 'hamilton-pool',
    name: 'Hamilton Pool (rec swim)',
    category: 'recreation',
    building: 'Tisch Sports & Fitness Center',
    description:
      'Recreational swim times. Lanes may be reduced by lessons, and club swim uses 4 lanes Mon–Thu 8:30–9:45 PM.',
    hours: [
      [r('12pm', '4pm', REC)], // Sun
      [r('7am', '8:15am', REC), r('11:30am', '1:30pm', REC), r('7:30pm', '9:50pm', REC)],
      [r('7am', '8:15am', REC), r('11:30am', '1:30pm', REC), r('7:30pm', '9:50pm', REC)],
      [r('7am', '8:15am', REC), r('11:30am', '1:30pm', REC), r('7:30pm', '9:50pm', REC)],
      [r('7am', '8:15am', REC), r('11:30am', '1:30pm', REC), r('7:30pm', '9:50pm', REC)],
      [r('7am', '8:15am', REC), r('11:30am', '1:30pm', REC)], // Fri
      [r('12pm', '4pm', REC)], // Sat
    ],
    holidays: 'regular',
    breaks: 'unknown',
    overrides: [
      { from: '2026-09-01', to: '2026-09-07', hours: 'unknown', note: 'Fall rec swim schedule starts Sep 8' },
      { from: '2026-10-31', hours: 'closed', note: 'No rec swim Oct 31' },
      {
        from: '2026-11-24',
        confidence: 'medium',
        hours: [r('7am', '8:15am', REC), r('11:30am', '1:30pm', REC)],
        note: 'No evening rec swim Nov 24; the Mon–Thu morning AM/PM typo remains unconfirmed',
      },
      { from: '2026-11-25', to: '2026-11-29', hours: 'closed', note: 'Closed for Thanksgiving' },
      { from: '2026-12-19', to: '2027-01-19', hours: 'closed', note: 'No rec swim over winter break' },
    ],
    links: {
      source: 'https://gotuftsjumbos.com/sports/2022/5/6/facilities-Reservation.aspx',
    },
    validThrough: '2027-01-19',
    note: 'The official Mon–Thu morning entry reads 7 PM–8:15 AM, conflicting with its other swim sessions. Confirm rec swim times with athletics. Spring 2027 times are not posted.',
    verified: '2026-09-07',
    confidence: 'medium',
  },
];
