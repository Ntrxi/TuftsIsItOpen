import { describe, expect, it } from 'vitest';
import { computeStatus, resolveDay } from '../src/engine/status';
import { addDays, localToDate, toLocal } from '../src/engine/time';
import { fmtDay, fmtTime, r, t } from '../src/engine/format';
import { calendar, locations } from '../src/data';
import type { Calendar, DateOverride, Location, Status, WeekHours } from '../src/engine/types';

const cal: Calendar = { holidays: [], periods: [], through: '2028-12-31' };
const at = (key: string, time: string) => localToDate(key, t(time));
const monday = '2026-09-14';
const tuesday = '2026-09-15';
const week = (hours = [r('9pm', '4am')]): WeekHours => [hours, hours, hours, hours, hours, hours, hours];
const facility = (extra: Partial<Location> = {}): Location => ({
  id: 'test', name: 'Test', category: 'library', hours: week(), links: { source: '' }, ...extra,
});
const status = (loc: Location, date: string, time: string, live?: DateOverride[]) =>
  computeStatus(loc, cal, at(date, time), live ? { test: live } : undefined);

describe('date ownership', () => {
  it.each(['static', 'live'])('%s closures cancel spill and confirm the midnight close', (layer) => {
    const overrides: DateOverride[] = [{ from: tuesday, hours: 'closed', note: 'Closed' }];
    const loc = facility(layer === 'static' ? { overrides } : {});
    const live = layer === 'live' ? overrides : undefined;
    expect(status(loc, monday, '23:50', live)).toMatchObject({
      state: 'closing_soon', detail: 'Closes tomorrow at 12:00 AM (in 10 min)',
      closesAt: '2026-09-15T04:00:00.000Z', nextTransitionAt: '2026-09-15T04:00:00.000Z', changesInMinutes: 10,
    });
    expect(status(loc, tuesday, '00:00', live)).toMatchObject({ state: 'closed', today: 'Closed' });
    expect(status(loc, '2026-09-16', '01:00', live).state).toBe('closed');
    expect(status(loc, '2026-09-16', '21:00', live).state).toBe('open');
  });

  it('ends knowledge at midnight without claiming a close', () => {
    const loc = facility({ overrides: [{ from: tuesday, hours: 'unknown', note: 'Unpublished' }] });
    const before = status(loc, monday, '23:50');
    expect(before).toMatchObject({ state: 'open', detail: 'Hours not published from tomorrow at 12:00 AM',
      changesInMinutes: 10, nextTransitionAt: '2026-09-15T04:00:00.000Z' });
    expect(before.closesAt).toBeUndefined();
    expect(status(loc, tuesday, '00:00')).toMatchObject({ state: 'unknown', today: 'Hours not published' });
    for (const extra of [{ access: 'special' as const }, { category: 'transit' as const }]) {
      expect(status({ ...loc, ...extra }, monday, '23:50').state).toBe(extra.access ? 'special' : 'running');
    }
  });

  it('replacement hours preserve published incoming service, including live replacements', () => {
    const overrides: DateOverride[] = [{ from: tuesday, hours: [r('10am', '6pm')], note: '' }];
    for (const layer of ['static', 'live']) {
      const loc = facility(layer === 'static' ? { overrides } : {});
      const live = layer === 'live' ? overrides : undefined;
      expect(status(loc, tuesday, '01:00', live)).toMatchObject({ state: 'open', today: '10:00 AM – 6:00 PM' });
      expect(status(loc, tuesday, '01:00', live).scheduleNote).toContain('Overnight service from yesterday until 4:00 AM');
      expect(status(loc, tuesday, '04:00', live).state).toBe('closed');
      expect(status(loc, tuesday, '10:00', live).state).toBe('open');
    }
  });

  it('preserves ordinary empty days, regular overrides and notes without changing isSpecial', () => {
    const hours = week(); hours[2] = [];
    for (const overrides of [[], [{ from: tuesday, note: 'Notice' }], [{ from: tuesday, hours: 'regular' as const, note: '' }]]) {
      const loc = facility({ hours, overrides });
      const s = status(loc, tuesday, '01:00');
      expect(s).toMatchObject({ state: 'open', today: 'No service starts today' });
      expect(s.scheduleNote).toContain('Overnight service from yesterday until 4:00 AM');
      expect(s.week[0]?.text).toBe(s.today);
      expect(s.isSpecial).toBe(overrides[0] !== undefined && 'hours' in overrides[0]);
    }
  });

  it('applies holiday and period ownership, but preserves explicitly regular period hours', () => {
    const loc = facility();
    const holiday: Calendar = { ...cal, holidays: [{ date: tuesday, name: 'Holiday' }] };
    expect(computeStatus(loc, holiday, at(tuesday, '01:00')).state).toBe('closed');
    const period: Calendar = { ...cal, periods: [{ id: 'break', name: 'Break', kind: 'break', from: tuesday, to: tuesday }] };
    expect(computeStatus(loc, period, at(tuesday, '01:00')).state).toBe('unknown');
    expect(computeStatus({ ...loc, periods: [{ period: 'break', hours: 'regular', note: 'Regular' }] }, period, at(tuesday, '01:00')).state).toBe('open');
  });
});

