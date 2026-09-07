import { describe, expect, it, vi } from 'vitest';
import { calendar, locations } from '../src/data';
import { computeAll, computeStatus } from '../src/engine/status';
import { localToDate } from '../src/engine/time';
import { r } from '../src/engine/format';
import { _internal } from '../src/worker/live';
import type { Calendar, Location, WeekHours } from '../src/engine/types';

const loc = (id: string) => locations.find(l => l.id === id)!;
const cal: Calendar = { holidays: [], periods: [], through: '2028-12-31' };
const week = (hours = [r('9am', '5pm')]): WeekHours => [hours, hours, hours, hours, hours, hours, hours];
const sample = (extra: Partial<Location> = {}): Location => ({ id: 'test', name: 'Test', category: 'library', hours: week(), links: { source: '' }, ...extra });

describe('production overnight regressions', () => {
  it('preserves consecutive Commons Late Night events across midnight', () => {
    const place = loc('commons-late-night');
    expect(computeStatus(place, calendar, localToDate('2026-09-25', 1430))).toMatchObject({ state: 'open', closesAt: '2026-09-26T04:30:00.000Z', today: '9:00 PM – 12:30 AM' });
    const s = computeStatus(place, calendar, localToDate('2026-09-26', 15));
    expect(s).toMatchObject({ state: 'closing_soon', closesAt: '2026-09-26T04:30:00.000Z', today: '9:00 PM – 12:30 AM' });
    expect(s.scheduleNote).toContain('Overnight service from yesterday until 12:30 AM');
  });

  it('preserves the overnight ID period across actual LibCal per-date output', () => {
    const hours = _internal.libcalDayHours({ date: '2026-09-14', times: { status: 'open', hours: [{ from: '7:45am', to: '4am' }] } }, true, [r('7:45am', '9pm')])!;
    const live = { 'tisch-library': ['2026-09-14', '2026-09-15'].map(from => ({ from, hours, note: 'Hours from the library calendar' })) };
    const s = computeStatus(loc('tisch-library'), calendar, localToDate('2026-09-15', 60), live);
    expect(s).toMatchObject({ state: 'special', closesAt: '2026-09-15T08:00:00.000Z', today: '7:45 AM – 4:00 AM' });
    expect(s.scheduleNote).toContain('Overnight service from yesterday until 4:00 AM');
    expect(s.todayPeriods.filter(p => p.includes('Tufts ID'))).toHaveLength(1);
    expect(s.todayPeriods.find(p => p.includes('Tufts ID'))).toContain('4:00 AM');
  });

  it('keeps the last ordinary Tisch night before Thanksgiving hours', () => {
    const s = computeStatus(loc('tisch-library'), calendar, localToDate('2026-11-24', 1430));
    expect(s).toMatchObject({ state: 'special', closesAt: '2026-11-25T09:00:00.000Z', isSpecial: false, today: '7:45 AM – 4:00 AM' });
  });

  it('keeps the final Davis Friday loop and its departures across the summer boundary', () => {
    const s = computeStatus(loc('davis-shuttle'), calendar, localToDate('2027-05-15', 30));
    expect(s).toMatchObject({ state: 'running', closesAt: '2027-05-15T06:00:00.000Z' });
    expect(s.nextDepartures).toContainEqual({ stop: 'Campus Center', time: '12:30 AM', inMinutes: 0 });
    expect(s.scheduleNote).toContain('Overnight service from yesterday until 2:00 AM');
    expect(s.today).toBe('No service starts today');
    expect(computeStatus(loc('davis-shuttle'), calendar, localToDate('2027-05-15', 120)).state).toBe('not_running');
  });

  it('explains a genuine next-day closure on the preceding evening', () => {
    const place = sample({ hours: week([r('9pm', '4am')]), overrides: [{ from: '2026-09-15', hours: 'closed', note: 'Emergency closure' }] });
    const s = computeStatus(place, cal, localToDate('2026-09-14', 1430));
    expect(s.scheduleNote).toContain('Overnight service ends at midnight: Emergency closure');
    expect(s.isSpecial).toBe(true);
    expect(s.closesAt).toBe('2026-09-15T04:00:00.000Z');
  });
});

