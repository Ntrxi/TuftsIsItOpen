import type {
  Calendar,
  CalendarPeriod,
  DayHours,
  DateOverride,
  HoursLine,
  Interval,
  Location,
  State,
  Status,
  WeekHours,
} from './types';
import { addDays, DAY_SHORT, dowOf, inRange, toLocal, type LocalTime } from './time';
import { fmtDay, fmtMinutesUntil, fmtPeriods, fmtTime, mergeContiguous, sameHours } from './format';

const LOOKAHEAD_DAYS = 60;
const OPENING_SOON_MINUTES = 30;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface ResolvedDay {
  hours: DayHours | 'unknown';
  /** Why these hours apply; shown to the user when not 'regular'. */
  note?: string;
  source: 'override' | 'holiday' | 'period' | 'regular' | 'unknown';
}

/** Extra date-specific overrides supplied at runtime (e.g. from a live feed), keyed by location id. */
export type LiveOverrides = Record<string, DateOverride[]>;

function isWeek(h: unknown): h is WeekHours {
  return Array.isArray(h) && h.length === 7 && Array.isArray(h[0]);
}

/** Live hours precede static hours; explicit priority wins within each layer. Ties fail closed. */
function matchOverrides(loc: Location, key: string, live?: DateOverride[]): { hours?: DateOverride; notice?: DateOverride } {
  const matching = (list: DateOverride[]) => list.filter((o) => inRange(key, o.from, o.to ?? o.from));
  const runtime = matching(live ?? []);
  const staticMatches = matching(loc.overrides ?? []);
  const candidates = (runtime.some((o) => o.hours !== undefined) ? runtime : staticMatches)
    .filter((o) => o.hours !== undefined).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  const first = candidates[0];
  const conflict = first && candidates[1] && (first.priority ?? 0) === (candidates[1].priority ?? 0);
  const notes = [...new Set([...runtime, ...staticMatches].filter((o) => o.hours === undefined).map((o) => o.note))].sort();
  return {
    hours: conflict ? { from: key, hours: 'unknown', note: 'Conflicting schedule overrides; check the official sources' } : first,
    notice: notes.length ? { from: key, note: notes.join(' · ') } : undefined,
  };
}

function findPeriod(cal: Calendar, key: string): CalendarPeriod | undefined {
  // Breaks/summer take precedence over exams, which take precedence over the term itself.
  const matches = cal.periods.filter((p) => inRange(key, p.from, p.to));
  return (
    matches.find((p) => p.kind === 'break' || p.kind === 'summer') ??
    matches.find((p) => p.kind === 'exams') ??
    matches.find((p) => p.kind === 'term')
  );
}

/** Resolve which hours apply to a location on a given local date. */
export function resolveDay(loc: Location, key: string, cal: Calendar, live?: DateOverride[]): ResolvedDay {
  const { hours: ov, notice } = matchOverrides(loc, key, live);
  const res = resolveDayHours(loc, key, cal, ov);
  // A note-only override annotates the day without changing which hours apply.
  if (!notice) return res;
  return { ...res, note: res.note ? `${res.note} · ${notice.note}` : notice.note };
}