describe('continuous timeline and transitions', () => {
  it('joins midnight to partial next-day service, regardless of today’s start', () => {
    for (const start of ['12am', '9am']) {
      const loc = facility({ overrides: [
        { from: monday, hours: [r(start, '12am')], note: '' },
        { from: tuesday, hours: [r('12am', '4am')], note: '' },
      ] });
      expect(status(loc, monday, '23:45')).toMatchObject({ state: 'open', detail: 'Closes tomorrow at 4:00 AM', closesAt: '2026-09-15T08:00:00.000Z' });
      expect(status(loc, tuesday, '03:59').state).toBe('closing_soon');
      expect(status(loc, tuesday, '04:00').state).toBe('closed');
    }
  });

  it('does not invent a close at the lookahead limit, but still finds daily access transitions', () => {
    const loc = facility({ hours: week([r('12am', '8am', 'ID', 'special'), r('8am', '12am', 'Public')]) });
    const s = status(loc, monday, '01:00');
    expect(s).toMatchObject({ state: 'special', detail: 'Available 24 hours', changesInMinutes: 420,
      accessChangesAt: '2026-09-14T12:00:00.000Z', nextTransitionAt: '2026-09-14T12:00:00.000Z' });
    expect(s.closesAt).toBeUndefined();
    const plain = status(facility({ hours: week([r('12am', '12am')]) }), monday, '01:00');
    expect(plain.nextTransitionAt).toBeUndefined();
    const startsToday = facility({ hours: week([r('12am', '12am')]), overrides: [{ from: monday, hours: [r('9am', '12am')], note: '' }] });
    const horizon = status(startsToday, monday, '10:00');
    expect(horizon.detail).toBe('No closing time in the next 60 days');
    expect(horizon.closesAt).toBeUndefined();
    expect(horizon.nextTransitionAt).toBeUndefined();
  });

  it('keeps period, access, soon thresholds and closing countdowns distinct', () => {
    const loc = facility({ hours: week([r('9am', '10am', 'Breakfast'), r('10am', '12pm', 'Lunch'), r('12pm', '5pm', 'ID', 'special')]) });
    expect(status(loc, monday, '05:40')).toMatchObject({ state: 'closed', changesInMinutes: 170, nextTransitionAt: '2026-09-14T12:30:00.000Z', detail: 'Opens 9:00 AM' });
    expect(status(loc, monday, '08:30')).toMatchObject({ state: 'opening_soon', changesInMinutes: 30 });
    expect(status(loc, monday, '09:00')).toMatchObject({ state: 'open', changesInMinutes: 60, accessChangesAt: '2026-09-14T16:00:00.000Z', closesAt: '2026-09-14T21:00:00.000Z' });
    const subminute = computeStatus(loc, cal, new Date('2026-09-14T13:59:30Z'));
    expect(subminute.changesInMinutes).toBe(1);
    expect(status(loc, monday, '12:00')).toMatchObject({ state: 'special', changesInMinutes: 300 });
    expect(status(facility({ hours: week([r('9am', '5pm')]) }), monday, '16:00')).toMatchObject({ changesInMinutes: 30, detail: 'Closes 5:00 PM (in 1 hr)' });
  });

  it('uses service-day summaries and explicitly identifies active carryover', () => {
    const saferide = locations.find(l => l.id === 'saferide')!;
    const s = computeStatus(saferide, calendar, at(monday, '01:00'));
    expect(s.today).toBe('11:00 PM – 7:00 AM');
    expect(s.week[0]?.text).toBe(s.today);
    expect(s.week[1]).toEqual({ days: 'Tue–Sun', text: s.today });
    expect(s.todayPeriods).toEqual(['Overnight: 11:00 PM – 7:00 AM']);
    expect(s.scheduleNote).toContain('Overnight service from yesterday until 7:00 AM');
  });

  it('extends beyond the week for a distant opening, recovery and continuous close', () => {
    const later = '2026-09-24';
    const closed = facility({ hours: 'closed', overrides: [{ from: later, hours: [r('10am', '6pm')], note: '' }] });
    expect(status(closed, monday, '10:00')).toMatchObject({ nextTransitionAt: '2026-09-24T13:30:00.000Z', changesInMinutes: 14370 });
    const unknown = { ...closed, hours: 'unknown' as const };
    expect(status(unknown, monday, '10:00')).toMatchObject({ state: 'unknown', nextTransitionAt: '2026-09-24T04:00:00.000Z' });
    const continuous = facility({ hours: week([r('12am', '12am')]), overrides: [{ from: later, hours: 'closed', note: '' }] });
    expect(status(continuous, monday, '10:00')).toMatchObject({ closesAt: '2026-09-24T04:00:00.000Z', nextTransitionAt: '2026-09-24T03:30:00.000Z' });
    const coverageEnds = computeStatus(facility({ hours: week([r('12am', '12am')]) }), { ...cal, through: '2026-09-23' }, at(monday, '10:00'));
    expect(coverageEnds.closesAt).toBeUndefined();
    expect(coverageEnds.detail).toBe('Hours not published from Sep 24, 2026 at 12:00 AM');
    expect(coverageEnds.nextTransitionAt).toBe('2026-09-24T04:00:00.000Z');
  });
});

