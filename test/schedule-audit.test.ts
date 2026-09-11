import { describe, expect, it } from 'vitest';
import { calendar, locations } from '../src/data';
import { calendarContext, computeStatus, resolveDay } from '../src/engine/status';
import { HOURS_MAX_AGE_MS, usableLive, type LiveData } from '../src/engine/live';
import { addDays, localToDate } from '../src/engine/time';
import { r, t } from '../src/engine/format';

const loc = (id: string) => locations.find((l) => l.id === id)!;
// Explicit America/New_York wall times, including DST changes.
const at = (date: string, time: string) => localToDate(date, t(time));
const state = (id: string, date: string, time: string) => computeStatus(loc(id), calendar, at(date, time)).state;

describe('September 7 authoritative schedule audit', () => {
  it.each([['2026-09-03', '16:30'], ['2026-09-04', '17:00']])('serves Dewick dinner on %s at %s', (date, open) => {
    expect(computeStatus(loc('dewick'), calendar, localToDate(date, t(open) - 1)).state).toBe('opening_soon');
    expect(state('dewick', date, open)).toBe('open');
    expect(state('dewick', date, '19:59')).toBe('closing_soon');
    expect(state('dewick', date, '20:00')).toBe('closed');
    expect(resolveDay(loc('dewick'), date, calendar).hours).toContainEqual(r(open, '20:00', 'Dinner'));
  });

  it('uses published Labor Day fitness hours and the actual summer transition', () => {
    expect(state('tisch-fitness-center', '2026-09-07', '06:29')).toBe('opening_soon');
    expect(state('tisch-fitness-center', '2026-09-07', '06:30')).toBe('open');
    expect(state('tisch-fitness-center', '2026-09-07', '22:59')).toBe('closing_soon');
    expect(state('tisch-fitness-center', '2026-09-07', '23:00')).toBe('closed');
    expect(state('tisch-fitness-center', '2027-05-17', '21:00')).toBe('open');
    expect(state('tisch-fitness-center', '2027-05-23', '12:00')).toBe('closed');
    expect(state('tisch-fitness-center', '2027-05-24', '21:00')).toBe('closed');
    expect(state('tisch-fitness-center', '2027-08-25', '12:00')).toBe('unknown');
  });

  it('retains the DDS week actually returned by the current LibCal grid', () => {
    for (let day = 0; day < 7; day++) {
      const date = addDays('2026-09-13', day);
      const open = day === 5 ? 660 : 600;
      const close = day === 5 ? 1020 : day === 6 ? 1080 : 1260;
      expect(resolveDay(loc('tisch-dds'), date, calendar).hours).toEqual([{ start: open, end: close }]);
      expect(computeStatus(loc('tisch-dds'), calendar, localToDate(date, open - 1)).state).toBe('opening_soon');
      expect(computeStatus(loc('tisch-dds'), calendar, localToDate(date, open)).state).toBe('open');
      expect(computeStatus(loc('tisch-dds'), calendar, localToDate(date, close - 1)).state).toBe('closing_soon');
      expect(computeStatus(loc('tisch-dds'), calendar, localToDate(date, close)).state).toBe('closed');
    }
    expect(state('tisch-dds', '2026-09-07', '12:00')).toBe('closed');
    expect(state('dds-laser', '2026-09-25', '12:59')).toBe('opening_soon');
    expect(state('dds-laser', '2026-09-25', '13:00')).toBe('open');
    expect(state('dds-laser', '2026-09-25', '16:00')).toBe('closed');
    expect(state('dds-laser', '2026-12-11', '13:00')).toBe('open');
    expect(state('dds-laser', '2026-12-12', '13:00')).toBe('closed');
  });

  it('keeps Bray room access available overnight, weekends and holidays with restrictions', () => {
    for (const date of ['2026-09-06', '2026-09-07', '2026-09-08']) {
      for (const time of ['00:00', '03:00', '12:00', '23:59']) {
        expect(state('bray-3d-printing', date, time)).toBe('special');
      }
    }
    expect(loc('bray-3d-printing').description).toContain('training');
    expect(loc('bray-3d-printing').note).toContain('not staffed assistance');
    const room = computeStatus(loc('bray-3d-printing'), calendar, at('2026-09-07', '23:59'));
    expect(room.today).toBe('24 hours');
    expect(room.detail).toBe('Available 24 hours');
    // A real next-day closure must still end access at midnight.
    const closing = computeStatus(loc('bray-3d-printing'), calendar, at('2026-09-07', '23:59'), {
      'bray-3d-printing': [{ from: '2026-09-08', hours: 'closed', note: 'Published closure' }],
    });
    expect(closing.changesInMinutes).toBe(1);
    expect(closing.detail).toContain('Closes');
    expect(state('bray-machine-shop', '2026-09-08', '12:00')).toBe('unknown');
  });

  it.each([
    ['2026-12-15', 'Fall semester'], ['2026-12-16', 'Fall finals'], ['2026-12-23', 'Fall finals'],
    ['2027-05-04', 'Spring semester'], ['2027-05-06', 'Spring semester'],
    ['2027-05-07', 'Spring finals'], ['2027-05-14', 'Spring finals'],
  ])('labels %s as %s', (date, label) => {
    expect(calendarContext(calendar, at(date, '00:00')).label).toBe(label);
    expect(calendarContext(calendar, at(date, '23:59')).label).toBe(label);
  });

  it('models Late Night dates and overnight spill without inventing the disputed Saturday', () => {
    expect(state('commons-late-night', '2026-09-25', '20:59')).toBe('opening_soon');
    expect(state('commons-late-night', '2026-09-25', '21:00')).toBe('open');
    expect(state('commons-late-night', '2026-09-27', '00:29')).toBe('closing_soon');
    expect(state('commons-late-night', '2026-09-27', '00:30')).toBe('closed');
    expect(state('commons-late-night', '2026-10-09', '22:00')).toBe('closed');
    for (const date of ['2026-11-21', '2026-11-24']) {
      expect(state('commons-late-night', date, '22:00')).toBe('unknown');
      expect(resolveDay(loc('commons-late-night'), date, calendar, [{ from: date, hours: 'closed', note: '' }]).hours).toBe('unknown');
    }
    expect(loc('commons-late-night').overrides?.find((o) => o.from === '2026-11-24')?.hours).toEqual([r('9pm', '12:30am', 'Late night')]);
    for (const date of ['2026-11-22', '2026-11-25']) expect(state('commons-late-night', date, '00:15')).toBe('unknown');
  });

  it('keeps unconfirmed pool interpretations and Commons Thanksgiving estimates unknown', () => {
    expect(loc('hamilton-pool').confidence).toBe('high');
    expect(loc('hamilton-pool').note).toContain('7 PM–8:15 AM');
    expect(state('hamilton-pool', '2026-09-08', '07:30')).toBe('unknown');
    expect(state('hamilton-pool', '2026-11-24', '07:30')).toBe('unknown');
    expect(state('commons', '2026-11-25', '12:00')).toBe('unknown');
  });

  it('corrects Lilly orientation, library holidays and unpublished building coverage', () => {
    expect(state('lilly-music-library', '2026-09-04', '10:00')).toBe('closed');
    expect(state('lilly-music-library', '2026-09-04', '11:00')).toBe('open');
    expect(state('lilly-music-library', '2026-09-04', '17:00')).toBe('closed');
    for (const id of ['tisch-library', 'ginn-library', 'tisch-dds']) {
      for (const date of ['2026-10-12', '2026-11-11']) expect(state(id, date, '12:00')).toBe('open');
    }
    expect(state('tisch-library', '2026-11-25', '17:59')).toBe('closing_soon');
    expect(state('tisch-library', '2026-11-25', '18:00')).toBe('closed');
    expect(state('tisch-library', '2026-11-29', '12:00')).toBe('unknown');
    expect(state('tisch-dds', '2026-11-26', '12:00')).toBe('unknown');
    expect(state('campus-store', '2026-09-07', '12:00')).toBe('unknown');
  });

  it('uses published January library hours without extending Ginn into unset spring dates', () => {
    expect(state('ginn-library', '2027-01-04', '08:00')).toBe('closed');
    expect(state('ginn-library', '2027-01-04', '09:00')).toBe('open');
    expect(state('ginn-library', '2027-01-11', '08:00')).toBe('open');
    expect(state('ginn-library', '2027-01-19', '12:00')).toBe('unknown');
    expect(state('ginn-library', '2027-01-20', '12:00')).toBe('unknown');
    expect(state('lilly-music-library', '2027-01-04', '10:00')).toBe('closed');
    expect(state('lilly-music-library', '2027-01-04', '11:00')).toBe('open');
    expect(state('lilly-music-library', '2027-01-15', '17:00')).toBe('closed');
    expect(state('lilly-music-library', '2027-01-19', '09:00')).toBe('open');
  });
});

