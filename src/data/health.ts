import type { Location, WeekHours } from '../engine/types';
import { r } from '../engine/format';

const officeDay = [r('9am', '12pm', 'In person'), r('1pm', '5pm', 'In person')];
const breakDay = [r('9am', '12pm', 'In person'), r('1pm', '4pm', 'In person')];

const HEALTH_AFTER_HOURS =
  'Emergency: call 911 or Tufts Police 617-627-6911. Medical advice 24/7: call 617-627-3350 and follow the prompts for nurse triage. Tufts 24/7 Help Line: 617-627-3400.';
const CMHS_AFTER_HOURS =
  'Immediate danger: call 911 or Tufts Police 617-627-6911. Counselor on Call (nights, weekends, holidays): call 617-627-3360 and follow the prompts. 988 Suicide & Crisis Lifeline: call or text 988.';

const breakWeek: WeekHours = [[], breakDay, breakDay, breakDay, breakDay, breakDay, []];

export const health: Location[] = [
  {
    id: 'health-service',
    name: 'Health Service',
    category: 'health',
    building: '124 Professors Row · 617-627-3350',
    description:
      'Primary care, same-day sick visits, and the on-site lab (lab testing needs a clinician order; no separate lab hours). Book online via the Health & Wellness Patient Portal or by phone. Telehealth visits Mon–Fri 5–7 PM.',
    access: 'appointment',
    hours: [
      [],
      [...officeDay, r('5pm', '7pm', 'Telehealth')],
      [...officeDay, r('5pm', '7pm', 'Telehealth')],
      [...officeDay, r('5pm', '7pm', 'Telehealth')],
      [r('1pm', '5pm', 'In person'), r('5pm', '7pm', 'Telehealth')], // Thu: opens at 1 PM
      [...officeDay, r('5pm', '7pm', 'Telehealth')],
      [],
    ],
    holidays: 'closed',
    breaks: breakWeek,
    periods: [{ period: 'fall-exams-2026', hours: 'regular' }],
    links: {
      source: 'https://students.tufts.edu/health-service/about/hours',
      schedule: 'https://students.tufts.edu/health-service/make-appointment/make-appointment',
    },
    note: 'Closed 12–1 PM daily and Thursday mornings.',
    afterHours: HEALTH_AFTER_HOURS,
    verified: '2026-09-03',
    confidence: 'high',
  },
  {
    id: 'cmhs',
    name: 'Counseling & Mental Health (CMHS)',
    category: 'health',
    building: '120 Curtis St · 617-627-3360',
    description:
      'Counseling appointments and same-day urgent appointments (same-day visits are booked by phone only).',
    access: 'appointment',
    hours: [[], officeDay, officeDay, officeDay, [r('1pm', '5pm')], officeDay, []],
    holidays: 'closed',
    breaks: breakWeek,
    periods: [{ period: 'fall-exams-2026', hours: 'regular' }],
    links: {
      source: 'https://students.tufts.edu/counseling-and-mental-health-service',
      schedule: 'https://students.tufts.edu/health-wellness/counseling-and-mental-health-service/making-appointment',
    },
    note: 'Closed 12–1 PM daily and Thursday mornings.',
    afterHours: CMHS_AFTER_HOURS,
    verified: '2026-09-03',
    confidence: 'high',
  },
  {
    id: 'lets-talk',
    name: "Let's Talk (CMHS drop-in)",
    category: 'health',
    building: 'Tisch Sports & Fitness Center, TP3 conference room (2nd floor)',
    description:
      'Free, informal 15–20 minute drop-in consultations with a CMHS counselor. No appointment needed; not a substitute for therapy.',
    hours: [[], [], [], [], [r('1pm', '2pm', 'Drop-in')], [], []],
    holidays: 'closed',
    breaks: 'closed',
    overrides: [
      { from: '2026-09-01', to: '2026-09-09', hours: 'closed', note: 'Fall drop-ins begin Thu Sep 10' },
      { from: '2026-12-11', to: '2027-01-31', hours: 'closed', note: 'Fall drop-ins ended Dec 10; spring schedule TBA' },
    ],
    links: {
      source: 'https://students.tufts.edu/counseling-and-mental-health-service/services/lets-talk',
    },
    afterHours: CMHS_AFTER_HOURS,
    verified: '2026-09-03',
    confidence: 'high',
  },
  {
    id: 'care-office',
    name: 'CARE (sexual misconduct support)',
    category: 'health',
    building: 'Mayer Campus Center, rooms 210 & 211 · 617-627-3752',
    description:
      'Center for Awareness, Resources, and Education: confidential support for anyone affected by sexual misconduct. In-person or virtual appointments.',
    hours: [[], [r('9am', '5pm')], [r('9am', '5pm')], [r('9am', '5pm')], [r('9am', '5pm')], [r('9am', '5pm')], []],
    holidays: 'closed',
    breaks: 'regular',
    links: {
      source: 'https://students.tufts.edu/care',
    },
    afterHours: 'After hours, call the Tufts 24/7 Help Line at 617-627-3400 to reach the Counselor on Call.',
    verified: '2026-09-03',
    confidence: 'high',
  },
];
