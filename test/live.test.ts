import { describe, expect, it } from 'vitest';
import { _internal } from '../src/worker/live';

const { nutrisliceDayOverride } = _internal;
const holiday = (text: string) => ({ text, is_holiday: true, food: null });
const food = (name: string) => ({ text: name, is_holiday: false, food: { name } });
const station = (name: string) => ({ text: name, is_holiday: false, is_station_header: true, food: null });

describe('Nutrislice weekly menu parsing', () => {
  it('turns a closure line with no menu into a closed override (weekends included)', () => {
    // Saturday 2026-09-05: the digest endpoint never returned this day, so the site showed Carmichael open.
    const ov = nutrisliceDayOverride({ date: '2026-09-05', menu_items: [holiday('Carm closed for building issue')] });
    expect(ov).toEqual({ from: '2026-09-05', hours: 'closed', note: 'Closed: “Carm closed for building issue” (per Tufts Dining menu)' });
  });

  it('keeps regular hours when a notice is posted alongside a real menu', () => {
    const ov = nutrisliceDayOverride({ date: '2026-09-08', menu_items: [holiday('Welcome back!'), station('Grill'), food('Burger')] });
    expect(ov?.hours).toBe('regular');
    expect(ov?.note).toContain('Welcome back!');
  });

  it('keeps regular hours for a notice that does not read as a closure', () => {
    const ov = nutrisliceDayOverride({ date: '2026-09-08', menu_items: [holiday('Menu coming soon')] });
    expect(ov?.hours).toBe('regular');
  });

  it('ignores ordinary menu days and empty days', () => {
    expect(nutrisliceDayOverride({ date: '2026-09-08', menu_items: [station('Grill'), food('Burger')] })).toBeUndefined();
    expect(nutrisliceDayOverride({ date: '2026-09-08', menu_items: [] })).toBeUndefined();
    expect(nutrisliceDayOverride({ date: '2026-09-08' })).toBeUndefined();
  });
});
