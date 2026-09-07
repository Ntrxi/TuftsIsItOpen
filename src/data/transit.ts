import type { DateOverride, Location, PeriodHours } from '../engine/types';
import { r, t } from '../engine/format';

const TRACKER = 'https://tufts.passiogo.com/';
const ADVISORIES = 'https://access.tufts.edu/parking-shuttle-advisories';

/** Departure times from `first` to `last` (inclusive) every `every` minutes. */
function every(first: string, last: string, every: number): number[] {
  const out: number[] = [];
  let end = t(last);
  const start = t(first);
  if (end < start) end += 1440;
  for (let m = start; m <= end; m += every) out.push(m);
  return out;
}

const shuttleBreaks: PeriodHours[] = [
  { period: 'thanksgiving-2026', hours: 'unknown', note: 'Thanksgiving schedule not posted yet (usually no service Thu–Fri, limited other days)' },
  { period: 'winter-2026', hours: 'unknown', note: 'Winter break schedule not posted yet (usually no service between finals and spring classes)' },
  { period: 'spring-break-2027', hours: 'unknown', note: 'Spring break schedule not posted yet' },
  { period: 'summer-2027', hours: 'closed', note: 'No service over the summer; resumes with the fall semester' },
];

const holidayUnknown: DateOverride[] = [
  { from: '2026-10-12', hours: 'unknown', note: "Indigenous Peoples' Day service not announced; check advisories" },
  { from: '2026-11-11', hours: 'unknown', note: 'Veterans Day service not announced; check advisories' },
];

// Davis Square Shuttle: Direct (7 AM–7 PM weekdays) then the All Stops loop in the evening and on weekends.
const DIRECT = 'Direct · every 30 min';
const LOOP = 'All Stops loop · every 30 min';
const davisWeekdayCC = [...every('7:00', '18:30', 30)];

