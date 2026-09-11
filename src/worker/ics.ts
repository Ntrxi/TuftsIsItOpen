/**
 * Minimal iCalendar reader for public Google Calendar feeds. It expands the recurrence
 * features Google actually emits for simple schedules (weekly/daily rules with BYDAY,
 * INTERVAL, UNTIL, COUNT, EXDATE, and per-instance RECURRENCE-ID overrides) into dated
 * instances in America/New_York. Anything it does not understand throws, so a provider
 * fails closed instead of guessing.
 */
import { addDays, dowOf, TZ, toLocal } from '../engine/time';
import { dateKey } from '../engine/validation';

/** A wall-clock moment on the campus calendar. */
export interface IcsStamp {
  key: string;
  minutes: number;
  allDay?: boolean;
}

interface IcsEvent {
  uid: string;
  summary: string;
  start: IcsStamp;
  end: IcsStamp;
  rrule?: Record<string, string>;
  exdates: IcsStamp[];
  recurrenceId?: IcsStamp;
  cancelled: boolean;
}

/** One dated occurrence. `end` is minutes from the start date's midnight and may exceed 1440. */
export interface IcsInstance {
  uid: string;
  summary: string;
  key: string;
  start: number;
  end: number;
  allDay: boolean;
}

export interface IcsExpansion {
  instances: IcsInstance[];
  /** Occurrences of recurring events that the calendar explicitly removed (EXDATE) inside the window. */
  removed: { uid: string; summary: string; key: string }[];
}

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const MAX_ITERATIONS = 4000;
const RRULE_KEYS = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', 'BYDAY', 'WKST']);

function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, c: string) => (c === 'n' || c === 'N' ? '\n' : c));
}

function parseStamp(params: string[], value: string): IcsStamp {
  const tzid = params.find((p) => p.startsWith('TZID='))?.slice(5);
  if (params.includes('VALUE=DATE')) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
    if (!m) throw new Error(`Invalid iCalendar date ${value}`);
    const key = `${m[1]}-${m[2]}-${m[3]}`;
    if (!dateKey(key)) throw new Error(`Invalid iCalendar date ${value}`);
    return { key, minutes: 0, allDay: true };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
  if (!m) throw new Error(`Invalid iCalendar date-time ${value}`);
  const [y, mo, d, h, mi, sec] = m.slice(1, 7).map(Number) as [number, number, number, number, number, number];
  if (m[7] === 'Z') {
    const local = toLocal(new Date(Date.UTC(y, mo - 1, d, h, mi, sec)));
    return { key: local.key, minutes: local.minutes };
  }
  if (tzid !== undefined && tzid !== TZ) throw new Error(`Unsupported time zone ${tzid}`);
  const key = `${m[1]}-${m[2]}-${m[3]}`;
  if (!dateKey(key) || h > 23 || mi > 59) throw new Error(`Invalid iCalendar date-time ${value}`);
  return { key, minutes: h * 60 + mi };
}

function parseRrule(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of value.split(';')) {
    const [k, v] = part.split('=');
    if (!k || v === undefined || !RRULE_KEYS.has(k)) throw new Error(`Unsupported RRULE part ${part}`);
    out[k] = v;
  }
  if (out.FREQ !== 'WEEKLY' && out.FREQ !== 'DAILY') throw new Error(`Unsupported RRULE frequency ${out.FREQ}`);
  return out;
}

/** Split an iCalendar text into events. Throws on anything that is not a calendar. */
export function parseIcs(text: string): IcsEvent[] {
  const unfolded = text.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  if (!/^BEGIN:VCALENDAR/m.test(unfolded)) throw new Error('Not an iCalendar document');
  const events: IcsEvent[] = [];
  for (const block of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0] ?? '';
    const props: { name: string; params: string[]; value: string }[] = [];
    for (const line of body.split('\n')) {
      const colon = line.indexOf(':');
      if (colon <= 0) continue;
      const [name, ...params] = line.slice(0, colon).split(';');
      props.push({ name: name!.toUpperCase(), params, value: line.slice(colon + 1) });
    }
    const one = (name: string) => props.filter((p) => p.name === name);
    const uid = one('UID')[0]?.value;
    const dtstart = one('DTSTART')[0];
    if (!uid || !dtstart) throw new Error('Event without UID or DTSTART');
    const start = parseStamp(dtstart.params, dtstart.value);
    const dtend = one('DTEND')[0];
    const end = dtend ? parseStamp(dtend.params, dtend.value) : start.allDay ? { key: addDays(start.key, 1), minutes: 0, allDay: true } : start;
    if (!!end.allDay !== !!start.allDay) throw new Error('Mixed all-day and timed event bounds');
    const rrule = one('RRULE')[0];
    const recurrence = one('RECURRENCE-ID')[0];
    events.push({
      uid,
      summary: unescapeText(one('SUMMARY')[0]?.value ?? ''),
      start,
      end,
      rrule: rrule ? parseRrule(rrule.value) : undefined,
      exdates: one('EXDATE').flatMap((p) => p.value.split(',').map((v) => parseStamp(p.params, v))),
      recurrenceId: recurrence ? parseStamp(recurrence.params, recurrence.value) : undefined,
      cancelled: (one('STATUS')[0]?.value ?? '').toUpperCase() === 'CANCELLED',
    });
  }
  return events;
}

