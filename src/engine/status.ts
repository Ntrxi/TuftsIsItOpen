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
import { addDays, createTimeContext, DAY_SHORT, dowOf, inRange, toLocal, type LocalTime, type TimeContext } from './time';
import { fmtDay, fmtMinutesUntil, fmtPeriods, fmtTime, mergeContiguous, sameHours } from './format';

const LOOKAHEAD_DAYS = 60;
const OPENING_SOON_MINUTES = 30;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface ResolvedDay {
  hours: DayHours | 'unknown';
  /** Published service tails survive schedule changes; explicit dated closures/unknown days stop them. */
  allowsCarryover: boolean;
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
  return resolveKnownDate(loc, key, dowOf(key), cal, live);
}

function resolveKnownDate(loc: Location, key: string, dow: number, cal: Calendar, live?: DateOverride[]): ResolvedDay {
  const { hours: ov, notice } = matchOverrides(loc, key, live);
  const resolved = resolveDayHours(loc, key, dow, cal, ov);
  const res: ResolvedDay = { ...resolved, allowsCarryover: resolved.hours !== 'unknown' && resolved.allowsCarryover === true };
  // A note-only override annotates the day without changing which hours apply.
  if (!notice) return res;
  return { ...res, note: res.note ? `${res.note} · ${notice.note}` : notice.note };
}

type DayResolution = Omit<ResolvedDay, 'allowsCarryover'> & { allowsCarryover?: true };

function resolveDayHours(loc: Location, key: string, dow: number, cal: Calendar, ov: DateOverride | undefined): DayResolution {
  const uncertain = (confidence: Location['confidence']) => confidence === 'low' || confidence === 'medium';
  if (loc.sourceConflict) return { hours: 'unknown', source: 'unknown', note: loc.sourceConflict };
  const conflict = loc.overrides?.find((o) => o.sourceConflict && inRange(key, o.from, o.to ?? o.from));
  if (conflict) return { hours: 'unknown', source: 'override', note: conflict.note };
  const regular = (): DayResolution => {
    if (key > cal.through || (loc.validThrough && key > loc.validThrough)) {
      return { hours: 'unknown', source: 'unknown', note: 'Current schedule coverage has ended; check the official page' };
    }
    if (loc.hours === 'unknown') return { hours: 'unknown', source: 'unknown' };
    if (uncertain(loc.confidence)) return { hours: 'unknown', source: 'unknown', note: 'Schedule is unconfirmed; check the official page' };
    if (loc.hours === 'closed') return { hours: [], source: 'regular', allowsCarryover: true };
    return { hours: loc.hours[dow] ?? [], source: 'regular', allowsCarryover: true };
  };

  // 1. Specific-date overrides (live feed first, then static).
  const h = ov?.hours;
  if (ov && h !== undefined) {
    if (uncertain(ov.confidence)) return { hours: 'unknown', source: 'override', note: ov.note };
    if (h === 'regular') return { ...regular(), note: ov.note, source: 'override' };
    if (h === 'closed') return { hours: [], note: ov.note, source: 'override' };
    if (h === 'unknown') return { hours: 'unknown', note: ov.note, source: 'override' };
    if (isWeek(h)) return { hours: h[dow] ?? [], note: ov.note, source: 'override', allowsCarryover: true };
    return { hours: h, note: ov.note, source: 'override', ...(h.length ? { allowsCarryover: true as const } : {}) };
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
    if (spec === 'closed') return { hours: [], note: specific?.note ?? `Closed for ${period.name}`, source: 'period', allowsCarryover: true };
    if (spec === 'unknown') {
      return { hours: 'unknown', note: specific?.note ?? `${period.name}: hours not published yet`, source: 'period' };
    }
    if (!specific && uncertain(loc.confidence)) return regular();
    return { hours: spec[dow] ?? [], note: specific?.note ?? `${period.name} hours`, source: 'period', allowsCarryover: true };
  }

  return regular();
}

