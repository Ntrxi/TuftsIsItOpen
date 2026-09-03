import type { DayHours, Location, PeriodHours, WeekHours } from '../engine/types';
import { r } from '../engine/format';

const HOURS_SRC = 'https://dining.tufts.edu/hours/regular-hours-operation';
const PREO_SRC = 'https://dining.tufts.edu/hours/pre-o-and-orientation-hours';

/** Continuous-service dining hall day with Tufts meal periods (breakfast until 11, lunch 11–2, late lunch 2–5, dinner 5–close). */
function hallDay(open: string, close: string, opts: { brunch?: boolean } = {}): DayHours {
  const out: DayHours = [];
  if (opts.brunch) {
    out.push(r(open, '2pm', 'Brunch'));
  } else {
    out.push(r(open, '11am', 'Breakfast'), r('11am', '2pm', 'Lunch'));
  }
  out.push(r('2pm', '5pm', 'Late lunch'), r('5pm', close, 'Dinner'));
  return out;
}

/** Orientation-week split service: breakfast / lunch / dinner with closures between. */
function splitDay(b: [string, string] | null, l: [string, string] | null, d: [string, string] | null): DayHours {
  const out: DayHours = [];
  if (b) out.push(r(b[0], b[1], 'Breakfast'));
  if (l) out.push(r(l[0], l[1], 'Lunch'));
  if (d) out.push(r(d[0], d[1], 'Dinner'));
  return out;
}

// Thanksgiving pattern (prior years): closed Thu–Sat, dining halls reopen Sunday for dinner.
const THANKSGIVING_NOTE = 'Thanksgiving recess (based on prior years; confirm on dining.tufts.edu)';
function hallThanksgiving(regular: WeekHours, sundayDinner: DayHours): PeriodHours {
  return {
    period: 'thanksgiving-2026',
    hours: [sundayDinner, regular[1], regular[2], regular[3], [], [], []],
    note: THANKSGIVING_NOTE,
  };
}

const RETAIL_CLOSED_WEEK: PeriodHours[] = [
  { period: 'thanksgiving-2026', hours: [[], [], [], [], [], [], []], note: 'Closed for Thanksgiving recess (prior-year pattern)' },
  { period: 'winter-2026', hours: 'unknown', note: 'Winter break hours not published yet' },
  { period: 'spring-break-2027', hours: 'unknown', note: 'Spring break hours not published yet' },
  { period: 'summer-2027', hours: 'closed', note: 'Closed for the summer' },
  { period: 'fall-exams-2026', hours: 'regular' },
];

const dewickWeek: WeekHours = [
  hallDay('11am', '9:30pm', { brunch: true }), // Sun
  hallDay('7:30am', '9:30pm'),
  hallDay('7:30am', '9:30pm'),
  hallDay('7:30am', '9:30pm'),
  hallDay('7:30am', '9:30pm'),
  hallDay('7:30am', '9pm'), // Fri
  hallDay('8am', '9pm'), // Sat
];

const carmWeek: WeekHours = [
  hallDay('7am', '8pm'), // Sun
  hallDay('7am', '8pm'),
  hallDay('7am', '8pm'),
  hallDay('7am', '8pm'),
  hallDay('7am', '8pm'),
  hallDay('7am', '8pm'),
  [r('11am', '2pm', 'Lunch'), r('2pm', '5pm', 'Late lunch'), r('5pm', '8pm', 'Dinner')], // Sat
];

const weekdayCafe = (monThu: [string, string], fri: [string, string]): WeekHours => [
  [],
  [r(...monThu)],
  [r(...monThu)],
  [r(...monThu)],
  [r(...monThu)],
  [r(...fri)],
  [],
];

