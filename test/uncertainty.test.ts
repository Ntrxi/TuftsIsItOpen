import { describe, expect, it } from 'vitest';
import { calendar, locations } from '../src/data';
import { PUB_NIGHTS_FALL_2026 } from '../src/data/dining';
import { computeStatus, resolveDay } from '../src/engine/status';
import { localToDate } from '../src/engine/time';
import { fmtDay, r, t } from '../src/engine/format';
import { renderCard } from '../src/render/render';
import { EMPTY_LIVE } from '../src/engine/live';
import { OPEN_STATES } from '../src/render/render';
import type { Location } from '../src/engine/types';

const loc = (id: string) => locations.find((l) => l.id === id)!;
const at = (date: string, time: string) => localToDate(date, t(time));
const status = (id: string, date: string, time: string) => computeStatus(loc(id), calendar, at(date, time));

describe('interval-level confidence (Hamilton Pool)', () => {
  const pool = loc('hamilton-pool');

  it('keeps only the ambiguous morning slot unknown and the confirmed sessions usable', () => {
    // Mon Sep 14: printed "7pm-8:15am" morning entry, then 11:30–1:30 and 7:30–9:50 PM.
    expect(status('hamilton-pool', '2026-09-14', '07:30')).toMatchObject({ state: 'unknown', label: 'Hours unknown', detail: 'Hours unconfirmed until 8:15 AM; check the official page' });
    expect(status('hamilton-pool', '2026-09-14', '08:15').state).toBe('closed');
    expect(status('hamilton-pool', '2026-09-14', '11:00').state).toBe('opening_soon');
    expect(status('hamilton-pool', '2026-09-14', '12:00')).toMatchObject({ state: 'open', period: 'Rec swim', detail: 'Closes 1:30 PM (in 1 hr 30 min), back 7:30 PM' });
    expect(status('hamilton-pool', '2026-09-14', '13:29').state).toBe('closing_soon');
    expect(status('hamilton-pool', '2026-09-14', '15:00').state).toBe('closed');
    expect(status('hamilton-pool', '2026-09-14', '20:00').state).toBe('open');
    expect(status('hamilton-pool', '2026-09-14', '21:50').state).toBe('closed');
    expect(status('hamilton-pool', '2026-09-14', '03:00').state).toBe('closed');
    // Friday prints 7am–8:15am unambiguously, and the weekend has a single session.
    expect(status('hamilton-pool', '2026-09-18', '07:30').state).toBe('open');
    expect(status('hamilton-pool', '2026-09-19', '13:00').state).toBe('open');
  });

  it('describes the unconfirmed slot without merging it into confirmed hours', () => {
    const st = status('hamilton-pool', '2026-09-14', '12:00');
    expect(st.today).toBe('7:00 – 8:15 AM (unconfirmed), 11:30 AM – 1:30 PM, 7:30 – 9:50 PM');
    expect(st.todayPeriods).toEqual(['Rec swim: 7:00 – 8:15 AM (unconfirmed)', 'Rec swim: 11:30 AM – 1:30 PM', 'Rec swim: 7:30 – 9:50 PM']);
    expect(st.unconfirmed).toEqual(['Rec swim: 7:00 – 8:15 AM (unconfirmed)']);
    expect(st.scheduleNote).toContain('unconfirmed');
    expect(st.isSpecial).toBe(false);
    expect(st.week.find((l) => l.days === 'Fri')?.text).toBe('7:00 – 8:15 AM, 11:30 AM – 1:30 PM');
    const html = renderCard(pool, st, EMPTY_LIVE);
    expect(html).toContain('Confirm hours');
    expect(html).not.toContain('Unverified');
    // The unknown slot itself carries no confirmation chip: the state already says so.
    expect(renderCard(pool, status('hamilton-pool', '2026-09-14', '07:30'), EMPTY_LIVE)).not.toContain('Confirm hours');
  });

  it('announces the unconfirmed slot as the next change and never as an opening', () => {
    expect(status('hamilton-pool', '2026-09-14', '06:00')).toMatchObject({ state: 'closed', detail: 'Hours unconfirmed from 7:00 AM', changesInMinutes: 60 });
    expect(status('hamilton-pool', '2026-09-13', '17:00').detail).toBe('Hours unconfirmed from tomorrow 7:00 AM');
    expect(status('hamilton-pool', '2026-09-14', '22:00').detail).toBe('Hours unconfirmed from tomorrow 7:00 AM');
    expect(status('hamilton-pool', '2026-09-14', '06:45').state).toBe('closed'); // no "opening soon" for an unconfirmed slot
  });

  it('applies to the Nov 24 partial day and to a confirmed interval overlapping an unconfirmed one', () => {
    expect(status('hamilton-pool', '2026-11-24', '07:30').state).toBe('unknown');
    expect(status('hamilton-pool', '2026-11-24', '12:00').state).toBe('open');
    expect(status('hamilton-pool', '2026-11-24', '20:00').state).toBe('closed');
    const overlap: Location = { ...pool, id: 'x', overrides: [], hours: [[], [{ ...r('7am', '9am'), confidence: 'low' }, r('8am', '10am')], [], [], [], [], []] };
    expect(computeStatus(overlap, calendar, at('2026-09-14', '07:30')).state).toBe('unknown');
    expect(computeStatus(overlap, calendar, at('2026-09-14', '08:30')).state).toBe('open');
    expect(computeStatus(overlap, calendar, at('2026-09-14', '09:30')).state).toBe('closing_soon');
    expect(fmtDay([{ ...r('7am', '9am'), confidence: 'medium' }, r('9am', '10am')])).toBe('7:00 – 9:00 AM (unconfirmed), 9:00 – 10:00 AM');
  });
});