export const transit: Location[] = [
  {
    id: 'davis-shuttle',
    name: 'Davis Square Shuttle',
    category: 'transit',
    building: 'Campus Center stop, 44 Professors Row ↔ Davis Square (4 College Ave)',
    description:
      'Weekdays 7 AM – 7 PM the Direct shuttle runs Campus Center ↔ Davis Square. Evenings and weekends the All Stops loop adds Carmichael Hall and Olin Hall. Campus Center departures are at :00/:30; Davis departures depend on boarding and have no fixed time.',
    hours: [
      [r('10am', '11pm', LOOP)], // Sun
      [r('7am', '7pm', DIRECT), r('7pm', '11pm', LOOP)],
      [r('7am', '7pm', DIRECT), r('7pm', '11pm', LOOP)],
      [r('7am', '7pm', DIRECT), r('7pm', '11pm', LOOP)],
      [r('7am', '7pm', DIRECT), r('7pm', '12am', LOOP)], // Thu
      [r('7am', '7pm', DIRECT), r('7pm', '2am', LOOP)], // Fri
      [r('10am', '11pm', LOOP)], // Sat
    ],
    holidays: 'regular',
    breaks: 'unknown',
    periods: shuttleBreaks,
    overrides: [
      { from: '2026-08-28', to: '2026-09-07', hours: [r('9am', '8pm', 'Limited service')], note: 'Limited start-of-semester service; regular schedule resumes Tue Sep 8' },
      ...holidayUnknown,
    ],
    transit: {
      frequency: 'Every 30 min',
      stops: ['Campus Center', 'Davis Square', 'Carmichael Hall (evenings/weekends)', 'Olin Hall (evenings/weekends)'],
      departures: {
        0: { 'Campus Center': every('10:00', '22:30', 30) },
        1: { 'Campus Center': [...davisWeekdayCC, ...every('19:00', '22:30', 30)] },
        2: { 'Campus Center': [...davisWeekdayCC, ...every('19:00', '22:30', 30)] },
        3: { 'Campus Center': [...davisWeekdayCC, ...every('19:00', '22:30', 30)] },
        4: { 'Campus Center': [...davisWeekdayCC, ...every('19:00', '23:30', 30)] },
        5: { 'Campus Center': [...davisWeekdayCC, ...every('19:00', '25:30', 30)] },
        6: { 'Campus Center': every('10:00', '22:30', 30) },
      },
    },
    links: { source: 'https://access.tufts.edu/davis-square-shuttle', tracker: TRACKER, schedule: ADVISORIES },
    note: 'Service may be suspended during university closures, holidays, or snow emergencies.',
    verified: '2026-09-06',
    confidence: 'high',
  },
  {
    id: 'smfa-connected',
    name: 'SMFA Connected Shuttle',
    category: 'transit',
    building: 'Granoff Music Center (Talbot Ave) ↔ Tisch Gym ↔ NEC ↔ SMFA (230 The Fenway)',
    description:
      'Medford ↔ Boston shuttle, about 50 minutes each way. Most weekday trips leave Medford on the hour and SMFA at :05 past; early and late trips differ. After 7 PM on weekdays it also serves Beacon St.',
    hours: [
      [r('11am', '10pm', 'Every 2 hours')], // Sun
      [r('7:25am', '12:05am', 'Hourly')],
      [r('7:25am', '12:05am', 'Hourly')],
      [r('7:25am', '12:05am', 'Hourly')],
      [r('7:25am', '12:05am', 'Hourly')],
      [r('7:25am', '11:05pm', 'Hourly')], // Fri
      [r('11am', '10pm', 'Every 2 hours')], // Sat
    ],
    holidays: 'regular',
    breaks: 'unknown',
    periods: shuttleBreaks,
    overrides: [
      { from: '2026-09-01', to: '2026-09-04', hours: 'closed', note: 'Summer suspension; limited service starts Sat Sep 5' },
      { from: '2026-09-05', to: '2026-09-07', hours: [r('9am', '10pm', 'Limited service')], note: 'Limited start-of-semester service (last shuttle leaves SMFA 10 PM); regular schedule resumes Tue Sep 8' },
      ...holidayUnknown,
    ],
    transit: {
      frequency: 'Hourly on weekdays, every 2 hours on weekends',
      stops: ['Granoff Music Center', 'Tisch Gym', 'NEC', 'SMFA', 'Beacon St (after 7 PM weekdays)'],
      departures: {
        0: { 'Medford (Granoff)': every('11:00', '21:00', 120), SMFA: every('12:00', '22:00', 120) },
        1: { 'Medford (Granoff)': [t('7:25'), t('7:30'), ...every('9:00', '23:00', 60)], SMFA: [t('8:15'), ...every('9:05', '22:05', 60), t('24:05')] },
        2: { 'Medford (Granoff)': [t('7:25'), t('7:30'), ...every('9:00', '23:00', 60)], SMFA: [t('8:15'), ...every('9:05', '22:05', 60), t('24:05')] },
        3: { 'Medford (Granoff)': [t('7:25'), t('7:30'), ...every('9:00', '23:00', 60)], SMFA: [t('8:15'), ...every('9:05', '22:05', 60), t('24:05')] },
        4: { 'Medford (Granoff)': [t('7:25'), t('7:30'), ...every('9:00', '23:00', 60)], SMFA: [t('8:15'), ...every('9:05', '22:05', 60), t('24:05')] },
        5: { 'Medford (Granoff)': [t('7:25'), t('7:30'), ...every('9:00', '22:00', 60)], SMFA: [t('8:15'), ...every('9:05', '23:05', 60)] },
        6: { 'Medford (Granoff)': every('11:00', '21:00', 120), SMFA: every('12:00', '22:00', 120) },
      },
    },
    links: { source: 'https://access.tufts.edu/smfa-shuttle', tracker: TRACKER, schedule: 'https://go.tufts.edu/smfa_shuttle_schedule' },
    note: 'Departure times are estimates from the linked timetable. The current web page specifies Friday’s final SMFA departure at 11:05 PM, superseding the 2025–26 PDF’s 10:05 PM cutoff. The PDF lists no 11:05 PM SMFA trip Mon–Thu; check the tracker for late trips.',
    verified: '2026-09-06',
    confidence: 'high',
  },
  {
    id: 'smfa-beacon-direct',
    name: 'SMFA Beacon Direct',
    category: 'transit',
    building: 'Beacon St (Tatte, 1003 Beacon St, Brookline) ↔ SMFA (230 The Fenway)',
    description: 'Weekday commuter shuttle between the Beacon St residence and SMFA, running a continuous loop approximately every 10 minutes during the morning and evening windows. Fall and spring semesters only.',
    hours: [
      [],
      [r('7:30am', '11:30am', 'Morning · about every 10 min'), r('4pm', '8pm', 'Evening · about every 10 min')],
      [r('7:30am', '11:30am', 'Morning · about every 10 min'), r('4pm', '8pm', 'Evening · about every 10 min')],
      [r('7:30am', '11:30am', 'Morning · about every 10 min'), r('4pm', '8pm', 'Evening · about every 10 min')],
      [r('7:30am', '11:30am', 'Morning · about every 10 min'), r('4pm', '8pm', 'Evening · about every 10 min')],
      [r('7:30am', '11:30am', 'Morning · about every 10 min'), r('4pm', '8pm', 'Evening · about every 10 min')],
      [],
    ],
    holidays: 'closed',
    breaks: 'unknown',
    periods: [
      ...shuttleBreaks.filter((p) => p.period !== 'spring-break-2027'),
      { period: 'spring-break-2027', hours: 'closed', note: 'Does not run over spring break' },
    ],
    overrides: [
      { from: '2026-09-01', to: '2026-09-07', hours: 'closed', note: 'Service begins with the regular schedule on Tue Sep 8' },
      ...holidayUnknown,
    ],
    transit: {
      frequency: 'Continuous loop · about every 10 min',
      stops: ['Beacon St', 'SMFA'],
    },
    links: { source: 'https://access.tufts.edu/smfa-shuttle', tracker: TRACKER, schedule: 'https://go.tufts.edu/smfa_shuttle_schedule' },
    note: 'Use the live tracker for arrivals; the current web page’s continuous loop replaces the older PDF’s 20-minute departure estimates.',
    verified: '2026-09-06',
    confidence: 'high',
  },
  {
    id: 'grocery-shuttle',
    name: 'Grocery Shuttle',
    category: 'transit',
    building: 'Campus Center stop, 44 Professors Row ↔ Stop & Shop, Fellsway Plaza',
    description: 'Saturday shuttle to Stop & Shop (760 Fellsway, Medford). Leaves the Campus Center on the hour and returns from the store at :45. No sign-up needed.',
    hours: [[], [], [], [], [], [], [r('8am', '2:45pm', 'Hourly')]],
    holidays: 'regular',
    breaks: 'regular',
    transit: {
      frequency: 'Hourly',
      stops: ['Campus Center', 'Stop & Shop (Fellsway Plaza)'],
      departures: {
        6: { 'Campus Center': every('8:00', '14:00', 60), 'Stop & Shop': every('8:45', '14:45', 60) },
      },
    },
    links: { source: 'https://access.tufts.edu/grocery-shuttle', tracker: TRACKER, schedule: ADVISORIES },
    note: 'Runs year-round, including winter and summer breaks.',
    verified: '2026-09-03',
    confidence: 'high',
  },
  {
    id: 'saferide',
    name: 'SafeRide (TUPD)',
    category: 'transit',
    building: 'Call Tufts Police at 617-627-3030',
    description:
      'Overnight safe-ride service within 1.25 miles of the Medford/Somerville campus for students, staff, and affiliates (up to 3 riders). Use the campus shuttles before 11 PM.',
    hours: [
      [r('11pm', '7am', 'Overnight')],
      [r('11pm', '7am', 'Overnight')],
      [r('11pm', '7am', 'Overnight')],
      [r('11pm', '7am', 'Overnight')],
      [r('11pm', '7am', 'Overnight')],
      [r('11pm', '7am', 'Overnight')],
      [r('11pm', '7am', 'Overnight')],
    ],
    holidays: 'regular',
    breaks: 'regular',
    transit: { frequency: 'On request' },
    links: { source: 'https://access.tufts.edu/saferide-services' },
    verified: '2026-09-03',
    confidence: 'high',
  },
];
