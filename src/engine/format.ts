import type { DayHours, Interval } from './types';

/** 1260 -> "9:00 PM", 0 -> "12:00 AM", 1440 -> "12:00 AM". */
export function fmtTime(minutes: number, opts: { compact?: boolean } = {}): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const min = m % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  if (opts.compact && min === 0) return `${h12} ${ampm}`;
  return `${h12}:${String(min).padStart(2, '0')} ${ampm}`;
}

/** Range with the AM/PM dropped from the start when both sides share it: "7:00 – 10:30 AM". */
export function fmtRange(i: Interval): string {
  const a = fmtTime(i.start);
  const b = fmtTime(i.end);
  const aSuffix = a.slice(-2);
  const bSuffix = b.slice(-2);
  if (aSuffix === bSuffix && i.end - i.start < 720) return `${a.slice(0, -3)} – ${b}`;
  return `${a} – ${b}`;
}

/** "7:00 AM – 9:00 PM" or "8:00 AM – 12:00 PM, 1:00 – 5:00 PM" or "Closed". */
export function fmtDay(day: DayHours | 'closed' | 'unknown'): string {
  if (day === 'unknown') return 'Hours not published';
  if (day === 'closed' || day.length === 0) return 'Closed';
  return mergeContiguous(day).map(fmtRange).join(', ');
}

/** Labeled periods for a day: ["Breakfast: 7:00 – 10:30 AM", …]. */
export function fmtPeriods(day: DayHours): string[] {
  return day.filter((i) => i.label).map((i) => `${i.label}: ${fmtRange(i)}`);
}

/** Merge touching/overlapping intervals into spans for the overview line. */
export function mergeContiguous(day: DayHours): Interval[] {
  const sorted = [...day].sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) {
      last.end = Math.max(last.end, i.end);
    } else {
      out.push({ start: i.start, end: i.end });
    }
  }
  return out;
}

export function fmtMinutesUntil(mins: number): string {
  if (mins <= 1) return '1 min';
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return h === 1 ? '1 hr' : `${h} hr`;
  return `${h} hr ${m} min`;
}

export function sameHours(a: DayHours, b: DayHours): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, i) => {
    const y = b[i]!;
    return x.start === y.start && x.end === y.end && (x.label ?? '') === (y.label ?? '');
  });
}

/** Parse "7:00", "7:30am", "21:15", "9pm" into minutes. Used by data files for readability. */
export function t(text: string): number {
  const s = text.trim().toLowerCase();
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(s);
  if (!match) throw new Error(`Bad time: ${text}`);
  let h = Number(match[1]);
  const min = Number(match[2] ?? '0');
  const ap = match[3];
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return h * 60 + min;
}

/** Interval builder: r('7am','9pm','Dinner'). End earlier than start means overnight. */
export function r(start: string, end: string, label?: string): Interval {
  const s = t(start);
  let e = t(end);
  if (e <= s) e += 1440;
  return label ? { start: s, end: e, label } : { start: s, end: e };
}