/** "Aug 31, 2027" for a date key. */
function fmtLongDate(key: string): string {
  const m = Number(key.slice(5, 7));
  return `${MONTHS[m - 1]} ${Number(key.slice(8, 10))}, ${key.slice(0, 4)}`;
}

interface TimelineDay {
  key: string;
  start: number;
  end: number;
  resolved: ResolvedDay;
  hours: DayHours | 'unknown';
  invalid?: boolean;
}

/** Absolute milliseconds, with original service ownership retained after clipping. */
interface TimelineInterval extends Interval {
  serviceDate: string;
  cutoff?: TimelineDay;
}

interface Timeline {
  days: TimelineDay[];
  intervals: TimelineInterval[];
  spans: Interval[];
  limit: number;
  time: TimeContext;
}

function resolveTimeline(loc: Location, cal: Calendar, key: string, time: TimeContext, live?: DateOverride[], lookahead = LOOKAHEAD_DAYS): Timeline {
  const { boundary } = time;
  const grid = time.window(key, lookahead);
  const days: TimelineDay[] = grid.map(day => ({
    ...day, resolved: resolveKnownDate(loc, day.key, day.dow, cal, live), hours: [],
  }));
  const limit = grid[grid.length - 1]!.end;
  const candidates: TimelineInterval[] = [];
  for (const day of days) {
    if (day.resolved.hours === 'unknown') continue;
    for (const interval of day.resolved.hours) {
      const valid = Number.isFinite(interval.start) && Number.isFinite(interval.end) && interval.end > interval.start;
      const start = valid ? boundary(day.key, interval.start) : 0;
      const end = valid ? boundary(day.key, interval.end) : 0;
      if (end <= start) {
        // Preserve independently valid periods. Do not mislabel malformed input
        // as a daylight-saving problem or invalidate the entire day's schedule.
        day.invalid = true;
      } else {
        candidates.push({ ...interval, start, end, serviceDate: day.key });
      }
    }
  }
  const intervals: TimelineInterval[] = [];
  for (const interval of candidates) {
    const barrier = days.find(day => day.key > interval.serviceDate && !day.resolved.allowsCarryover);
    const end = Math.min(interval.end, barrier?.start ?? limit, limit);
    if (end > interval.start) intervals.push({ ...interval, end, cutoff: barrier && barrier.start < interval.end ? barrier : undefined });
  }
  for (const day of days) {
    // Display service-start-day ranges, preserving their overnight ends. Only
    // explicit closure/unknown boundaries clip them; midnight itself does not.
    day.hours = day.resolved.hours === 'unknown' ? 'unknown' : intervals
      .filter(i => i.serviceDate === day.key)
      .map(i => ({
        start: relativeMinutes(time.local(i.start), day.key),
        end: relativeMinutes(time.local(i.end), day.key),
        ...(i.label ? { label: i.label } : {}), ...(i.access ? { access: i.access } : {}),
      }));
  }
  return { days, intervals, spans: mergeContiguous(intervals), limit, time };
}

function relativeMinutes(local: LocalTime, key: string): number {
  return local.minutes + Math.round((Date.UTC(local.y, local.m - 1, local.d) - Date.parse(key)) / 86400000) * 1440;
}

const contains = (interval: Interval, at: number): boolean => interval.start <= at && at < interval.end;
const currentSpan = (timeline: Timeline, at: number): Interval | undefined => timeline.spans.find(span => contains(span, at));
const openingThreshold = (start: number): number => start - OPENING_SOON_MINUTES * 60000;
const closingThreshold = (loc: Location, span: Interval): number => span.end - (loc.closingSoonMinutes ?? 30) * 60000;

/** Seven days usually contain every needed boundary; expand only for unresolved lookahead. */
function statusTimeline(loc: Location, cal: Calendar, key: string, at: number, time: TimeContext, live?: DateOverride[]): Timeline {
  const week = resolveTimeline(loc, cal, key, time, live, 7);
  const current = currentSpan(week, at);
  const needsMore = current ? current.end === week.limit
    : unknownAt(week, at) ? !week.days.some(day => day.start > at && day.hours !== 'unknown')
    : nextEvent(week, at) === undefined;
  return needsMore ? resolveTimeline(loc, cal, key, time, live) : week;
}

