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

/** Convert a local date key + minutes-since-midnight into an absolute Date. */
export function localToDate(key: string, minutes: number): Date {
  const { y, m, d } = parseKey(key);
  const naive = Date.UTC(y, m - 1, d) + minutes * 60000;
  let guess = new Date(naive - tzOffsetMinutes(new Date(naive)) * 60000);
  // One refinement handles DST boundaries.
  guess = new Date(naive - tzOffsetMinutes(guess) * 60000);
  return guess;
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "Thu, Sep 3" style date label for a key. */
export function fmtDateKey(key: string): string {
  const { y, m, d } = parseKey(key);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' }).format(dt);
}