describe('review edge cases and conversion cost', () => {
  it('drops one invalid range while preserving the valid periods and note', () => {
    const place = sample({ hours: week([{ start: 60, end: 60 }, r('9am', '5pm')]) });
    const s = computeStatus(place, cal, localToDate('2026-09-14', 600));
    expect(s).toMatchObject({ state: 'open', today: '9:00 AM – 5:00 PM' });
    expect(s.scheduleNote).toContain('An invalid schedule interval was omitted');
    expect(s.scheduleNote).not.toContain('daylight');
    const spring = sample({ hours: week([r('2:30am', '3am'), r('9am', '5pm')]) });
    expect(computeStatus(spring, cal, localToDate('2027-03-14', 600))).toMatchObject({ state: 'open', today: '9:00 AM – 5:00 PM' });
  });

  it('qualifies a confirmed close several days away', () => {
    const place = sample({ hours: week([r('12am', '12am')]), overrides: [
      { from: '2026-09-14', hours: [r('9am', '12am')], note: '' },
      { from: '2026-09-16', hours: [r('12am', '5pm')], note: '' },
    ] });
    const s = computeStatus(place, cal, localToDate('2026-09-14', 600));
    expect(s.detail).toBe('Closes Wed, Sep 16 at 5:00 PM');
    expect(s.closesAt).toBe('2026-09-16T21:00:00.000Z');
  });

  it('shares timezone work across locations without retaining schedules between calls', () => {
    const instant = new Date('2026-09-14T16:00:00Z');
    const format = vi.spyOn(Intl.DateTimeFormat.prototype, 'formatToParts');
    try {
      computeAll([sample()], cal, instant);
      const single = format.mock.calls.length;
      format.mockClear();
      computeAll(Array.from({ length: 37 }, (_, i) => sample({ id: `test-${i}` })), cal, instant);
      expect(format.mock.calls.length).toBeLessThanOrEqual(single + 2);
      format.mockClear();
      const changed = computeAll([sample()], cal, instant, { test: [{ from: '2026-09-14', hours: 'closed', note: '' }] });
      expect(changed[0]?.state).toBe('closed');
    } finally { format.mockRestore(); }
  });

  it('uses the same state and period rules for displayed status and transition boundaries', () => {
    const place = sample({ hours: week([r('9am', '10am', 'Breakfast'), r('10am', '12pm', 'Lunch'), r('12pm', '5pm', 'ID', 'special')]) });
    for (const minute of [400, 510, 540, 600, 720]) {
      const initial = computeStatus(place, cal, localToDate('2026-09-14', minute));
      const boundary = Date.parse(initial.nextTransitionAt!);
      const before = computeStatus(place, cal, new Date(boundary - 1));
      const after = computeStatus(place, cal, new Date(boundary));
      expect([after.state, after.period]).not.toEqual([before.state, before.period]);
      expect(after.nextTransitionAt === undefined || Date.parse(after.nextTransitionAt) > boundary).toBe(true);
    }
  });

  it('does not publish late departures across an explicit closure while retaining final-departure inclusivity', () => {
    const place = loc('davis-shuttle');
    const live = { [place.id]: [{ from: '2026-09-19', hours: 'closed' as const, note: 'Storm' }] };
    const late = computeStatus(place, calendar, localToDate('2026-09-18', 1430), live);
    expect(late.nextDepartures).toBeUndefined();
    const grocery = computeStatus(loc('grocery-shuttle'), calendar, localToDate('2026-09-19', 885));
    expect(grocery.nextDepartures).toContainEqual({ stop: 'Stop & Shop', time: '2:45 PM', inMinutes: 0 });
  });
});