function unknownAt(timeline: Timeline, at: number): boolean {
  return timeline.days.some(day => day.hours === 'unknown' && contains(day, at));
}

function confirmedEnd(timeline: Timeline, span: Interval): boolean {
  return span.end < timeline.limit && !unknownAt(timeline, span.end);
}

function nextEvent(timeline: Timeline, at: number): { at: number; unknown: boolean } | undefined {
  const opening = timeline.spans.find(span => span.start > at)?.start;
  const unknown = timeline.days.find(day => day.start > at && day.hours === 'unknown')?.start;
  if (unknown !== undefined && (opening === undefined || unknown <= opening)) return { at: unknown, unknown: true };
  return opening === undefined ? undefined : { at: opening, unknown: false };
}

function periodAt(timeline: Timeline, at: number): TimelineInterval | undefined {
  // Preserve the previous engine's first matching labeled/access interval precedence.
  return timeline.intervals.find(i => (i.label || i.access) && contains(i, at));
}

function signature(loc: Location, timeline: Timeline, at: number): { state: State; access?: Interval['access']; period?: string } {
  if (unknownAt(timeline, at)) return { state: 'unknown' };
  const span = currentSpan(timeline, at);
  if (!span) {
    const next = nextEvent(timeline, at);
    const soon = next && !next.unknown && at >= openingThreshold(next.at);
    return { state: soon ? 'opening_soon' : loc.category === 'transit' ? 'not_running' : 'closed' };
  }
  const period = periodAt(timeline, at);
  const access = period?.access ?? loc.access ?? 'open';
  let state: State;
  if (access === 'unknown') state = 'unknown';
  else if (loc.category === 'transit') state = 'running';
  else if (access === 'appointment' || access === 'special') state = access;
  else state = confirmedEnd(timeline, span) && at >= closingThreshold(loc, span) ? 'closing_soon' : 'open';
  return { state, access, period: period?.label };
}

function transitions(loc: Location, timeline: Timeline, at: number): Pick<Status, 'nextTransitionAt' | 'accessChangesAt' | 'closesAt' | 'changesInMinutes'> {
  const current = currentSpan(timeline, at);
  const candidates = new Set<number>();
  // A calendar boundary alone is not a transition. Only knowledge changes need
  // a midnight candidate; availability/access boundaries come from intervals.
  for (let i = 1; i < timeline.days.length; i++) {
    if ((timeline.days[i]!.hours === 'unknown') !== (timeline.days[i - 1]!.hours === 'unknown')) candidates.add(timeline.days[i]!.start);
  }
  for (const i of timeline.intervals) { candidates.add(i.start); candidates.add(i.end); }
  for (const span of timeline.spans) {
    candidates.add(openingThreshold(span.start));
    if (confirmedEnd(timeline, span)) candidates.add(closingThreshold(loc, span));
  }
  let next: number | undefined;
  let access: number | undefined;
  for (const boundary of [...candidates].filter(b => b > at && b < timeline.limit).sort((a, b) => a - b)) {
    const before = signature(loc, timeline, boundary - 1);
    const after = signature(loc, timeline, boundary);
    if (next === undefined && (before.state !== after.state || before.access !== after.access || before.period !== after.period)) next = boundary;
    if (current && boundary < current.end && before.access !== after.access) access ??= boundary;
    if (next !== undefined && (!current || access !== undefined || boundary >= current.end)) break;
  }
  return {
    nextTransitionAt: next === undefined ? undefined : new Date(next).toISOString(),
    accessChangesAt: access === undefined ? undefined : new Date(access).toISOString(),
    closesAt: current && confirmedEnd(timeline, current) ? new Date(current.end).toISOString() : undefined,
    changesInMinutes: next === undefined ? undefined : Math.ceil((next - at) / 60000),
  };
}

