/**
 * Core schedule types. All times are minutes since local (America/New_York)
 * midnight. An interval's `end` may exceed 1440 to express overnight hours
 * (e.g. 21:00–02:00 is { start: 1260, end: 1560 }).
 */

export type Confidence = 'high' | 'medium' | 'low';

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
  /** Access during this interval, independent of its display label. */
  access?: AccessMode | 'unknown';
  /**
   * Low/medium marks an interval whose published times are ambiguous or unverified. The engine
   * reports 'unknown' inside it (unless a confirmed interval also covers the instant) and keeps
   * the rest of the day usable; the display flags it as unconfirmed.
   */
  confidence?: Confidence;
}

/** A day's hours. Empty array = closed all day. */
export type DayHours = Interval[];

/** Sunday-first week: index 0 = Sunday … 6 = Saturday. */
export type WeekHours = [DayHours, DayHours, DayHours, DayHours, DayHours, DayHours, DayHours];

/**
 * 'unknown': hours exist but are not published. 'varies': there is no fixed public schedule at
 * all; availability depends on access conditions described by `availability`.
 */
export type HoursSpec = WeekHours | 'closed' | 'unknown' | 'varies';

/** Hours for a specific date or date range, e.g. Labor Day or first week of classes. */
export interface DateOverride {
  /** Static source conflict for these dates; keep unknown even when a live feed supplies hours. */
  sourceConflict?: boolean;
  /** Higher values win within static or live overrides. Equal-priority overlaps are invalid. */
  priority?: number;
  confidence?: Confidence;
  /** YYYY-MM-DD, inclusive. */
  from: string;
  /** YYYY-MM-DD, inclusive. Defaults to `from`. */
  to?: string;
  /**
   * Omit for a note only. Ranges describe service starting on this date and
   * preserve earlier overnight service. 'closed', an empty DayHours array, and
   * 'unknown' block incoming service at midnight; weekly hours use service dates.
   */
  hours?: DayHours | WeekHours | 'closed' | 'unknown' | 'regular';
  note: string;
}

/** Hours during a named calendar period (e.g. 'thanksgiving-2026'). */
export interface PeriodHours {
  confidence?: Confidence;
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
  /**
   * One sentence describing when the place is usable when `hours` is 'varies', e.g.
   * "Available to eligible students outside scheduled labs". Shown instead of a schedule.
   */
  availability?: string;
  /**
   * Behavior on university holidays. Default 'closed', or 'regular' when `hours` is 'unknown' or
   * 'varies'. 'unknown' for a source that says holiday hours vary without publishing them.
   */
  holidays?: 'closed' | 'regular' | 'unknown';
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
  confidence?: Confidence;
  /** Unresolved disagreement between official sources; do not choose a schedule. */
  sourceConflict?: string;
  /** Last date supported by the regular schedule, independent of the calendar horizon. */
  validThrough?: string;
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
  /** YYYY-MM-DD, inclusive: the last date the calendar covers. Later dates resolve to unknown hours. */
  through: string;
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
  | 'varies'
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
  /** Hours starting on today's campus service date. Active carryover is explained in scheduleNote. */
  today: string;
  /** Today's individual periods when a day has labeled/split hours. */
  todayPeriods: string[];
  /** Note explaining why hours differ today (holiday/break/override). */
  scheduleNote?: string;
  /** Today's intervals whose times are unconfirmed, formatted like `todayPeriods`. */
  unconfirmed?: string[];
  /** True for override/holiday/break hours or when a next-day exception truncates today's service. */
  isSpecial: boolean;
  /** Service-day overview starting today, preserving overnight ends; first row matches `today`. */
  week: HoursLine[];
  /** Transit: next departures per stop. */
  nextDepartures?: { stop: string; time: string; inMinutes: number }[];
  /** Next state, access, or period-label change, including soon thresholds. UTC ISO string. */
  nextTransitionAt?: string;
  /** Next access-mode change within the current continuous service span. UTC ISO string. */
  accessChangesAt?: string;
  /** Confirmed end of current continuous service. Omitted at uncertainty/lookahead limits. UTC ISO string. */
  closesAt?: string;
  /** Rounded-up elapsed minutes until nextTransitionAt, NOT necessarily until opening/closing. */
  changesInMinutes?: number;
}