describe('access varies (Halligan electronics labs)', () => {
  it('reports the access model instead of unknown hours on any date, without counting as open', () => {
    for (const [date, time] of [['2026-09-10', '12:00'], ['2026-09-10', '03:00'], ['2026-10-12', '12:00'], ['2026-12-28', '12:00'], ['2027-09-15', '12:00']]) {
      const st = status('halligan-ece-labs', date!, time!);
      expect(st.state).toBe('varies');
      expect(st.label).toBe('Access varies');
      expect(st.today).toBe('Access varies');
      expect(OPEN_STATES).not.toContain(st.state);
    }
    const html = renderCard(loc('halligan-ece-labs'), status('halligan-ece-labs', '2026-09-10', '12:00'), EMPTY_LIVE);
    expect(html).toContain('data-state="varies"');
    expect(html).toContain('Available to eligible ECE/CS students outside scheduled labs');
    expect(html).not.toContain('Hours not published');
  });

  it('still yields to dated closures and unpublished overrides', () => {
    const closed: Location = { ...loc('halligan-ece-labs'), overrides: [{ from: '2026-09-10', hours: 'closed', note: 'Lab renovation' }] };
    expect(computeStatus(closed, calendar, at('2026-09-10', '12:00'))).toMatchObject({ state: 'closed', scheduleNote: 'Lab renovation' });
    const unknown: Location = { ...loc('halligan-ece-labs'), overrides: [{ from: '2026-09-10', hours: 'unknown', note: 'Unpublished' }] };
    expect(computeStatus(unknown, calendar, at('2026-09-10', '12:00'))).toMatchObject({ state: 'unknown', today: 'Hours not published' });
  });
});

describe('holiday hours that may vary (TTS walk-up)', () => {
  it('uses the IT locations schedule on ordinary days and unknown on university holidays', () => {
    expect(status('tts-walkup', '2026-09-13', '10:00').state).toBe('open'); // Sun 9 AM–11 PM
    expect(status('tts-walkup', '2026-09-13', '22:59').state).toBe('closing_soon');
    expect(status('tts-walkup', '2026-09-18', '18:00').state).toBe('closed'); // Fri closes 5 PM
    expect(status('tts-walkup', '2026-09-19', '12:00').state).toBe('open');
    expect(loc('tts-walkup').sourceConflict).toBeUndefined();
    expect(loc('tts-walkup').confidence).toBe('high');
    expect(status('tts-walkup', '2026-10-12', '12:00')).toMatchObject({ state: 'unknown', detail: "Indigenous Peoples' Day: holiday hours not published" });
    expect(resolveDay(loc('tts-walkup'), '2026-11-11', calendar).source).toBe('holiday');
    expect(status('tts-walkup', '2026-11-26', '12:00').state).toBe('unknown');
  });
});

describe('published pub nights', () => {
  it('opens only on the listed Fall 2026 Thursdays and stops claiming anything after the last one', () => {
    for (const date of PUB_NIGHTS_FALL_2026) {
      expect(status('popup-pub', date, '17:59').state).toBe('opening_soon');
      expect(status('popup-pub', date, '18:00')).toMatchObject({ state: 'open', isSpecial: false });
      expect(status('popup-pub', date, '22:00').state).toBe('closed');
    }
    for (const date of ['2026-09-03', '2026-09-17', '2026-10-08', '2026-11-12']) {
      expect(status('popup-pub', date, '19:00').state).toBe('closed');
    }
    expect(status('popup-pub', '2026-09-17', '19:00').scheduleNote).toContain('No pub night this Thursday');
    expect(status('popup-pub', '2026-11-26', '19:00').scheduleNote).toContain('Thanksgiving');
    expect(status('popup-pub', '2026-12-10', '19:00').detail).toContain('Closes 10:00 PM');
    expect(status('popup-pub', '2026-12-17', '19:00').state).toBe('unknown');
    expect(status('popup-pub', '2027-01-21', '19:00').state).toBe('unknown');
  });
});