const stampId = (s: IcsStamp): string => `${s.key}/${s.minutes}`;
const dayDiff = (a: string, b: string): number => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

function instanceOf(event: IcsEvent, key: string): IcsInstance {
  return {
    uid: event.uid,
    summary: event.summary,
    key,
    start: event.start.minutes,
    end: event.end.minutes + dayDiff(event.start.key, event.end.key) * 1440,
    allDay: !!event.start.allDay,
  };
}

function weekStart(key: string, wkst: number): string {
  return addDays(key, -(((dowOf(key) - wkst) % 7 + 7) % 7));
}

/**
 * Dated instances whose start date falls inside [from, to]. All-day events yield one instance
 * per covered day (DTEND is exclusive). Timed multi-day events keep their end relative to the
 * start date.
 */
export function expandIcs(events: IcsEvent[], from: string, to: string): IcsExpansion {
  const instances: IcsInstance[] = [];
  const removed: IcsExpansion['removed'] = [];
  const overrides = new Map<string, IcsEvent>();
  for (const event of events) {
    if (event.recurrenceId) overrides.set(`${event.uid}/${stampId(event.recurrenceId)}`, event);
  }
  const emit = (event: IcsEvent, key: string) => {
    if (event.cancelled) return;
    if (event.start.allDay) {
      const days = Math.max(1, dayDiff(event.start.key, event.end.key));
      for (let n = 0; n < days; n++) {
        const day = addDays(key, n);
        if (day >= from && day <= to) instances.push({ ...instanceOf(event, day), start: 0, end: 1440 });
      }
      return;
    }
    if (key < from || key > to) return;
    const inst = instanceOf(event, key);
    if (inst.end > inst.start) instances.push(inst);
  };
  for (const event of events) {
    if (event.recurrenceId) {
      // A moved or edited instance stands on its own; the master skips its original slot below.
      emit(event, event.start.key);
      continue;
    }
    if (!event.rrule) {
      emit(event, event.start.key);
      continue;
    }
    const rule = event.rrule;
    const interval = Number(rule.INTERVAL ?? '1');
    const count = rule.COUNT === undefined ? undefined : Number(rule.COUNT);
    if (!Number.isInteger(interval) || interval < 1 || (count !== undefined && (!Number.isInteger(count) || count < 1))) throw new Error('Invalid RRULE');
    const until = rule.UNTIL === undefined ? undefined : parseStamp(rule.UNTIL.endsWith('Z') || rule.UNTIL.includes('T') ? [] : ['VALUE=DATE'], rule.UNTIL);
    const byDay = rule.BYDAY?.split(',').map((code) => {
      const dow = DAY_CODES.indexOf(code);
      if (dow < 0) throw new Error(`Unsupported BYDAY ${code}`);
      return dow;
    });
    const days = new Set(byDay ?? (rule.FREQ === 'WEEKLY' ? [dowOf(event.start.key)] : [0, 1, 2, 3, 4, 5, 6]));
    const wkst = DAY_CODES.indexOf(rule.WKST ?? 'SU');
    if (wkst < 0) throw new Error(`Unsupported WKST ${rule.WKST}`);
    const origin = rule.FREQ === 'WEEKLY' ? weekStart(event.start.key, wkst) : event.start.key;
    const exdates = new Set(event.exdates.map(stampId));
    let emitted = 0;
    let key = event.start.key;
    for (let i = 0; key <= to; i++, key = addDays(key, 1)) {
      if (i > MAX_ITERATIONS) throw new Error('RRULE expansion too long');
      if (until && (key > until.key || (key === until.key && !until.allDay && event.start.minutes > until.minutes))) break;
      if (!days.has(dowOf(key))) continue;
      const steps = rule.FREQ === 'WEEKLY' ? Math.floor(dayDiff(origin, key) / 7) : dayDiff(origin, key);
      if (steps % interval !== 0) continue;
      const stamp: IcsStamp = { key, minutes: event.start.minutes, allDay: event.start.allDay };
      const id = stampId(stamp);
      // COUNT bounds the rule itself; EXDATE removes occurrences from the bounded set.
      emitted++;
      if (!exdates.has(id)) {
        if (!overrides.has(`${event.uid}/${id}`)) emit(event, key);
      } else if (key >= from) {
        removed.push({ uid: event.uid, summary: event.summary, key });
      }
      if (count !== undefined && emitted >= count) break;
    }
  }
  instances.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.start - b.start));
  return { instances, removed };
}
