/**
 * Core schedule types. All times are minutes since local (America/New_York)
 * midnight. An interval's `end` may exceed 1440 to express overnight hours
 * (e.g. 21:00–02:00 is { start: 1260, end: 1560 }).
 */

export type Category =
  | 'dining'
  | 'mail'
  | 'library'
  | 'recreation'
  | 'health'
  | 'tech'
  | 'transit';

export interface Interval {
  start: number;
  end: number;
  /** Optional label, e.g. "Breakfast", "Rec swim", "Staffed". */
  label?: string;
}

/** A day's hours. Empty array = closed all day. */
export type DayHours = Interval[];

/** Sunday-first week: index 0 = Sunday … 6 = Saturday. */
export type WeekHours = [DayHours, DayHours, DayHours, DayHours, DayHours, DayHours, DayHours];

export type HoursSpec = WeekHours | 'closed' | 'unknown';

/** Hours for a specific date or date range, e.g. Labor Day or first week of classes. */
export interface DateOverride {
  /** YYYY-MM-DD, inclusive. */
  from: string;
  /** YYYY-MM-DD, inclusive. Defaults to `from`. */
  to?: string;
  /** Omit to keep whatever hours would otherwise apply and only attach the note (e.g. a dining notice). */
  hours?: DayHours | WeekHours | 'closed' | 'unknown' | 'regular';
  note: string;
}

/** Hours during a named calendar period (e.g. 'thanksgiving-2026'). */
export interface PeriodHours {
  period: string;
  hours: WeekHours | 'closed' | 'unknown' | 'regular';
  note?: string;
}

export type AccessMode = 'open' | 'appointment' | 'special';

export interface TransitInfo {
  /** Human description of frequency, e.g. "Every 10–15 min". */
  frequency?: string;
  /** Stop names in route order. */
  stops?: string[];
  /**
   * Optional fixed timetable: departures (minutes from midnight) per weekday and stop.
   * When present, "next departure" is computed from it.
   */
  departures?: Partial<Record<number, Record<string, number[]>>>;
}

export interface Location {
  id: string;
  name: string;
  category: Category;
  /** Building / where to find it. */
  building?: string;
  /** Short description shown under the name when expanded. */
  description?: string;
  /** Default 'open'. 'appointment' and 'special' change the displayed state while open. */
  access?: AccessMode;
  /** Regular academic-year hours. */
  hours: HoursSpec;
  /** Behavior on university holidays. Default 'closed', or 'regular' when `hours` is 'unknown'. */
  holidays?: 'closed' | 'regular';
  /**
   * Default behavior during calendar breaks and summer when no `periods` entry matches. Default
   * 'unknown'. Exam periods are not breaks: hours stay regular unless listed in `periods`.
   */
  breaks?: 'closed' | 'unknown' | 'regular' | WeekHours;
  /** Hours for specific named calendar periods. */
  periods?: PeriodHours[];
  /** Specific-date overrides. Highest priority. */
  overrides?: DateOverride[];
  /** Minutes before close to show "closing soon". Default 30. */
  closingSoonMinutes?: number;
  links: {
    source: string;
    menu?: string;
    tracker?: string;
    schedule?: string;
  };
  /** Always-visible note (e.g. "Swipe access after 5 PM"). */
  note?: string;
  /** Emergency / after-hours guidance (health). */
  afterHours?: string;
  transit?: TransitInfo;
  /** YYYY-MM-DD the hours were last checked against the source. */
  verified?: string;
  confidence?: 'high' | 'medium' | 'low';
}

export interface Holiday {
  date: string;
  name: string;
}

export interface CalendarPeriod {
  id: string;
  name: string;
  from: string;
  to: string;
  kind: 'break' | 'summer' | 'term' | 'exams' | 'info';
}

export interface Calendar {
  holidays: Holiday[];
  periods: CalendarPeriod[];
}

export type State =
  | 'open'
  | 'closing_soon'
  | 'opening_soon'
  | 'closed'
  | 'running'
  | 'not_running'
  | 'appointment'
  | 'special'
  | 'unknown';

export interface HoursLine {
  /** e.g. "Mon–Thu" or "Today". */
  days: string;
  /** e.g. "7:00 AM – 9:00 PM" or "Closed". */
  text: string;
  isToday?: boolean;
}

export interface Status {
  id: string;
  state: State;
  /** Short state label: "Open", "Closes soon", "Running"… */
  label: string;
  /** Primary detail: "Closes 9:00 PM", "Opens 7:00 AM", "Opens Mon 8:00 AM". */
  detail: string;
  /** Current sub-period label if any, e.g. "Dinner". */
  period?: string;
  /** When the current sub-period ends, if before the overall close. */
  periodEnds?: string;
  /** Today's hours as text. */
  today: string;
  /** Today's individual periods when a day has labeled/split hours. */
  todayPeriods: string[];
  /** Note explaining why hours differ today (holiday/break/override). */
  scheduleNote?: string;
  /** True when today's hours come from an override/holiday/break rather than the regular week. */
  isSpecial: boolean;
  /** Week overview (regular hours in effect for the current schedule). */
  week: HoursLine[];
  /** Transit: next departures per stop. */
  nextDepartures?: { stop: string; time: string; inMinutes: number }[];
  /** Minutes until the current state changes (for countdowns). */
  changesInMinutes?: number;
}
