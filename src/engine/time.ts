/**
 * Timezone helpers for America/New_York without any dependencies.
 * "Date keys" are YYYY-MM-DD strings in local (campus) time.
 */

export const TZ = 'America/New_York';

export interface LocalTime {
  key: string; // YYYY-MM-DD
  y: number;
  m: number; // 1-12
  d: number; // 1-31
  dow: number; // 0 = Sunday
  minutes: number; // minutes since local midnight
}

const partsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  weekday: 'short',
});

const DOW: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function toLocal(date: Date): LocalTime {
  const parts = partsFormatter.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const y = Number(get('year'));
  const m = Number(get('month'));
  const d = Number(get('day'));
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  return {
    key: dateKey(y, m, d),
    y,
    m,
    d,
    dow: DOW[get('weekday')] ?? new Date(Date.UTC(y, m - 1, d)).getUTCDay(),
    minutes: hour * 60 + minute,
  };
}

export function dateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function parseKey(key: string): { y: number; m: number; d: number } {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return { y, m, d };
}

/** Add whole days to a date key (pure calendar math, DST-safe). */
export function addDays(key: string, n: number): string {
  const { y, m, d } = parseKey(key);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dateKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function dowOf(key: string): number {
  const { y, m, d } = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Inclusive range check on date keys (lexical compare works for ISO dates). */
export function inRange(key: string, from: string, to: string): boolean {
  return key >= from && key <= to;
}

/** Offset (minutes) of America/New_York from UTC at a given instant. */
function tzOffsetMinutes(at: Date): number {
  const parts = partsFormatter.formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'));
  // Drop seconds/ms from `at` so the difference is a whole number of minutes.
  const atMinute = Math.floor(at.getTime() / 60000) * 60000;
  return Math.round((asUtc - atMinute) / 60000);
}

/**
 * Convert campus wall time to an instant. Calendar arithmetic normalizes overnight
 * minutes first. Repeated times choose the earlier occurrence; nonexistent times
 * shift forward by the gap (02:30 becomes 03:30 at the spring transition).
 */
export function localToDate(key: string, minutes: number): Date {
  const { y, m, d } = parseKey(key);
  const naive = Date.UTC(y, m - 1, d) + minutes * 60000;
  // New York is behind UTC, so this probe precedes a repeated local boundary
  // and picks its first occurrence. Most dates need only this checked candidate.
  const offset = tzOffsetMinutes(new Date(naive));
  const guess = naive - offset * 60000;
  if (tzOffsetMinutes(new Date(guess)) === offset) return new Date(guess);
  // Sampling on both sides finds both offsets even when the requested wall time
  // is inside a gap/fold. These are offset probes, not calendar-day additions.
  const offsets = new Set([-1, 1].map(day => tzOffsetMinutes(new Date(naive + day * 86400000))));
  const candidates = [...offsets].map(offset => naive - offset * 60000).sort((a, b) => a - b);
  const exact = candidates.find(candidate => candidate + tzOffsetMinutes(new Date(candidate)) * 60000 === naive);
  return new Date(exact ?? candidates[candidates.length - 1]!);
}

/** Request-scoped conversion reuse. Never retains schedules or live snapshots. */
export function createTimeContext() {
  const dates = new Map<string, { local: Omit<LocalTime, 'minutes'>; naive: number; offset?: number }>();
  const boundaries = new Map<string, number>();
  const locals = new Map<number, LocalTime>();
  const windows = new Map<string, { key: string; start: number; end: number; dow: number }[]>();
  const local = (instant: number): LocalTime => {
    let result = locals.get(instant);
    if (!result) { result = toLocal(new Date(instant)); locals.set(instant, result); }
    return result;
  };
  const boundary = (key: string, minutes: number): number => {
    const date = minutes >= 0 && minutes < 1440 ? key : addDays(key, Math.floor(minutes / 1440));
    const minute = ((minutes % 1440) + 1440) % 1440;
    const id = `${date}/${minute}`;
    const existing = boundaries.get(id);
    if (existing !== undefined) return existing;
    let day = dates.get(date);
    if (!day) {
      const { y, m, d } = parseKey(date);
      const naive = Date.UTC(y, m - 1, d);
      // These probes bracket the entire campus calendar day, including the
      // early-morning DST transition. Equal offsets permit pure arithmetic for
      // all of this day's boundaries; transition dates use the checked resolver.
      const before = tzOffsetMinutes(new Date(naive));
      const after = tzOffsetMinutes(new Date(naive + 36 * 3600000));
      day = { naive, local: { key: date, y, m, d, dow: new Date(naive).getUTCDay() }, offset: before === after ? before : undefined };
      dates.set(date, day);
    }
    const instant = day.offset === undefined ? localToDate(date, minute).getTime() : day.naive + (minute - day.offset) * 60000;
    boundaries.set(id, instant);
    if (day.offset !== undefined) locals.set(instant, { ...day.local, minutes: minute });
    return instant;
  };
  const window = (key: string, lookahead: number) => {
    const id = `${key}/${lookahead}`;
    let days = windows.get(id);
    if (!days) {
      const { y, m, d } = parseKey(key);
      const points = Array.from({ length: lookahead + 3 }, (_, i) => {
        const date = new Date(Date.UTC(y, m - 1, d + i - 1));
        const key = dateKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
        return { key, start: boundary(key, 0), dow: date.getUTCDay() };
      });
      days = points.slice(0, -1).map((day, i) => ({ ...day, end: points[i + 1]!.start }));
      windows.set(id, days);
    }
    return days;
  };
  return { boundary, local, window };
}

export type TimeContext = ReturnType<typeof createTimeContext>;

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Thu, Sep 3" style date label for a key. */
export function fmtDateKey(key: string): string {
  const { y, m, d } = parseKey(key);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(dt);
}
