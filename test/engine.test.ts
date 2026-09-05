import { describe, expect, it } from 'vitest';
import { computeStatus, resolveDay, calendarContext } from '../src/engine/status';
import { localToDate, toLocal, addDays } from '../src/engine/time';
import { fmtDay, fmtTime, r, t, mergeContiguous } from '../src/engine/format';
import { calendar, locations } from '../src/data';
import type { Location } from '../src/engine/types';

const byId = (id: string): Location => {
  const loc = locations.find((l) => l.id === id);
  if (!loc) throw new Error(`missing location ${id}`);
  return loc;
};

/** Build an instant from a campus-local date and time string. */
const at = (key: string, time: string): Date => localToDate(key, t(time));

describe('time helpers', () => {
  it('converts local campus time to UTC across DST', () => {
    // EDT (UTC-4)
    expect(localToDate('2026-09-03', t('14:00')).toISOString()).toBe('2026-09-03T18:00:00.000Z');
    // EST (UTC-5)
    expect(localToDate('2026-12-15', t('14:00')).toISOString()).toBe('2026-12-15T19:00:00.000Z');
    // Spring-forward day: 3:30 AM local exists; 2:30 AM does not (clamps forward)
    expect(toLocal(localToDate('2027-03-14', t('3:30'))).minutes).toBe(t('3:30'));
  });

  it('round-trips toLocal', () => {
    const d = at('2026-11-01', '1:30'); // DST ends this day at 2 AM
    const l = toLocal(d);
    expect(l.key).toBe('2026-11-01');
    expect(l.minutes).toBe(t('1:30'));
    expect(l.dow).toBe(0);
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
});

describe('format helpers', () => {
  it('parses times', () => {
    expect(t('7:30am')).toBe(450);
    expect(t('12pm')).toBe(720);
    expect(t('12am')).toBe(0);
    expect(t('9pm')).toBe(1260);
    expect(t('24:05')).toBe(1445);
  });
  it('formats times and ranges', () => {
    expect(fmtTime(0)).toBe('12:00 AM');
    expect(fmtTime(1440)).toBe('12:00 AM');
    expect(fmtTime(1680)).toBe('4:00 AM');
    expect(fmtDay([r('7am', '9pm')])).toBe('7:00 AM – 9:00 PM');
    expect(fmtDay([r('9am', '1pm'), r('2pm', '5pm')])).toBe('9:00 AM – 1:00 PM, 2:00 – 5:00 PM');
    expect(fmtDay([])).toBe('Closed');
  });
  it('merges contiguous meal periods', () => {
    const merged = mergeContiguous([r('7am', '11am', 'Breakfast'), r('11am', '2pm', 'Lunch'), r('2pm', '5pm'), r('5pm', '9pm')]);
    expect(merged).toEqual([{ start: 420, end: 1260 }]);
  });
  it('treats an end before start as overnight', () => {
    expect(r('9pm', '2am')).toEqual({ start: 1260, end: 1560 });
  });
});

describe('resolveDay precedence', () => {
  it('uses overrides over holidays (mailroom open on Labor Day for move-in)', () => {
    const res = resolveDay(byId('medford-mailroom'), '2026-09-07', calendar);
    expect(res.source).toBe('override');
    expect(fmtDay(res.hours as never)).toBe('10:00 AM – 5:00 PM');
  });
  it('closes holiday-observing locations on Labor Day', () => {
    const res = resolveDay(byId('health-service'), '2026-09-07', calendar);
    expect(res.source).toBe('holiday');
    expect(res.hours).toEqual([]);
  });
  it('keeps regular hours on holidays for locations that stay open', () => {
    const res = resolveDay(byId('grocery-shuttle'), '2027-05-31', calendar);
    expect(res.source).toBe('regular');
  });
  it('applies named break periods', () => {
    const res = resolveDay(byId('health-service'), '2027-03-22', calendar); // spring break Monday
    expect(res.source).toBe('period');
    expect(fmtDay(res.hours as never)).toBe('9:00 AM – 12:00 PM, 1:00 – 4:00 PM');
  });
  it('reports unknown hours for unpublished break schedules', () => {
    const res = resolveDay(byId('tisch-library'), '2027-01-05', calendar); // winter break
    expect(res.hours).toBe('unknown');
  });
  it('post office follows federal holidays not Tufts holidays', () => {
    expect(resolveDay(byId('tufts-post-office'), '2026-11-11', calendar).hours).toEqual([]); // Veterans Day: closed
    expect(resolveDay(byId('tufts-post-office'), '2026-10-12', calendar).hours).toEqual([]); // Columbus Day: closed
    // Tufts' President's bonus day is a normal USPS day.
    expect(fmtDay(resolveDay(byId('tufts-post-office'), '2026-12-30', calendar).hours as never)).toContain('9:00 AM');
  });
});

describe('computeStatus', () => {
  it('reports open with the current meal period and closing time', () => {
    const st = computeStatus(byId('dewick'), calendar, at('2026-09-10', '12:30')); // Thu, regular
    expect(st.state).toBe('open');
    expect(st.period).toBe('Lunch');
    expect(st.periodEnds).toBe('2:00 PM');
    expect(st.detail).toBe('Closes 9:30 PM');
    expect(st.isSpecial).toBe(false);
  });

  it('flags closing soon within 30 minutes', () => {
    const st = computeStatus(byId('dewick'), calendar, at('2026-09-10', '21:05'));
    expect(st.state).toBe('closing_soon');
    expect(st.detail).toBe('Closes 9:30 PM (in 25 min)');
  });

  it('flags opening soon and gives next opening time', () => {
    const st = computeStatus(byId('dewick'), calendar, at('2026-09-10', '7:10'));
    expect(st.state).toBe('opening_soon');
    expect(st.detail).toBe('Opens 7:30 AM (in 20 min)');
  });

  it('handles split hours: closed for lunch, reopening later today', () => {
    const st = computeStatus(byId('tufts-post-office'), calendar, at('2026-09-10', '13:15'));
    expect(st.state).toBe('closed');
    expect(st.detail).toBe('Opens 2:00 PM (in 45 min)');
    const before = computeStatus(byId('tufts-post-office'), calendar, at('2026-09-10', '12:45'));
    expect(before.state).toBe('closing_soon');
    expect(before.detail).toBe('Closes 1:00 PM (in 15 min), back 2:00 PM');
  });

  it('handles overnight hours (Tisch open until 4 AM)', () => {
    const late = computeStatus(byId('tisch-library'), calendar, at('2026-09-15', '1:30')); // Tue 1:30 AM = Mon night
    expect(late.state).toBe('open');
    expect(late.period).toBe('Tufts ID only · late-night study');
    expect(late.detail).toBe('Closes 4:00 AM, back 7:45 AM');
    const gap = computeStatus(byId('tisch-library'), calendar, at('2026-09-15', '5:00'));
    expect(gap.state).toBe('closed');
    expect(gap.detail).toBe('Opens 7:45 AM');
    const fri = computeStatus(byId('tisch-library'), calendar, at('2026-09-19', '1:30')); // Sat 1:30 AM after Fri 10:45 PM close
    expect(fri.state).toBe('closed');
  });

  it('handles Friday 2 AM shuttle loop as running', () => {
    const st = computeStatus(byId('davis-shuttle'), calendar, at('2026-09-19', '1:15')); // Sat 1:15 AM = Fri night
    expect(st.state).toBe('running');
    expect(st.period).toContain('All Stops');
  });

  it('keeps showing overnight departures after midnight', () => {
    // Saturday 1:05 AM: the Friday All Stops loop still runs until 2 AM.
    const st = computeStatus(byId('davis-shuttle'), calendar, at('2026-09-12', '1:05'));
    expect(st.state).toBe('running');
    expect(st.nextDepartures).toEqual([
      { stop: 'Campus Center', time: '1:30 AM', inMinutes: 25 },
      { stop: 'Davis Square', time: '1:10 AM', inMinutes: 5 },
    ]);
  });

  it('marks transit as not running and names the next run', () => {
    const st = computeStatus(byId('davis-shuttle'), calendar, at('2026-09-12', '8:00')); // Sat morning
    expect(st.state).toBe('not_running');
    expect(st.detail).toBe('Next run 10:00 AM');
  });

  it('lists next departures on a regular weekday', () => {
    const st = computeStatus(byId('davis-shuttle'), calendar, at('2026-09-14', '14:20')); // Mon
    expect(st.state).toBe('running');
    expect(st.nextDepartures?.find((d) => d.stop === 'Campus Center')?.time).toBe('2:30 PM');
    expect(st.nextDepartures?.find((d) => d.stop === 'Davis Square')?.time).toBe('2:45 PM');
  });

  it('shows Labor Day special hours and notes', () => {
    const dewick = computeStatus(byId('dewick'), calendar, at('2026-09-07', '12:00'));
    expect(dewick.state).toBe('open');
    expect(dewick.isSpecial).toBe(true);
    expect(dewick.scheduleNote).toContain('Labor Day');
    const hodgdon = computeStatus(byId('hodgdon'), calendar, at('2026-09-07', '12:00'));
    expect(hodgdon.state).toBe('closed');
    expect(hodgdon.detail).toBe('Opens tomorrow 9:00 AM');
  });

  it('shows appointment-only state for Health Service during office hours', () => {
    const st = computeStatus(byId('health-service'), calendar, at('2026-09-10', '15:00')); // Thu afternoon
    expect(st.state).toBe('appointment');
    expect(st.period).toBe('In person');
    const morning = computeStatus(byId('health-service'), calendar, at('2026-09-10', '10:00')); // Thu morning closed
    expect(morning.state).toBe('closed');
    expect(morning.detail).toBe('Opens 1:00 PM');
  });

  it('reports unknown hours honestly', () => {
    const st = computeStatus(byId('hamilton-pool'), calendar, at('2026-09-04', '12:00'));
    expect(st.state).toBe('unknown');
    expect(st.detail).toContain('Sep 8');
  });

  it('reports special access for facilities without public hours', () => {
    const st = computeStatus(byId('halligan-ece-labs'), calendar, at('2026-09-10', '12:00'));
    expect(st.state).toBe('special');
  });

  it('closes over Thanksgiving and reopens Sunday dinner for dining halls', () => {
    const thu = computeStatus(byId('dewick'), calendar, at('2026-11-26', '12:00'));
    expect(thu.state).toBe('closed');
    expect(thu.detail).toBe('Opens Sun 5:00 PM');
    const sun = computeStatus(byId('dewick'), calendar, at('2026-11-29', '18:00'));
    expect(sun.state).toBe('open');
    expect(sun.period).toBe('Dinner');
  });

  it('keeps Carmichael closed through the Sep 2026 building issue and reopens for Sunday dinner', () => {
    const sat = computeStatus(byId('carmichael'), calendar, at('2026-09-05', '12:30'));
    expect(sat.state).toBe('closed');
    expect(sat.scheduleNote).toContain('building issue');
    expect(sat.detail).toBe('Opens tomorrow 5:00 PM');
    const sun = computeStatus(byId('carmichael'), calendar, at('2026-09-06', '12:30'));
    expect(sun.state).toBe('closed');
    expect(sun.detail).toBe('Opens 5:00 PM');
  });
  it('applies live overrides ahead of static data', () => {
    const live = { dewick: [{ from: '2026-09-10', hours: 'closed' as const, note: 'Closed: “Test” (per Tufts Dining menu)' }] };
    const st = computeStatus(byId('dewick'), calendar, at('2026-09-10', '12:30'), live);
    expect(st.state).toBe('closed');
    expect(st.scheduleNote).toContain('Test');
  });

  it('lets a note-only override annotate a day without changing its hours', () => {
    // A dining notice must not replace orientation hours or a holiday closure.
    const dewick = computeStatus(byId('dewick'), calendar, at('2026-09-06', '8:00'), {
      dewick: [{ from: '2026-09-06', note: 'Tufts Dining notice: “Welcome back!”' }],
    });
    expect(dewick.state).toBe('open');
    expect(dewick.today).toBe('7:30 AM – 9:00 PM');
    expect(dewick.scheduleNote).toBe('Orientation / Labor Day hours · Tufts Dining notice: “Welcome back!”');
    const hodgdon = computeStatus(byId('hodgdon'), calendar, at('2026-10-12', '12:00'), {
      hodgdon: [{ from: '2026-10-12', note: 'Tufts Dining notice: “New menu”' }],
    });
    expect(hodgdon.state).toBe('closed');
    expect(hodgdon.scheduleNote).toContain("Indigenous Peoples' Day");
    // On a regular day the note shows but the day is not flagged as special hours.
    const regular = computeStatus(byId('dewick'), calendar, at('2026-09-16', '12:00'), {
      dewick: [{ from: '2026-09-16', note: 'Tufts Dining notice: “Taco day”' }],
    });
    expect(regular.isSpecial).toBe(false);
    expect(regular.scheduleNote).toBe('Tufts Dining notice: “Taco day”');
  });

  it('groups the week overview', () => {
    const st = computeStatus(byId('kindlevan'), calendar, at('2026-09-14', '12:00')); // Mon
    expect(st.week[0]).toEqual({ days: 'Today', text: '8:00 AM – 7:00 PM', isToday: true });
    expect(st.week[1]).toEqual({ days: 'Tue–Thu', text: '8:00 AM – 7:00 PM' });
    expect(st.week[2]).toEqual({ days: 'Fri', text: '8:00 AM – 4:00 PM' });
    expect(st.week[3]).toEqual({ days: 'Sat–Sun', text: 'Closed' });
  });
});

describe('calendar context', () => {
  it('labels holidays, breaks, and terms', () => {
    expect(calendarContext(calendar, at('2026-09-07', '12:00')).label).toBe('Labor Day');
    expect(calendarContext(calendar, at('2026-09-03', '12:00')).label).toBe('Orientation week');
    expect(calendarContext(calendar, at('2026-10-01', '12:00')).label).toBe('Fall semester');
    expect(calendarContext(calendar, at('2026-11-25', '12:00')).label).toBe('Thanksgiving recess');
    expect(calendarContext(calendar, at('2026-12-16', '12:00')).label).toBe('Fall finals');
  });
});

describe('data integrity', () => {
  it('has unique ids and sane intervals', () => {
    const ids = new Set<string>();
    for (const loc of locations) {
      expect(ids.has(loc.id)).toBe(false);
      ids.add(loc.id);
      expect(loc.links.source).toMatch(/^https?:\/\//);
      const weeks = [loc.hours, ...(loc.periods ?? []).map((p) => p.hours), ...(loc.overrides ?? []).map((o) => o.hours)];
      for (const w of weeks) {
        if (w === undefined || typeof w === 'string') continue;
        const days = Array.isArray(w[0]) ? (w as unknown[][]) : [w];
        for (const day of days) {
          for (const i of day as { start: number; end: number }[]) {
            expect(i.start).toBeGreaterThanOrEqual(0);
            expect(i.start).toBeLessThan(1440);
            expect(i.end).toBeGreaterThan(i.start);
            expect(i.end).toBeLessThanOrEqual(2880);
          }
        }
      }
      for (const p of loc.periods ?? []) {
        expect(calendar.periods.some((cp) => cp.id === p.period)).toBe(true);
      }
      for (const o of loc.overrides ?? []) {
        expect(o.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        if (o.to) expect(o.to >= o.from).toBe(true);
      }
    }
  });
});
