import { describe, expect, it } from 'vitest';
import { _internal } from '../src/worker/live';

const { readMenuDay, nutrisliceDayOverride } = _internal;
const holiday = (text: string) => ({ text, is_holiday: true, food: null });
const food = (name: string) => ({ text: name, is_holiday: false, food: { name } });
const station = (name: string) => ({ text: name, is_holiday: false, is_station_header: true, food: null });

const closed = { text: 'Carm closed for building issue', hasFood: false };
const served = { text: '', hasFood: true };

describe('Nutrislice weekly menu parsing', () => {
  it('summarizes what each menu publishes for a day', () => {
    expect(readMenuDay({ date: '2026-09-05', menu_items: [holiday('Carm closed for building issue')] })).toEqual(closed);
    expect(readMenuDay({ date: '2026-09-08', menu_items: [station('Grill'), food('Burger')] })).toEqual(served);
    expect(readMenuDay({ date: '2026-09-08', menu_items: [holiday('Welcome back!'), food('Burger')] })).toEqual({ text: 'Welcome back!', hasFood: true });
    // Nothing published (e.g. no breakfast menu on a Saturday) is not evidence either way.
    expect(readMenuDay({ date: '2026-09-08', menu_items: [station('Grill')] })).toBeUndefined();
    expect(readMenuDay({ date: '2026-09-08', menu_items: [] })).toBeUndefined();
    expect(readMenuDay({ date: '2026-09-08' })).toBeUndefined();
  });

  it('turns a closure with no menu into a closed override (weekends included)', () => {
    // Saturday 2026-09-05: the digest endpoint never returned this day, so the site showed Carmichael open.
    expect(nutrisliceDayOverride('2026-09-05', [closed])).toEqual({
      from: '2026-09-05',
      hours: 'closed',
      note: 'Closed: “Carm closed for building issue” (per Tufts Dining menu)',
    });
  });

  it('closes the day only when every published meal is a closure', () => {
    const all = nutrisliceDayOverride('2026-09-05', [closed, closed]);
    expect(all?.hours).toBe('closed');
    expect(all?.note).toBe('Closed: “Carm closed for building issue” (per Tufts Dining menu)');
    // Dinner-only closure: keep the scheduled hours, surface the text.
    const partial = nutrisliceDayOverride('2026-09-04', [served, served, { text: 'Dinner closed for the food fair', hasFood: false }]);
    expect(partial).toEqual({ from: '2026-09-04', note: 'Tufts Dining notice: “Dinner closed for the food fair”' });
  });

  it('keeps scheduled hours for notices that do not read as closures', () => {
    expect(nutrisliceDayOverride('2026-09-08', [{ text: 'Welcome back!', hasFood: true }])).toEqual({
      from: '2026-09-08',
      note: 'Tufts Dining notice: “Welcome back!”',
    });
    expect(nutrisliceDayOverride('2026-09-08', [{ text: 'Menu coming soon', hasFood: false }])?.hours).toBeUndefined();
  });

  it('reports nothing for ordinary days', () => {
    expect(nutrisliceDayOverride('2026-09-08', [served, served, served])).toBeUndefined();
    expect(nutrisliceDayOverride('2026-09-08', [])).toBeUndefined();
  });
});