function resolveDayHours(loc: Location, key: string, cal: Calendar, ov: DateOverride | undefined): ResolvedDay {
  const dow = dowOf(key);
  const uncertain = (confidence: Location['confidence']) => confidence === 'low' || confidence === 'medium';
  if (loc.sourceConflict) return { hours: 'unknown', source: 'unknown', note: loc.sourceConflict };
  const regular = (): ResolvedDay => {
    if (key > cal.through || (loc.validThrough && key > loc.validThrough)) {
      return { hours: 'unknown', source: 'unknown', note: 'Current schedule coverage has ended; check the official page' };
    }
    if (loc.hours === 'unknown') return { hours: 'unknown', source: 'unknown' };
    if (uncertain(loc.confidence)) return { hours: 'unknown', source: 'unknown', note: 'Schedule is unconfirmed; check the official page' };
    if (loc.hours === 'closed') return { hours: [], source: 'regular' };
    return { hours: loc.hours[dow] ?? [], source: 'regular' };
  };

  // 1. Specific-date overrides (live feed first, then static).
  const h = ov?.hours;
  if (ov && h !== undefined) {
    if (uncertain(ov.confidence)) return { hours: 'unknown', source: 'override', note: ov.note };
    if (h === 'regular') return { ...regular(), note: ov.note, source: 'override' };
    if (h === 'closed') return { hours: [], note: ov.note, source: 'override' };
    if (h === 'unknown') return { hours: 'unknown', note: ov.note, source: 'override' };
    if (isWeek(h)) return { hours: h[dow] ?? [], note: ov.note, source: 'override' };
    return { hours: h, note: ov.note, source: 'override' };
  }

  // 2. University holidays. A location with no published hours (card access, appointments) is
  //    not reported "Closed for <holiday>" unless it opts in; its hours stay unknown.
  const holiday = cal.holidays.find((h) => h.date === key);
  const holidayRule = loc.holidays ?? (loc.hours === 'unknown' ? 'regular' : 'closed');
  if (holiday && holidayRule === 'closed') {
    return { hours: [], note: `Closed for ${holiday.name}`, source: 'holiday' };
  }

  // 3. Past the loaded calendar nothing is known: next year's breaks and holidays are not in the
  //    data yet. Break behavior is not permission to extend calendar coverage.
  if (key > cal.through) {
    return { hours: 'unknown', note: `Hours after ${fmtLongDate(cal.through)} not published yet`, source: 'period' };
  }

  // 4. Named calendar periods (breaks, summer, exams). Exams are part of the term, so hours stay
  //    regular unless the location lists that exam period; `breaks` only applies to breaks/summer.
  const period = findPeriod(cal, key);
  if (period && period.kind !== 'term') {
    const specific = loc.periods?.find((p) => p.period === period.id);
    if (uncertain(specific?.confidence)) return { hours: 'unknown', source: 'period', note: specific?.note ?? 'Unconfirmed period hours' };
    const spec = specific?.hours ?? (period.kind === 'exams' ? 'regular' : (loc.breaks ?? 'unknown'));
    if (spec === 'regular') {
      return specific?.note ? { ...regular(), note: specific.note, source: 'period' } : regular();
    }
    if (spec === 'closed') return { hours: [], note: specific?.note ?? `Closed for ${period.name}`, source: 'period' };
    if (spec === 'unknown') {
      return { hours: 'unknown', note: specific?.note ?? `${period.name}: hours not published yet`, source: 'period' };
    }
    if (!specific && uncertain(loc.confidence)) return regular();
    return { hours: spec[dow] ?? [], note: specific?.note ?? `${period.name} hours`, source: 'period' };
  }

  return regular();
}

/** "Aug 31, 2027" for a date key. */
function fmtLongDate(key: string): string {
  const m = Number(key.slice(5, 7));
  return `${MONTHS[m - 1]} ${Number(key.slice(8, 10))}, ${key.slice(0, 4)}`;
}

function shift(intervals: Interval[], offset: number): Interval[] {
  return intervals.map((i) => ({ ...i, start: i.start + offset, end: i.end + offset }));
}

interface NextOpen {
  key: string;
  start: number;
  minutesUntil: number;
  daysAhead: number;
  unknown?: boolean;
}

function findNextOpen(loc: Location, cal: Calendar, now: LocalTime, todaySpans: Interval[], live?: DateOverride[]): NextOpen | undefined {
  for (const s of todaySpans) {
    if (s.start > now.minutes) return { key: now.key, start: s.start, minutesUntil: s.start - now.minutes, daysAhead: 0 };
  }
  for (let d = 1; d <= LOOKAHEAD_DAYS; d++) {
    const key = addDays(now.key, d);
    const res = resolveDay(loc, key, cal, live);
    if (res.hours === 'unknown') return { key, start: 0, minutesUntil: 0, daysAhead: d, unknown: true };
    const first = mergeContiguous(res.hours)[0];
    if (first) return { key, start: first.start, minutesUntil: d * 1440 - now.minutes + first.start, daysAhead: d };
  }
  return undefined;
}