interface NextOpen {
  key: string;
  start: number;
  minutesUntil: number;
  daysAhead: number;
  unknown?: boolean;
}

function findNextOpen(timeline: Timeline, at: number): NextOpen | undefined {
  const next = nextEvent(timeline, at);
  if (!next) return undefined;
  const local = timeline.time.local(next.at);
  const daysAhead = timeline.days.findIndex(day => day.key === local.key) - 1;
  return { key: local.key, start: local.minutes, minutesUntil: Math.ceil((next.at - at) / 60000), daysAhead, unknown: next.unknown };
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

function timelineOverview(timeline: Timeline): HoursLine[] {
  const days = timeline.days.slice(1, 8).map(day => ({ dow: dowOf(day.key), hours: day.hours }));
  const lines: HoursLine[] = [];
  const first = days[0]!;
  lines.push({ days: 'Today', text: displayDay(first.hours), isToday: true });
  let i = 1;
  while (i < days.length) {
    const start = days[i]!;
    let j = i;
    while (j + 1 < days.length && sameDay(days[j + 1]!.hours, start.hours)) j++;
    const label = j === i ? DAY_SHORT[start.dow]! : `${DAY_SHORT[start.dow]}–${DAY_SHORT[days[j]!.dow]}`;
    lines.push({ days: label, text: displayDay(start.hours) });
    i = j + 1;
  }
  return lines;
}

function displayDay(hours: DayHours | 'unknown'): string {
  return fmtDay(hours === 'unknown' ? hours : mergeContiguous(hours));
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

function nextDepartures(loc: Location, now: LocalTime, timeline: Timeline): Status['nextDepartures'] {
  const todayDay = timeline.days[1]!;
  const today = todayDay.resolved.source === 'regular' ? loc.transit?.departures?.[now.dow] : undefined;
  // Yesterday's timetable may run past midnight (the Friday loop until 2 AM); shift it into today's frame.
  const yesterday = timeline.days[0]!.resolved.source === 'regular' && todayDay.resolved.allowsCarryover
    ? loc.transit?.departures?.[(now.dow + 6) % 7] : undefined;
  if (!today && !yesterday) return undefined;
  const out: { stop: string; time: string; inMinutes: number }[] = [];
  for (const stop of new Set([...Object.keys(yesterday ?? {}), ...Object.keys(today ?? {})])) {
    const todayTimes = (today?.[stop] ?? []).filter(t => t < 1440 || timeline.days[2]!.resolved.allowsCarryover);
    const times = [...(yesterday?.[stop] ?? []).map((t) => t - 1440), ...todayTimes].sort((a, b) => a - b);
    const next = times.find((t) => t >= now.minutes);
    if (next !== undefined) out.push({ stop, time: fmtTime(next), inMinutes: next - now.minutes });
  }
  return out.length ? out : undefined;
}

/** Compute the status of one location at a given instant. */
export function computeStatus(loc: Location, cal: Calendar, at: Date, liveOverrides?: LiveOverrides): Status {
  return statusWithTime(loc, cal, at.getTime(), createTimeContext(), liveOverrides);
}

function statusWithTime(loc: Location, cal: Calendar, instant: number, time: TimeContext, liveOverrides?: LiveOverrides): Status {
  const now = time.local(instant);
  const live = liveOverrides?.[loc.id];
  const isTransit = loc.category === 'transit';
  const timeline = statusTimeline(loc, cal, now.key, instant, time, live);
  const today = timeline.days[1]!;
  const todayRes = today.resolved;
  const transition = transitions(loc, timeline, instant);
  const cutoff = timeline.intervals.find(i => i.serviceDate === now.key && i.cutoff)?.cutoff;
  const carryover = timeline.intervals.filter(i => i.serviceDate < now.key && contains(i, instant));
  const carryoverEnd = carryover.length ? Math.max(...carryover.map(i => i.end)) : undefined;
  const notes = [todayRes.note];
  if (cutoff) notes.push(`${cutoff.hours === 'unknown' ? 'Overnight hours are unknown after midnight' : 'Overnight service ends at midnight'}: ${cutoff.resolved.note ?? 'Check the next day’s schedule'}`);
  if (carryoverEnd !== undefined) notes.push(`Overnight service from yesterday until ${fmtTime(time.local(carryoverEnd).minutes)}`);
  if (today.invalid) notes.push('An invalid schedule interval was omitted; check the official page');
  const week = timelineOverview(timeline);
  const todayText = Array.isArray(today.hours) && today.hours.length === 0 && carryover.length
    ? 'No service starts today' : displayDay(today.hours);
  week[0]!.text = todayText;
  const base = {
    id: loc.id,
    week,
    isSpecial: !!cutoff || (todayRes.source !== 'regular' && todayRes.source !== 'unknown'),
    scheduleNote: notes.filter(Boolean).join(' · ') || undefined,
    ...transition,
  };

  if (today.hours === 'unknown') {
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

  const span = currentSpan(timeline, instant);
  const todayPeriods = fmtPeriods(today.hours);
  // Each service date controls its own timetable provenance. A seasonal change
  // can stop today's new runs without suppressing yesterday's published tail.
  const departures = nextDepartures(loc, now, timeline);
  const { state } = signature(loc, timeline, instant);

  if (span) {
    const minutesToEnd = Math.ceil((span.end - instant) / 60000);
    const period = periodAt(timeline, instant);
    const next = nextEvent(timeline, span.end - 1);
    const reopens = next && !next.unknown && next.at < today.end ? next.at : undefined;
    const tomorrow = timeline.days[2]!;
    const continuous = span.start <= today.start && span.end >= tomorrow.end;
    const uncertain = span.end < timeline.limit && !confirmedEnd(timeline, span);
    const endLocal = time.local(span.end);
    const endTime = fmtTime(endLocal.minutes);
    const datedEnd = endLocal.key > addDays(now.key, 1)
      ? `${DAY_SHORT[endLocal.dow]}, ${MONTHS[endLocal.m - 1]} ${endLocal.d}${endLocal.y !== now.y ? `, ${endLocal.y}` : ''} at ${endTime}`
      : endLocal.key > now.key ? `tomorrow at ${endTime}` : endTime;
    const verb = isTransit ? 'Runs until' : 'Closes';
    let detail = uncertain
      ? `Hours not published from ${endLocal.key === addDays(now.key, 1) ? 'tomorrow' : fmtLongDate(endLocal.key)} at ${endTime}`
      : continuous && !confirmedEnd(timeline, span) ? 'Available 24 hours'
      : !confirmedEnd(timeline, span) ? `No closing time in the next ${LOOKAHEAD_DAYS} days`
      : minutesToEnd <= 90 ? `${verb} ${datedEnd} (in ${fmtMinutesUntil(minutesToEnd)})` : `${verb} ${datedEnd}`;
    if (reopens !== undefined && !uncertain) detail += `, back ${fmtTime(time.local(reopens).minutes)}`;
    if (state === 'unknown') detail = 'Access hours unconfirmed; check the official page';

    return {
      ...base,
      state,
      label: stateLabel(state),
      detail,
      period: period?.label,
      periodEnds: period && period.end < span.end ? fmtTime(time.local(period.end).minutes) : undefined,
      today: todayText,
      todayPeriods,
      nextDepartures: departures,
    };
  }

  const next = findNextOpen(timeline, instant);
  return {
    ...base,
    state,
    label: stateLabel(state),
    detail: describeNextOpen(next, isTransit ? 'Next run' : 'Opens'),
    today: todayText,
    todayPeriods,
    nextDepartures: departures,
  };
}

export function computeAll(locations: Location[], cal: Calendar, at: Date, live?: LiveOverrides): Status[] {
  const time = createTimeContext();
  return locations.map((l) => statusWithTime(l, cal, at.getTime(), time, live));
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
