import type { DateOverride, DayHours, Location, PeriodHours, WeekHours } from '../engine/types';
import { r } from '../engine/format';

const HOURS_SRC = 'https://dining.tufts.edu/hours/regular-hours-operation';
const PREO_SRC = 'https://dining.tufts.edu/hours/pre-o-and-orientation-hours';

// Specific published dates take precedence over the page's generic Fri/Sat heading.
const lateNightDates = [
  '09-25', '09-26', '10-02', '10-03', '10-16', '10-17', '10-23', '10-24',
  '10-30', '10-31', '11-06', '11-07', '11-13', '11-14', '11-20', '11-24',
  '12-04', '12-05', '12-11', '12-12',
];
const lateNightEvents: DateOverride[] = lateNightDates.map((date) => ({
  from: `2026-${date}`, hours: [r('9pm', '12:30am', 'Late night')],
  note: date === '11-24'
    ? 'Tufts explicitly lists Tuesday Nov 24 despite its Friday/Saturday heading; confirm this unusual date with Dining.'
    : 'Published Fall 2026 Late Night date',
  confidence: date === '11-24' ? 'medium' : 'high',
  sourceConflict: date === '11-24',
}));

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
    confidence: 'low',
    note: THANKSGIVING_NOTE,
  };
}

const RETAIL_CLOSED_WEEK: PeriodHours[] = [
  { period: 'thanksgiving-2026', confidence: 'low', hours: [[], [], [], [], [], [], []], note: 'Closed for Thanksgiving recess (prior-year pattern)' },
  { period: 'winter-2026', hours: 'unknown', note: 'Winter break hours not published yet' },
  { period: 'spring-break-2027', hours: 'unknown', note: 'Spring break hours not published yet' },
  { period: 'summer-2027', hours: 'closed', note: 'Closed for the summer' },
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
    ],
    overrides: [
      { from: '2026-09-03', hours: splitDay(['7am', '10am'], ['11am', '3pm'], ['4:30pm', '8pm']), note: 'Orientation table: Thursday dinner 4:30–8 PM' },
      { from: '2026-09-04', hours: splitDay(['7am', '10am'], ['11am', '3pm'], ['5pm', '8pm']), note: 'Orientation table: Friday dinner 5–8 PM; dinner is not closed for the Food Fair' },
      { from: '2026-09-05', hours: splitDay(['7am', '10am'], ['11am', '3pm'], ['5pm', '8pm']), note: 'Orientation hours' },
      { from: '2026-09-06', to: '2026-09-07', hours: [r('7:30am', '11am', 'Breakfast'), r('11am', '2pm', 'Lunch'), r('2pm', '5pm', 'Late lunch'), r('5pm', '9pm', 'Dinner')], note: 'Orientation / Labor Day hours' },
    ],
    links: { source: HOURS_SRC, menu: 'https://tufts.nutrislice.com/menu/dewick-dining', schedule: PREO_SRC },
    verified: '2026-09-07',
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
    ],
    overrides: [
      { from: '2026-09-03', to: '2026-09-06', hours: 'closed', note: 'Closed due to a building issue; reopens Mon Sep 7, 5–8 PM (Tufts Dining homepage update)' },
      { from: '2026-09-07', hours: [r('5pm', '8pm', 'Dinner')], note: 'Dinner only, 5–8 PM; regular fall hours resume Sep 8 (Dining homepage and corrected orientation table agree)' },
    ],
    links: { source: HOURS_SRC, menu: 'https://tufts.nutrislice.com/menu/carmichael-dining-hall', schedule: PREO_SRC },
    verified: '2026-09-07',
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
      { period: 'thanksgiving-2026', confidence: 'low', hours: [[r('5pm', '10pm')], [r('11am', '10pm')], [r('11am', '10pm')], [r('11am', '10pm')], [], [], []], note: THANKSGIVING_NOTE },
      { period: 'winter-2026', hours: 'unknown', note: 'Winter break hours not published yet' },
      { period: 'spring-break-2027', hours: 'unknown', note: 'Spring break hours not published yet' },
      { period: 'summer-2027', hours: 'closed', note: 'Closed for the summer' },
    ],
    overrides: [
      { from: '2026-09-01', to: '2026-09-05', hours: 'closed', note: 'Closed per the Tufts Dining menu system' },
      { from: '2026-09-06', to: '2026-09-07', hours: 'unknown', sourceConflict: true, note: 'Official sources disagree: orientation hours list 11 AM–7 PM; Nutrislice says Commons is closed until Sep 8. Confirm with Tufts Dining.' },
    ],
    links: { source: HOURS_SRC, menu: 'https://tufts.nutrislice.com/menu/commons-marketplace', schedule: PREO_SRC },
    verified: '2026-09-07',
    confidence: 'high',
  },
  {
    id: 'commons-late-night',
    name: 'Commons Late Night',
    category: 'dining',
    building: 'Commons Marketplace, Mayer Campus Center',
    description: 'Late-night menu on published event dates, usually Fridays and Saturdays. Order through the Transact Mobile Ordering app only. Meal swipe equivalency accepted.',
    hours: 'closed',
    holidays: 'regular',
    breaks: 'closed',
    overrides: [
      ...lateNightEvents,
      { from: '2026-09-01', to: '2026-09-24', hours: 'closed', note: 'Fall Late Night starts Fri Sep 25' },
      { from: '2026-10-09', to: '2026-10-10', hours: 'closed', note: 'No Late Night this weekend' },
      { from: '2026-11-27', to: '2026-11-28', hours: 'closed', note: 'No Late Night over Thanksgiving' },
      { from: '2026-11-21', to: '2026-11-22', hours: 'unknown', sourceConflict: true, note: 'The Friday/Saturday heading suggests Nov 21, but the date list says Nov 20 & 24. Confirm with Dining; Nov 21 and its overnight spill are unconfirmed.' },
      { from: '2026-11-25', hours: 'unknown', sourceConflict: true, note: 'Overnight service from the disputed Nov 24 event is unconfirmed; contact Dining.' },
      { from: '2026-12-18', to: '2027-01-19', hours: 'closed', note: 'Fall Late Night ended Dec 12' },
      { from: '2027-01-20', to: '2027-05-14', hours: 'unknown', note: 'Spring Late Night dates not announced yet' },
    ],
    links: { source: 'https://dining.tufts.edu/hours/late-night-commons-hours', menu: 'https://tufts.nutrislice.com/menu/commons-marketplace' },
    note: 'Only listed dates are scheduled. The Nov 21/24 discrepancy remains unconfirmed.',
    verified: '2026-09-07',
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
    verified: '2026-09-07',
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
      { from: '2026-09-10', hours: [r('8am', '6pm')], note: 'Open until 6 PM per the orientation-week hours table (regular Thursday close is 5 PM)' },
    ],
    links: { source: HOURS_SRC, menu: 'https://tufts.nutrislice.com/menu/hotung-cafe', schedule: PREO_SRC },
    verified: '2026-09-07',
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
    overrides: [{ from: '2026-09-01', to: '2026-09-09', hours: 'unknown', note: 'First pub night of the semester not announced yet' }],
    links: { source: 'https://dining.tufts.edu/pub' },
    note: 'Pub nights are a series of events and do not run every Thursday. Check dining.tufts.edu/pub before going.',
    verified: '2026-09-07',
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
    verified: '2026-09-07',
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
    verified: '2026-09-07',
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
      { from: '2026-09-21', hours: 'closed', note: 'Closed for Yom Kippur (per dining.tufts.edu)' },
    ],
    links: { source: HOURS_SRC, menu: 'https://tufts.nutrislice.com/menu/pax-et-lox-glatt-kosher-deli', schedule: 'https://dining.tufts.edu/hours/pax-et-lox-holiday-hours' },
    note: 'Closes for Jewish holidays: Rosh Hashanah (Fri Sep 11) and Yom Kippur (Mon Sep 21) this fall; no closures for Sukkot.',
    verified: '2026-09-07',
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
    verified: '2026-09-07',
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
    verified: '2026-09-07',
    confidence: 'high',
  },
];