describe('DST boundaries and elapsed instants', () => {
  it('shifts the gap forward and selects the first repeated occurrence', () => {
    expect(localToDate('2027-03-14', 150).toISOString()).toBe('2027-03-14T07:30:00.000Z');
    expect(localToDate('2026-11-01', 90).toISOString()).toBe('2026-11-01T05:30:00.000Z');
    expect(localToDate('2027-03-13', 1440 + 150).toISOString()).toBe('2027-03-14T07:30:00.000Z');
    expect(localToDate('2027-03-15', -1290).toISOString()).toBe('2027-03-14T07:30:00.000Z');
  });

  it.each([['2027-03-14T06:30:00Z', 270], ['2026-11-01T05:30:00Z', 390], ['2026-11-01T06:30:00Z', 330]])('counts SafeRide elapsed minutes at %s', (instant, minutes) => {
    const loc = locations.find(l => l.id === 'saferide')!;
    const s = computeStatus(loc, calendar, new Date(instant));
    expect(s.state).toBe('running');
    expect(s.changesInMinutes).toBe(minutes);
  });

  it('does not reopen a first-occurrence interval during the repeated hour', () => {
    const loc = facility({ hours: week([r('1am', '1:45am')]) });
    expect(computeStatus(loc, cal, new Date('2026-11-01T05:30Z')).state).toBe('closing_soon');
    expect(computeStatus(loc, cal, new Date('2026-11-01T06:30Z')).state).toBe('closed');
  });

  it.each([['2:30am', '3:30am'], ['2:30am', '3am']])('omits collapsed/reversed %s–%s instead of inventing service', (start, end) => {
    const loc = facility({ hours: week([r(start, end)]) });
    expect(status(loc, '2027-03-14', '03:15')).toMatchObject({ state: 'closed', today: 'Closed' });
    expect(status(loc, '2027-03-14', '03:15').scheduleNote).toContain('An invalid schedule interval was omitted');
  });
});

describe('departure compatibility', () => {
  it('retains timetable source gates and inclusive final departures', () => {
    const loc = facility({ category: 'transit', transit: { departures: { 1: { Stop: [1500] } } } });
    expect(status(loc, tuesday, '00:30').nextDepartures).toEqual([{ stop: 'Stop', time: '1:00 AM', inMinutes: 30 }]);
    expect(status(loc, tuesday, '01:00').nextDepartures?.[0]?.inMinutes).toBe(0);
    // Today's override does not erase yesterday's independently published trips.
    expect(status(loc, tuesday, '00:30', [{ from: tuesday, hours: 'regular', note: '' }]).nextDepartures).toEqual([{ stop: 'Stop', time: '1:00 AM', inMinutes: 30 }]);
    expect(status(loc, tuesday, '00:30', [{ from: monday, hours: 'regular', note: '' }]).nextDepartures).toBeUndefined();
    expect(status(loc, tuesday, '00:30', [{ from: tuesday, hours: 'closed', note: '' }]).nextDepartures).toBeUndefined();
  });
});