it('expires live hours into safe static fallbacks while preserving date conflicts and coverage', () => {
  const now = at('2026-09-07', '12:00');
  const data: LiveData = { fetchedAt: now.toISOString(), vehicles: { 'davis-shuttle': 1 },
    overrides: { dewick: [{ from: '2026-09-07', hours: 'closed', note: 'Live closure' }] },
    sources: { library: 'ok', dining: 'ok', bray: 'ok', shuttles: 'ok' } };
  expect(computeStatus(loc('dewick'), calendar, now, data.overrides).state).toBe('closed');
  const later = new Date(+now + HOURS_MAX_AGE_MS);
  const expired = usableLive(data, later);
  expect(computeStatus(loc('dewick'), calendar, later, expired.overrides).state).toBe('open');
  expect(computeStatus(loc('tisch-dds'), calendar, later, expired.overrides).state).toBe('closed');
  expect(computeStatus(loc('commons'), calendar, later, expired.overrides).state).toBe('unknown');
  expect(expired.vehicles).toEqual({});
  for (const date of ['2026-09-06', '2026-09-07']) {
    for (const time of ['10:59', '11:00', '18:59', '19:00']) expect(state('commons', date, time)).toBe('unknown');
  }
  const september = at('2026-09-08', '12:00');
  const failed = usableLive({ ...data, fetchedAt: september.toISOString(), sources: { library: 'error', dining: 'error', bray: 'error', shuttles: 'error' } }, september);
  expect(computeStatus(loc('tisch-dds'), calendar, september, failed.overrides).state).toBe('open');
  const december = at('2026-12-16', '12:00');
  const stale = usableLive(data, december);
  expect(computeStatus(loc('tisch-library'), calendar, december, stale.overrides).state).toBe('unknown');
});
