import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchAllLive, _internal } from '../src/worker/live';
import { feedBody, libcal, NOW, response } from './live-fixtures';
import { usableLive, isLiveData, HOURS_MAX_AGE_MS, VEHICLES_MAX_AGE_MS } from '../src/engine/live';

beforeEach(() => vi.spyOn(console, 'warn').mockImplementation(() => undefined));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('fails a partial dining location without suppressing healthy locations, then recovers', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    if (String(url).includes('carmichael') && String(url).includes('breakfast')) throw new Error('timeout');
    return response(feedBody(String(url)));
  }));
  const data = await fetchAllLive(NOW);
  expect(data.sources.dining).toBe('error');
  expect(data.failedLocations).toEqual(['carmichael']);
  expect(data.overrides.carmichael?.[0]?.hours).toBe('unknown');
  expect(data.overrides.dewick).toBeUndefined();
  expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('breakfast'));
  vi.stubGlobal('fetch', vi.fn(async (url) => response(feedBody(String(url)))));
  const recovered = await fetchAllLive(NOW);
  expect(recovered.sources.dining).toBe('ok');
  expect(recovered.overrides.carmichael?.[0]?.hours).toBe('closed');
});

it.each([{}, null, { days: null }, { days: [{ date: '2026-02-30', menu_items: [] }] },
  { days: [{ date: '2026-09-10', menu_items: [{ text: 7 }] }] },
  { days: [{ date: '2026-09-10', menu_items: [{ food: false }] }] },
])('rejects malformed dining JSON: %j', (body) => {
  expect(() => _internal.parseNutrisliceWeek(body)).toThrow();
});
it('accepts explicitly empty menus', () => {
  expect(_internal.parseNutrisliceWeek({ days: [] })).toEqual({ days: [] });
  expect(_internal.parseNutrisliceWeek({ days: [{ date: '2026-09-10', menu_items: [] }] })).toBeDefined();
});
it('reads the real LibCal locations envelope and isolates a missing location', async () => {
  const grid = libcal();
  grid.locations = grid.locations.filter((l) => l.lid !== 15418);
  vi.stubGlobal('fetch', vi.fn(async (url) => response(String(url).includes('libcal') ? grid : feedBody(String(url)))));
  const data = await fetchAllLive(NOW);
  expect(data.sources.library).toBe('error');
  expect(data.failedLocations).toEqual(['ginn-library']);
  expect(data.overrides['tisch-library']?.find((o) => o.from === '2026-09-10')?.hours).toEqual([{ start: 540, end: 1260, label: 'Open to public' }]);
});
it.each([{}, { buses: null }, { buses: { a: { busId: 1 } } }, { buses: { a: 7 } }])('does not report malformed shuttle data as zero vehicles: %j', async (body) => {
  vi.stubGlobal('fetch', vi.fn(async (url) => response(String(url).includes('passiogo') ? body : feedBody(String(url)))));
  const data = await fetchAllLive(NOW);
  expect(data.sources.shuttles).toBe('error');
  expect(data.vehicles).toEqual({});
});
it('expires counts and schedules by original fetch time, and rejects invalid snapshots', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url) => response(feedBody(String(url)))));
  const data = await fetchAllLive(NOW);
  expect(isLiveData(data)).toBe(true);
  expect(isLiveData({ ...data, vehicles: { bus: -1 } })).toBe(false);
  expect(isLiveData({ ...data, overrides: { dewick: [{ from: 'bad', hours: [], note: '' }] } })).toBe(false);
  expect(isLiveData({ ...data, overrides: { dewick: [{ from: '2026-09-10', hours: ['closed'], note: '' }] } })).toBe(false);
  expect(usableLive(data, new Date(+NOW + VEHICLES_MAX_AGE_MS)).vehicles).toEqual({});
  const expired = usableLive(data, new Date(+NOW + HOURS_MAX_AGE_MS));
  expect(expired.overrides.carmichael?.[0]?.hours).toBe('unknown');
  expect(expired.fetchedAt).toBe(data.fetchedAt);
  expect(usableLive(data, NOW, true).overrides.carmichael?.[0]?.hours).toBe('unknown');
});

it('ignores vehicles flagged outdated and counts each bus once', async () => {
  const bus = { busId: '1', routeId: '63771' };
  vi.stubGlobal('fetch', vi.fn(async (url) => response(String(url).includes('passiogo')
    ? { buses: { a: [bus, bus, { ...bus, busId: '2', outdated: 1 }] } } : feedBody(String(url)))));
  const data = await fetchAllLive(NOW);
  expect(data.vehicles['davis-shuttle']).toBe(1);
});