describe('absolute coverage and service-day display invariants', () => {
  const available: Status['state'][] = ['open', 'closing_soon', 'running', 'appointment', 'special'];
  const cases: { name: string; loc: Location; key: string; hours: string; intervals: [string, string][]; live?: DateOverride[]; carryoverUntil?: string }[] = [
    { name: 'replacement ownership', loc: facility({ overrides: [{ from: tuesday, hours: [r('10am', '6pm')], note: '' }] }), key: tuesday, hours: '10:00 AM – 6:00 PM', intervals: [['2026-09-15T04:00Z', '2026-09-15T08:00Z'], ['2026-09-15T14:00Z', '2026-09-15T22:00Z']], carryoverUntil: '2026-09-15T08:00Z' },
    { name: 'live closure', loc: facility(), live: [{ from: tuesday, hours: 'closed', note: '' }], key: tuesday, hours: 'Closed', intervals: [] },
    { name: 'unknown ownership', loc: facility({ overrides: [{ from: tuesday, hours: 'unknown', note: '' }] }), key: tuesday, hours: 'Hours not published', intervals: [] },
    { name: 'regular empty-day carryover', loc: facility({ hours: [[r('9pm', '4am')], [r('9pm', '4am')], [], [], [], [], []] }), key: tuesday, hours: 'Closed', intervals: [['2026-09-15T04:00Z', '2026-09-15T08:00Z']], carryoverUntil: '2026-09-15T08:00Z' },
    { name: 'spring shifted start', loc: facility({ hours: week([r('2:30am', '4am')]) }), key: '2027-03-14', hours: '3:30 – 4:00 AM', intervals: [['2027-03-14T07:30Z', '2027-03-14T08:00Z']] },
    { name: 'fall first-occurrence close', loc: facility({ hours: week([r('1am', '1:45am')]) }), key: '2026-11-01', hours: '1:00 – 1:45 AM', intervals: [['2026-11-01T05:00Z', '2026-11-01T05:45Z']] },
    { name: 'fall continuous overnight', loc: facility({ hours: week([r('11pm', '7am')]) }), key: '2026-11-01', hours: '11:00 PM – 7:00 AM', intervals: [['2026-11-01T04:00Z', '2026-11-01T12:00Z'], ['2026-11-02T04:00Z', '2026-11-02T05:00Z']], carryoverUntil: '2026-11-01T12:00Z' },
  ];
  it.each(cases)('preserves absolute and displayed coverage for $name', ({ loc, key, hours, intervals, live, carryoverUntil }) => {
    // The expected absolute spans are supplied independently, not reconstructed by
    // localToDate; this tests both occurrences of the fall hour and the spring gap.
    const start = localToDate(key, 0).getTime();
    const end = localToDate(addDays(key, 1), 0).getTime();
    const spans = intervals.map(([a, b]) => [Date.parse(a), Date.parse(b)] as const);
    const samples = new Set([start, end - 1, ...spans.flatMap(([a, b]) => [a - 1, a, a + 1, b - 1, b, b + 1]),
      ...Array.from({ length: Math.ceil((end - start) / 1800000) }, (_, i) => start + i * 1800000)]);
    for (const instant of [...samples].filter(time => time >= start && time < end)) {
      const s = computeStatus(loc, cal, new Date(instant), live ? { test: live } : undefined);
      const carryover = carryoverUntil && instant < Date.parse(carryoverUntil);
      expect(s.today).toBe(hours === 'Closed' && carryover ? 'No service starts today' : hours);
      expect(s.week[0]?.text).toBe(s.today);
      if (carryover) expect(s.scheduleNote).toContain(`Overnight service from yesterday until ${fmtTime(toLocal(new Date(carryoverUntil)).minutes)}`);
      const covered = spans.some(([a, b]) => a <= instant && instant < b);
      expect(available.includes(s.state), new Date(instant).toISOString()).toBe(covered);
    }
  });
  it.each(locations)('includes $id coverage in Today and its week row at boundaries', (loc) => {
    // Independent projection from source schedules, on ordinary dates with no exceptions.
      for (let d = 0; d < 7; d++) {
        const key = addDays(monday, d);
        const today = resolveDay(loc, key, calendar);
        const yesterday = resolveDay(loc, addDays(key, -1), calendar);
        if (today.source !== 'regular' || yesterday.source !== 'regular' || today.hours === 'unknown' || yesterday.hours === 'unknown') continue;
        const slices = [...yesterday.hours.map(i => ({ ...i, start: i.start - 1440, end: i.end - 1440 })), ...today.hours]
          .map(i => ({ ...i, start: Math.max(0, i.start), end: Math.min(1440, i.end) })).filter(i => i.end > i.start);
        const samples = new Set([0, ...slices.flatMap(i => [i.start - 1, i.start, i.start + 1, i.end - 1, i.end, i.end + 1])].filter(m => m >= 0 && m < 1440));
        for (const minute of samples) {
          const instant = localToDate(key, minute);
          const s = computeStatus(loc, calendar, instant);
          const carryover = yesterday.hours.some(i => i.start - 1440 <= minute && minute < i.end - 1440);
          expect(s.today, `${loc.id} ${key}`).toBe(today.hours.length === 0 && carryover ? 'No service starts today' : fmtDay(today.hours));
          if (carryover) expect(s.scheduleNote).toContain('Overnight service from yesterday until');
          expect(s.week[0]?.text).toBe(s.today);
          if (available.includes(s.state)) expect(slices.some(i => i.start <= toLocal(instant).minutes && toLocal(instant).minutes < i.end), `${loc.id} ${instant.toISOString()}`).toBe(true);
        }
      }
  });
});