export const dining: Location[] = [
  {
    id: 'dewick',
    name: 'Dewick-MacPhie Dining Center',
    category: 'dining',
    building: '25 Latin Way (across from the Campus Center)',
    description: 'All-you-care-to-eat dining hall with continuous service. Meal swipes, JumboCash, cash, and credit.',
    hours: dewickWeek,
    holidays: 'regular',
    breaks: 'unknown',
    periods: [
      hallThanksgiving(dewickWeek, [r('5pm', '9:30pm', 'Dinner')]),
      { period: 'winter-2026', hours: 'unknown', note: 'Winter break hours not published yet' },
      { period: 'spring-break-2027', hours: 'unknown', note: 'Spring break hours not published yet' },
      { period: 'summer-2027', hours: 'closed', note: 'Closed for the summer (Carmichael is the summer dining hall)' },
      { period: 'fall-exams-2026', hours: 'regular' },
    ],
    overrides: [
      { from: '2026-09-03', hours: splitDay(['7am', '10am'], ['11am', '3pm'], ['5pm', '8pm']), note: 'Orientation hours' },
      { from: '2026-09-04', hours: splitDay(['7am', '10am'], ['11am', '3pm'], null), note: 'Orientation hours · dinner closed for the First-Year Food Fair (Res Quad, 5–7 PM)' },
      { from: '2026-09-05', hours: splitDay(['7am', '10am'], ['11am', '3pm'], ['5pm', '8pm']), note: 'Orientation hours' },
      { from: '2026-09-06', to: '2026-09-07', hours: [r('7:30am', '11am', 'Breakfast'), r('11am', '2pm', 'Lunch'), r('2pm', '5pm', 'Late lunch'), r('5pm', '9pm', 'Dinner')], note: 'Orientation / Labor Day hours' },
    ],
    links: { source: HOURS_SRC, menu: 'https://tufts.nutrislice.com/menu/dewick-dining', schedule: PREO_SRC },
    verified: '2026-09-03',
    confidence: 'high',
  },
  {
    id: 'carmichael',
    name: 'Fresh at Carmichael Dining Center',
    category: 'dining',
    building: 'Carmichael Hall, 200 Packard Ave',
    description: 'Dining hall that is entirely gluten-, peanut-, and tree-nut-free. Continuous service. Meal swipes, JumboCash, cash, and credit.',
    hours: carmWeek,
    holidays: 'regular',
    breaks: 'unknown',
    periods: [
      hallThanksgiving(carmWeek, [r('5pm', '8pm', 'Dinner')]),
      { period: 'winter-2026', hours: 'unknown', note: 'Winter break hours not published yet' },
      { period: 'spring-break-2027', hours: 'unknown', note: 'Spring break hours not published yet' },
      { period: 'summer-2027', hours: 'unknown', note: 'Summer hours not published yet' },
      { period: 'fall-exams-2026', hours: 'regular' },
    ],
    overrides: [
      { from: '2026-09-03', hours: 'closed', note: 'Closed today due to a building issue (per dining.tufts.edu)' },
      { from: '2026-09-04', hours: splitDay(['7am', '10am'], ['11am', '3pm'], ['5pm', '8pm']), note: 'Orientation hours' },
      { from: '2026-09-05', hours: splitDay(null, ['11am', '3pm'], ['5pm', '8pm']), note: 'Orientation hours' },
      { from: '2026-09-06', to: '2026-09-11', hours: hallDay('7am', '8pm'), note: 'Orientation / Labor Day hours' },
    ],
    links: { source: HOURS_SRC, menu: 'https://tufts.nutrislice.com/menu/carmichael-dining-hall', schedule: PREO_SRC },
    verified: '2026-09-03',
    confidence: 'high',
  },
  {
    id: 'commons',
    name: 'Commons Marketplace',
    category: 'dining',
    building: 'Mayer Campus Center, lower level',
    description: 'Retail marketplace. JumboCash, cash, and credit; meal swipes are not accepted during the day.',
    hours: [
      [r('11am', '10pm')],
      [r('11am', '10pm')],
      [r('11am', '10pm')],
      [r('11am', '10pm')],
      [r('11am', '10pm')],
      [r('11am', '10pm')],
      [r('11am', '10pm')],
    ],
    holidays: 'regular',
    breaks: 'unknown',
    periods: [
      { period: 'thanksgiving-2026', hours: [[r('5pm', '10pm')], [r('11am', '10pm')], [r('11am', '10pm')], [r('11am', '10pm')], [], [], []], note: THANKSGIVING_NOTE },
      { period: 'winter-2026', hours: 'unknown', note: 'Winter break hours not published yet' },
      { period: 'spring-break-2027', hours: 'unknown', note: 'Spring break hours not published yet' },
      { period: 'summer-2027', hours: 'closed', note: 'Closed for the summer' },
      { period: 'fall-exams-2026', hours: 'regular' },
    ],
    overrides: [
      { from: '2026-09-01', to: '2026-09-07', hours: 'closed', note: 'Closed until Tue Sep 8 per the dining menu system (the orientation hours table lists 11 AM – 7 PM on Sep 6–7)' },
    ],
    links: { source: HOURS_SRC, menu: 'https://tufts.nutrislice.com/menu/commons-marketplace', schedule: PREO_SRC },
    verified: '2026-09-03',
    confidence: 'high',
  },
  {
    id: 'commons-late-night',
    name: 'Commons Late Night',
    category: 'dining',
    building: 'Commons Marketplace, Mayer Campus Center',
    description: 'Late-night menu on select Friday and Saturday nights. Order through the Transact Mobile Ordering app only. Meal swipe equivalency accepted.',
    hours: [[], [], [], [], [], [r('9pm', '12:30am', 'Late night')], [r('9pm', '12:30am', 'Late night')]],
    holidays: 'regular',
    breaks: 'closed',
    periods: [{ period: 'fall-exams-2026', hours: 'regular' }],
    overrides: [
      { from: '2026-09-01', to: '2026-09-24', hours: 'closed', note: 'Fall Late Night starts Fri Sep 25' },
      { from: '2026-10-09', to: '2026-10-10', hours: 'closed', note: 'No Late Night this weekend' },
      { from: '2026-11-27', to: '2026-11-28', hours: 'closed', note: 'No Late Night over Thanksgiving' },
      { from: '2026-12-18', to: '2027-01-31', hours: 'closed', note: 'Fall Late Night ended Dec 12; spring dates TBA' },
    ],
    links: { source: 'https://dining.tufts.edu/hours/late-night-commons-hours', menu: 'https://tufts.nutrislice.com/menu/commons-marketplace' },
    verified: '2026-09-03',
    confidence: 'high',
  },
  {
    id: 'hodgdon',
    name: 'Hodgdon Food-on-the-Run',
    category: 'dining',
    building: 'Hodgdon Hall, 103 Talbot Ave (entrance off Packard Ave)',
    description: 'Takeout with meal swipe equivalency. Stations include Ciudad, Greens & Grains, Pan Asia, and mobile-order-only bagels, deli, and pita.',
    hours: weekdayCafe(['9am', '10pm'], ['9am', '4pm']),
    holidays: 'closed',
    breaks: 'unknown',
    periods: RETAIL_CLOSED_WEEK,
    overrides: [{ from: '2026-09-01', to: '2026-09-07', hours: 'closed', note: 'Opens for the semester Tue Sep 8' }],
    links: { source: HOURS_SRC, menu: 'https://tufts.nutrislice.com/menu/hodgdon-food-on-the-run' },
    verified: '2026-09-03',
    confidence: 'high',
  },
  {
    id: 'hotung',
    name: 'Hotung Café',
    category: 'dining',
    building: 'Mayer Campus Center, lower level',
    description: 'Coffee, pastries, and lunch. JumboCash, cash, and credit (no meal swipes). Mobile ordering available.',
    hours: [[], [r('8am', '6pm')], [r('8am', '6pm')], [r('8am', '6pm')], [r('8am', '5pm')], [r('8am', '5pm')], []],
    holidays: 'closed',
    breaks: 'unknown',
    periods: RETAIL_CLOSED_WEEK,
    overrides: [
      { from: '2026-09-03', to: '2026-09-04', hours: [r('8am', '3pm')], note: 'Orientation hours' },
      { from: '2026-09-05', to: '2026-09-07', hours: 'closed', note: 'Closed Labor Day weekend' },
    ],
    links: { source: HOURS_SRC, menu: 'https://tufts.nutrislice.com/menu/hotung-cafe', schedule: PREO_SRC },
    verified: '2026-09-03',
    confidence: 'high',
  },
  {
    id: 'popup-pub',
    name: 'Hotung Pop-Up Pub',
    category: 'dining',
    building: 'Hotung Café (outside entrance on Talbot Ave)',
    description: 'Thursday-night pub with small bites, beer, cider, wine, and non-alcoholic options. Tufts ID to enter; 21+ with government ID for alcohol.',
    hours: [[], [], [], [], [r('6pm', '10pm', 'Pub night')], [], []],
    holidays: 'closed',
    breaks: 'closed',
    overrides: [{ from: '2026-09-01', to: '2026-09-09', hours: 'closed', note: 'First pub night of the semester not announced yet' }],
    links: { source: 'https://dining.tufts.edu/pub' },
    note: 'Pub nights are a series of events and do not run every Thursday. Check dining.tufts.edu/pub before going.',
    verified: '2026-09-03',
    confidence: 'medium',
  },
  {
    id: 'kindlevan',
    name: 'Kindlevan Café',
    category: 'dining',
    building: 'Tsungming Tu Complex (TTC) atrium, 200 College Ave',
    description: 'Café in the science complex. Meal swipe equivalency, JumboCash, cash, and credit.',
    hours: weekdayCafe(['8am', '7pm'], ['8am', '4pm']),
    holidays: 'closed',
    breaks: 'unknown',
    periods: RETAIL_CLOSED_WEEK,
    overrides: [{ from: '2026-09-01', to: '2026-09-07', hours: 'closed', note: 'Opens for the semester Tue Sep 8' }],
    links: { source: HOURS_SRC, menu: 'https://tufts.nutrislice.com/menu/kindlevan-cafe' },
    verified: '2026-09-03',
    confidence: 'high',
  },
  {
    id: 'mugar-cafe',
    name: 'Mugar Café',
    category: 'dining',
    building: 'Mugar Hall (Fletcher School), 160 Packard Ave',
    description: 'Café at the Fletcher School. JumboCash, cash, and credit (no meal swipes).',
    hours: weekdayCafe(['8am', '5pm'], ['8am', '2pm']),
    holidays: 'closed',
    breaks: 'unknown',
    periods: RETAIL_CLOSED_WEEK,
    overrides: [{ from: '2026-09-01', to: '2026-09-07', hours: 'closed', note: 'Opens for the semester Tue Sep 8' }],
    links: { source: HOURS_SRC, menu: 'https://tufts.nutrislice.com/menu/mugar-cafe' },
    verified: '2026-09-03',
    confidence: 'high',
  },
  {
    id: 'pax-et-lox',
    name: 'Pax et Lox Glatt Kosher Deli',
    category: 'dining',
    building: 'Mayer Campus Center (Talbot Ave side)',
    description: 'Kosher deli, mobile order only through the Transact app. Cold sandwiches at lunch, hot sandwiches at dinner. Meal swipe equivalency accepted.',
    hours: [[], [r('11am', '5pm', 'Lunch'), r('5pm', '8pm', 'Dinner')], [r('11am', '5pm', 'Lunch'), r('5pm', '8pm', 'Dinner')], [r('11am', '5pm', 'Lunch'), r('5pm', '8pm', 'Dinner')], [r('11am', '5pm', 'Lunch'), r('5pm', '8pm', 'Dinner')], [], []],
    holidays: 'closed',
    breaks: 'unknown',
    periods: RETAIL_CLOSED_WEEK,
    overrides: [
      { from: '2026-09-01', to: '2026-09-07', hours: 'closed', note: 'Opens for the semester Tue Sep 8' },
      { from: '2026-09-21', hours: 'unknown', note: 'Yom Kippur: likely closed (holiday hours not yet published)' },
    ],
    links: { source: HOURS_SRC, menu: 'https://tufts.nutrislice.com/menu/pax-et-lox-glatt-kosher-deli' },
    note: 'Closes for Jewish holidays; the holiday schedule is posted on dining.tufts.edu each semester.',
    verified: '2026-09-03',
    confidence: 'high',
  },
  {
    id: 'tower-cafe',
    name: 'Tower Café',
    category: 'dining',
    building: 'Tisch Library, level 2',
    description: 'Coffee and snacks inside Tisch Library. JumboCash and credit.',
    hours: [[r('1pm', '6:30pm')], [r('9am', '6:45pm')], [r('9am', '6:45pm')], [r('9am', '6:45pm')], [r('9am', '6:45pm')], [], []],
    holidays: 'closed',
    breaks: 'unknown',
    periods: RETAIL_CLOSED_WEEK,
    overrides: [{ from: '2026-09-01', to: '2026-09-07', hours: 'closed', note: 'Opens for the semester Tue Sep 8' }],
    links: { source: HOURS_SRC, menu: 'https://tufts.nutrislice.com/menu/tower-cafe' },
    verified: '2026-09-03',
    confidence: 'high',
  },
  {
    id: 'smfa-cafe',
    name: 'SMFA Café',
    category: 'dining',
    building: 'SMFA at Tufts, 230 The Fenway, Boston',
    description: 'Café on the Boston (SMFA) campus. Meal swipe equivalency, JumboCash, cash, and credit.',
    hours: weekdayCafe(['8am', '7pm'], ['8am', '4pm']),
    holidays: 'closed',
    breaks: 'unknown',
    periods: RETAIL_CLOSED_WEEK,
    overrides: [{ from: '2026-09-01', to: '2026-09-07', hours: 'closed', note: 'Opens for the semester Tue Sep 8' }],
    links: { source: HOURS_SRC, menu: 'https://tufts.nutrislice.com/menu/smfa' },
    verified: '2026-09-03',
    confidence: 'high',
  },
];