function describeNextOpen(next: NextOpen | undefined, verb: string): string {
  if (!next) return `Nothing scheduled in the next ${LOOKAHEAD_DAYS} days`;
  if (next.unknown) {
    return next.daysAhead === 1 ? 'Hours not published for tomorrow' : `Hours not published from ${DAY_SHORT[dowOf(next.key)]}`;
  }
  const time = fmtTime(next.start);
  if (next.daysAhead === 0) {
    return next.minutesUntil <= 90 ? `${verb} ${time} (in ${fmtMinutesUntil(next.minutesUntil)})` : `${verb} ${time}`;
  }
  if (next.daysAhead === 1) return `${verb} tomorrow ${time}`;
  if (next.daysAhead < 7) return `${verb} ${DAY_SHORT[dowOf(next.key)]} ${time}`;
  const m = Number(next.key.slice(5, 7));
  const d = Number(next.key.slice(8, 10));
  return `${verb} ${DAY_SHORT[dowOf(next.key)]} ${MONTHS[m - 1]} ${d}, ${time}`;
}

/** Seven-day overview starting today; consecutive days with identical hours are grouped. */
export function weekOverview(loc: Location, cal: Calendar, now: LocalTime, live?: DateOverride[]): HoursLine[] {
  const days = Array.from({ length: 7 }, (_, d) => {
    const key = addDays(now.key, d);
    return { dow: dowOf(key), hours: resolveDay(loc, key, cal, live).hours };
  });
  const lines: HoursLine[] = [];
  const first = days[0]!;
  lines.push({ days: 'Today', text: fmtDay(first.hours), isToday: true });
  let i = 1;
  while (i < days.length) {
    const start = days[i]!;
    let j = i;
    while (j + 1 < days.length && sameDay(days[j + 1]!.hours, start.hours)) j++;
    const label = j === i ? DAY_SHORT[start.dow]! : `${DAY_SHORT[start.dow]}–${DAY_SHORT[days[j]!.dow]}`;
    lines.push({ days: label, text: fmtDay(start.hours) });
    i = j + 1;
  }
  return lines;
}

function sameDay(a: DayHours | 'unknown', b: DayHours | 'unknown'): boolean {
  if (a === 'unknown' || b === 'unknown') return a === b;
  return sameHours(mergeContiguous(a), mergeContiguous(b));
}

export function stateLabel(state: State): string {
  switch (state) {
    case 'open':
      return 'Open';
    case 'closing_soon':
      return 'Closing soon';
    case 'opening_soon':
      return 'Opening soon';
    case 'closed':
      return 'Closed';
    case 'running':
      return 'Running';
    case 'not_running':
      return 'Not running';
    case 'appointment':
      return 'Appointment only';
    case 'special':
      return 'Special access';
    case 'unknown':
      return 'Hours unknown';
  }
}

function nextDepartures(loc: Location, now: LocalTime, includeYesterday: boolean): Status['nextDepartures'] {
  const today = loc.transit?.departures?.[now.dow];
  // Yesterday's timetable may run past midnight (the Friday loop until 2 AM); shift it into today's frame.
  const yesterday = includeYesterday ? loc.transit?.departures?.[(now.dow + 6) % 7] : undefined;
  if (!today && !yesterday) return undefined;
  const out: { stop: string; time: string; inMinutes: number }[] = [];
  for (const stop of new Set([...Object.keys(yesterday ?? {}), ...Object.keys(today ?? {})])) {
    const times = [...(yesterday?.[stop] ?? []).map((t) => t - 1440), ...(today?.[stop] ?? [])].sort((a, b) => a - b);
    const next = times.find((t) => t >= now.minutes);
    if (next !== undefined) out.push({ stop, time: fmtTime(next), inMinutes: next - now.minutes });
  }
  return out.length ? out : undefined;
}

