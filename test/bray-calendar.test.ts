import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expandIcs, parseIcs } from '../src/worker/ics';
import { fetchAllLive, _internal } from '../src/worker/live';
import { computeStatus, resolveDay } from '../src/engine/status';
import { calendar, locations } from '../src/data';
import { localToDate } from '../src/engine/time';
import { t } from '../src/engine/format';
import { BRAY_LABS_ICS, BRAY_OPEN_ICS, feedBody, NOW, response } from './live-fixtures';

const bray = locations.find((l) => l.id === 'bray-machine-shop')!;
const at = (date: string, time: string) => localToDate(date, t(time));

describe('iCalendar reader', () => {
  it('expands weekly rules with EXDATE, edited instances, UTC stamps and all-day events', () => {
    const { instances, removed } = expandIcs(parseIcs(BRAY_OPEN_ICS), '2026-09-06', '2026-09-16');
    const day = (key: string) => instances.filter((i) => i.key === key).map((i) => [i.summary, i.start, i.end, i.allDay]);
    expect(day('2026-09-07')).toEqual([]); // Labor Day removed
    expect(day('2026-09-08')).toEqual([['Open Hours', 600, 1200, false]]);
    expect(day('2026-09-09')).toEqual([['Open Hours', 600, 1020, false]]); // edited instance replaces the master slot
    expect(day('2026-09-11')).toEqual([['Open Hours', 600, 1020, false]]);
    expect(day('2026-09-12')).toEqual([['Open Hours', 720, 1020, false]]);
    expect(day('2026-09-13')).toEqual([['Open Hours', 720, 1020, false]]);
    expect(day('2026-09-14')).toEqual([['University Holiday: Shop Closed', 0, 1440, true], ['Open Hours', 600, 1200, false]]);
    expect(day('2026-09-15')).toEqual([['Open Hours', 600, 1200, false], ['ME74 consultations', 780, 840, false]]);
    expect(removed).toEqual([{ uid: 'weekday@google.com', summary: 'Open Hours', key: '2026-09-07' }]);
    const heat = expandIcs(parseIcs(BRAY_LABS_ICS), '2026-09-10', '2026-09-10').instances.find((i) => i.uid === 'heat@google.com');
    expect(heat).toMatchObject({ key: '2026-09-10', start: 900, end: 975 });
  });

  it('honours UNTIL, COUNT, INTERVAL, folded lines, escaped text and cancelled events', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT', 'DTSTART;TZID=America/New_York:20260907T100000', 'DTEND;TZID=America/New_York:20260907T110000',
      'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO;COUNT=3', 'UID:a', 'SUMMARY:Open Shop\\, every', '  other week', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART;TZID=America/New_York:20260901T090000', 'DTEND;TZID=America/New_York:20260901T100000',
      'RRULE:FREQ=DAILY;UNTIL=20260903T130000Z', 'UID:b', 'SUMMARY:Daily', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART;TZID=America/New_York:20260902T090000', 'DTEND;TZID=America/New_York:20260902T100000',
      'UID:c', 'STATUS:CANCELLED', 'SUMMARY:Gone', 'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const { instances } = expandIcs(parseIcs(ics), '2026-08-01', '2026-12-31');
    expect(instances.filter((i) => i.uid === 'a').map((i) => i.key)).toEqual(['2026-09-07', '2026-09-21', '2026-10-05']);
    expect(instances.find((i) => i.uid === 'a')?.summary).toBe('Open Shop, every other week');
    expect(instances.filter((i) => i.uid === 'b').map((i) => i.key)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03']);
    expect(instances.some((i) => i.uid === 'c')).toBe(false);
  });

  it.each([
    ['not a calendar', 'hello'],
    ['unsupported frequency', 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nDTSTART:20260901T090000Z\nRRULE:FREQ=MONTHLY;BYMONTHDAY=1\nEND:VEVENT\nEND:VCALENDAR'],
    ['unsupported rule part', 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nDTSTART:20260901T090000Z\nRRULE:FREQ=WEEKLY;BYSETPOS=1\nEND:VEVENT\nEND:VCALENDAR'],
    ['foreign time zone', 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nDTSTART;TZID=Europe/Paris:20260901T090000\nEND:VEVENT\nEND:VCALENDAR'],
    ['bad date', 'BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:x\nDTSTART;VALUE=DATE:20260231\nEND:VEVENT\nEND:VCALENDAR'],
  ])('rejects %s', (_name, text) => {
    expect(() => expandIcs(parseIcs(text), '2026-01-01', '2026-12-31')).toThrow();
  });
});

describe('Bray Lab calendar provider', () => {
  beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => undefined));
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('turns open shop periods, edited instances, removed days and closures into live overrides', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url) => response(feedBody(String(url)))));
    const data = await fetchAllLive(NOW);
    expect(data.sources.bray).toBe('ok');
    const live = data.overrides['bray-machine-shop']!;
    const on = (key: string) => live.find((o) => o.from === key);
    expect(on('2026-09-09')?.hours).toEqual([{ start: 600, end: 1020, label: 'Open shop' }]);
    // The heat closure on the labs calendar cuts the afternoon out of Thursday's open hours.
    expect(on('2026-09-10')?.hours).toEqual([{ start: 600, end: 900, label: 'Open shop' }, { start: 975, end: 1200, label: 'Open shop' }]);
    expect(on('2026-09-10')?.note).toContain('Closed 3:00 – 4:15 PM');
    expect(on('2026-09-12')?.hours).toEqual([{ start: 720, end: 1020, label: 'Open shop' }]);
    expect(on('2026-09-14')).toMatchObject({ hours: 'closed', note: expect.stringContaining('Shop Closed') });
    expect(on('2026-09-15')?.hours).toEqual([{ start: 600, end: 1200, label: 'Open shop' }]); // consultations are not shop hours
    // Removed recurrence instances are explicit closures; unlisted dates stay unknown.
    expect(on('2026-10-12')).toMatchObject({ hours: 'closed', note: expect.stringContaining('No open shop hours') });
    expect(on('2026-11-20')).toBeUndefined(); // beyond the 60-day window

    expect(computeStatus(bray, calendar, at('2026-09-10', '11:00'), data.overrides)).toMatchObject({ state: 'appointment', period: 'Open shop' });
    expect(computeStatus(bray, calendar, at('2026-09-10', '15:30'), data.overrides).state).toBe('closed');
    expect(computeStatus(bray, calendar, at('2026-09-10', '19:00'), data.overrides).state).toBe('appointment');
    expect(computeStatus(bray, calendar, at('2026-09-10', '20:00'), data.overrides).state).toBe('closed');
    expect(computeStatus(bray, calendar, at('2026-09-14', '12:00'), data.overrides).state).toBe('closed');
    expect(computeStatus(bray, calendar, at('2026-10-12', '12:00'), data.overrides).state).toBe('closed');
    expect(computeStatus(bray, calendar, at('2026-11-20', '12:00'), data.overrides).state).toBe('unknown');
  });

  it('falls back to unknown hours when a calendar is unavailable or malformed', async () => {
    for (const bad of [async () => { throw new Error('timeout'); }, async () => new Response('<html>oops</html>', { headers: { 'content-type': 'text/html' } })]) {
      vi.stubGlobal('fetch', vi.fn(async (url) => String(url).includes('braypalls') ? bad() : response(feedBody(String(url)))));
      const data = await fetchAllLive(NOW);
      expect(data.sources.bray).toBe('error');
      expect(data.failedLocations).toEqual(['bray-machine-shop']);
      expect(data.overrides['bray-machine-shop']?.some((o) => o.hours !== undefined)).toBe(false);
      expect(computeStatus(bray, calendar, NOW, data.overrides).state).toBe('unknown');
      expect(data.sources.library).toBe('ok');
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('"provider":"bray"'));
    }
  });

  it('keeps appointments out of open hours and never reports an all-day open entry as timed hours', () => {
    const overrides = _internal.brayDayOverrides(
      [{ uid: 'a', summary: 'Open Hours', key: '2026-09-16', start: 0, end: 1440, allDay: true }],
      [{ uid: 'b', summary: 'Lathe Training: Ring Project', key: '2026-09-17', start: 600, end: 720, allDay: false }],
      [], '2026-09-16', '2026-09-17');
    expect(overrides).toEqual([{ from: '2026-09-16', hours: 'unknown', note: expect.stringContaining('without times') }]);
    expect(_internal.subtractClosures([{ start: 600, end: 1200 }], [{ start: 540, end: 660 }, { start: 1100, end: 1300 }])).toEqual([{ start: 660, end: 1100 }]);
    expect(resolveDay(bray, '2026-09-17', calendar, overrides).hours).toBe('unknown');
  });
});