/** Compute the status of one location at a given instant. */
export function computeStatus(loc: Location, cal: Calendar, at: Date, liveOverrides?: LiveOverrides): Status {
  const now = toLocal(at);
  const live = liveOverrides?.[loc.id];
  const isTransit = loc.category === 'transit';
  const todayRes = resolveDay(loc, now.key, cal, live);
  const yesterdayRes = resolveDay(loc, addDays(now.key, -1), cal, live);
  const base = {
    id: loc.id,
    week: weekOverview(loc, cal, now, live),
    isSpecial: todayRes.source !== 'regular' && todayRes.source !== 'unknown',
    scheduleNote: todayRes.note,
  };

  if (todayRes.hours === 'unknown') {
    // Nothing is published for today. A facility with a known access model (card access,
    // appointments) is labelled with it, but the state stays 'unknown': nothing is claimed to be
    // open, so the card is not counted by the Open-now filter at 3 AM or on a holiday.
    const access = loc.hours === 'unknown' && (loc.access === 'special' || loc.access === 'appointment') ? loc.access : undefined;
    return {
      ...base,
      state: 'unknown',
      label: stateLabel(access ?? 'unknown'),
      detail: todayRes.note ?? (access ? 'No posted hours; see details' : 'Check the official page for hours'),
      today: 'Hours not published',
      todayPeriods: [],
    };
  }

  const todayHours = todayRes.hours;
  const yesterdayHours = yesterdayRes.hours === 'unknown' ? [] : yesterdayRes.hours;
  const m = now.minutes;

  // Effective intervals relative to today's midnight, including yesterday's overnight spill.
  const raw = [...shift(yesterdayHours, -1440), ...todayHours];
  const todaySpans = mergeContiguous(todayHours);
  const spans = mergeContiguous([...shift(yesterdayHours, -1440), ...todayHours]).filter((s) => s.end > 0);
  const span = spans.find((s) => s.start <= m && m < s.end);

  const todayText = fmtDay(todayHours);
  const todayPeriods = fmtPeriods(todayHours);
  const departures = todayRes.source === 'regular' ? nextDepartures(loc, now, yesterdayRes.source === 'regular') : undefined;

  if (span) {
    const closingSoon = loc.closingSoonMinutes ?? 30;
    const minutesToEnd = span.end - m;
    const period = raw.find((i) => (i.label || i.access) && i.start <= m && m < i.end);
    const reopens = spans.find((s) => s.start >= span.end);

    let state: State;
    if (period?.access === 'unknown') state = 'unknown';
    else if (isTransit) state = 'running';
    else if ((period?.access ?? loc.access) === 'appointment') state = 'appointment';
    else if ((period?.access ?? loc.access) === 'special') state = 'special';
    else state = minutesToEnd <= closingSoon ? 'closing_soon' : 'open';

    const endTime = fmtTime(span.end);
    const verb = isTransit ? 'Runs until' : 'Closes';
    let detail = minutesToEnd <= 90 ? `${verb} ${endTime} (in ${fmtMinutesUntil(minutesToEnd)})` : `${verb} ${endTime}`;
    if (reopens) detail += `, back ${fmtTime(reopens.start)}`;
    if (state === 'unknown') detail = 'Access hours unconfirmed; check the official page';

    return {
      ...base,
      state,
      label: stateLabel(state),
      detail,
      period: period?.label,
      periodEnds: period && period.end < span.end ? fmtTime(period.end) : undefined,
      today: todayText,
      todayPeriods,
      nextDepartures: departures,
      changesInMinutes: minutesToEnd,
    };
  }

  const next = findNextOpen(loc, cal, now, todaySpans, live);
  const soon = next && !next.unknown && next.minutesUntil <= OPENING_SOON_MINUTES;
  const state: State = soon ? 'opening_soon' : isTransit ? 'not_running' : 'closed';
  return {
    ...base,
    state,
    label: stateLabel(state),
    detail: describeNextOpen(next, isTransit ? 'Next run' : 'Opens'),
    today: todayText,
    todayPeriods,
    nextDepartures: departures,
    changesInMinutes: next && !next.unknown ? next.minutesUntil : undefined,
  };
}

export function computeAll(locations: Location[], cal: Calendar, at: Date, live?: LiveOverrides): Status[] {
  return locations.map((l) => computeStatus(l, cal, at, live));
}

/** Human description of the calendar context for a date: "Fall semester", "Thanksgiving recess", "Labor Day". */
export function calendarContext(cal: Calendar, at: Date): { label: string; kind: CalendarPeriod['kind'] | 'holiday' | 'none' } {
  const now = toLocal(at);
  if (now.key > cal.through) return { label: `Calendar not loaded past ${fmtLongDate(cal.through)}`, kind: 'none' };
  const holiday = cal.holidays.find((h) => h.date === now.key);
  if (holiday) return { label: holiday.name, kind: 'holiday' };
  const period = findPeriod(cal, now.key);
  if (period && period.kind !== 'term') return { label: period.name, kind: period.kind };
  const info = cal.periods.find((p) => p.kind === 'info' && inRange(now.key, p.from, p.to));
  if (info) return { label: info.name, kind: 'info' };
  if (period) return { label: period.name, kind: period.kind };
  return { label: 'Between terms', kind: 'none' };
}
