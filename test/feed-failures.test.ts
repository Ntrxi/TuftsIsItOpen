import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { fetchAllLive, _internal } from '../src/worker/live';
import { feedBody, libcal, NOW, response } from './live-fixtures';
import { usableLive, isLiveData, HOURS_MAX_AGE_MS, VEHICLES_MAX_AGE_MS, FEED_LOCATIONS } from '../src/engine/live';

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
  expect(data.overrides.carmichael?.[0]?.hours).toBeUndefined();
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
  expect(expired.overrides.carmichael?.[0]?.hours).toBeUndefined();
  expect(expired.fetchedAt).toBe(data.fetchedAt);
  expect(usableLive(data, NOW, true).overrides).toEqual(data.overrides);
  expect(usableLive(data, NOW, true).vehicles).toEqual(data.vehicles);
  expect(usableLive(data, NOW, true).sources.shuttles).toBe('stale');
  expect(usableLive(expired, new Date(+NOW + HOURS_MAX_AGE_MS))).toEqual(expired);
  for (const seconds of [61, 179]) {
    const stale = usableLive({ ...data, sources: { ...data.sources, shuttles: 'stale' } }, new Date(+NOW + seconds * 1000));
    expect(stale.vehicles).toEqual(data.vehicles);
    expect(stale.sources.shuttles).toBe('stale');
  }
});

it('ignores vehicles flagged outdated and counts each bus once', async () => {
  const bus = { busId: '1', routeId: '63771' };
  vi.stubGlobal('fetch', vi.fn(async (url) => response(String(url).includes('passiogo')
    ? { buses: { a: [bus, bus, { ...bus, busId: '2', outdated: 1 }] } } : feedBody(String(url)))));
  const data = await fetchAllLive(NOW);
  expect(data.vehicles['davis-shuttle']).toBe(1);
});


it.each([61, 120, 180])('retains snapshots when the device is %i seconds slow', async (seconds) => {
  vi.stubGlobal('fetch', vi.fn(async (url) => response(feedBody(String(url)))));
  const data = await fetchAllLive(NOW);
  const current = usableLive(data, new Date(+NOW - seconds * 1000));
  expect(current.overrides).toEqual(data.overrides);
  expect(current.vehicles).toEqual(data.vehicles);
});

it('keeps the client feed location lists tied to the worker providers', () => {
  expect(FEED_LOCATIONS.library.slice().sort()).toEqual(_internal.LIBCAL_LOCATIONS.map((l) => l.locId).sort());
  expect(FEED_LOCATIONS.dining.slice().sort()).toEqual(_internal.NUTRISLICE.map((l) => l.locId).sort());
  expect(FEED_LOCATIONS.bray).toEqual([_internal.BRAY_LOC]);
});

it('isolates unreadable future LibCal days and preserves static overrides on not-set days', async () => {
  const grid = libcal();
  for (const loc of grid.locations) {
    const week = loc.weeks[0]!;
    week['2026-09-11']!.times.status = 'unexpected';
    week['2026-09-12']!.times.hours = [];
    week['2026-10-10'] = { date: '2026-10-10', times: { status: 'not-set', hours: [] } };
  }
  vi.stubGlobal('fetch', vi.fn(async (url) => response(String(url).includes('libcal') ? grid : feedBody(String(url)))));
  const data = await fetchAllLive(NOW);
  expect(data.sources.library).toBe('ok');
  expect(data.failedLocations).toEqual([]);
  expect(data.overrides['lilly-music-library']?.some((o) => o.from === '2026-10-10')).toBe(false);
  const { calendar, locations } = await import('../src/data');
  const { resolveDay } = await import('../src/engine/status');
  expect(resolveDay(locations.find((l) => l.id === 'lilly-music-library')!, '2026-10-10', calendar,
    data.overrides['lilly-music-library']).note).toBe('Parents and Family Weekend');
});

it('does not create library overrides for matching ordinary hours', async () => {
  const { calendar, locations } = await import('../src/data');
  const { resolveDay } = await import('../src/engine/status');
  const { fmtTime } = await import('../src/engine/format');
  const grid = libcal();
  for (const entry of grid.locations) {
    const id = _internal.LIBCAL_LOCATIONS.find((l) => l.lid === entry.lid)?.locId ?? 'tisch-library';
    const loc = locations.find((l) => l.id === id)!;
    for (const day of Object.values(entry.weeks[0]!)) {
      const hours = resolveDay(loc, day.date, calendar).hours;
      if (hours === 'unknown') continue;
      const ranges = entry.lid === 20834 ? hours.filter((h) => h.access !== 'special') : hours;
      day.times = { status: ranges.length ? 'open' : 'closed', hours: ranges.map((h) => ({ from: fmtTime(h.start), to: fmtTime(h.end) })) };
    }
  }
  vi.stubGlobal('fetch', vi.fn(async (url) => response(String(url).includes('libcal') ? grid : feedBody(String(url)))));
  const data = await fetchAllLive(NOW);
  expect(data.sources.library).toBe('ok');
  for (const id of FEED_LOCATIONS.library) expect(data.overrides[id]?.some((o) => o.from === '2026-09-10')).toBe(false);
});

it('keeps valid shuttle vehicles when another record is unreadable', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url) => response(String(url).includes('passiogo')
    ? { buses: [{ busId: '1', routeId: '63771' }, { busId: 'bad' }, null, { busId: '2', routeId: '63771', outdated: 'odd' }] }
    : feedBody(String(url)))));
  const data = await fetchAllLive(NOW);
  expect(data.sources.shuttles).toBe('ok');
  expect(data.vehicles['davis-shuttle']).toBe(1);
});


it('does not count Tisch as open when its public calendar is unset', async () => {
  const grid = libcal();
  for (const day of Object.values(grid.locations.find((l) => l.lid === 20834)!.weeks[0]!)) day.times.status = 'not-set';
  vi.stubGlobal('fetch', vi.fn(async (url) => response(String(url).includes('libcal') ? grid : feedBody(String(url)))));
  const data = await fetchAllLive(NOW);
  const { calendar, locations } = await import('../src/data');
  const { computeStatus } = await import('../src/engine/status');
  const status = computeStatus(locations.find((l) => l.id === 'tisch-library')!, calendar, NOW, data.overrides);
  expect(status.state).toBe('unknown');
  expect(status.detail).toContain('Access hours unconfirmed');
});

it.each(['closed', 'shorter', 'not-set'])('does not report DDS open when building access is %s', async (mode) => {
  const grid = libcal();
  const building = grid.locations.find((l) => l.lid === 20832)!;
  for (const day of Object.values(building.weeks[0]!)) {
    day.times = mode === 'shorter'
      ? { status: 'open', hours: [{ from: '9am', to: '5pm' }] }
      : { status: mode, hours: [] };
  }
  vi.stubGlobal('fetch', vi.fn(async (url) => response(String(url).includes('libcal') ? grid : feedBody(String(url)))));
  const data = await fetchAllLive(NOW);
  const { calendar, locations } = await import('../src/data');
  const { computeStatus } = await import('../src/engine/status');
  const status = computeStatus(locations.find((l) => l.id === 'tisch-dds')!, calendar, NOW, data.overrides);
  expect(status.state).toBe('unknown');
  expect(status.detail).toContain(mode === 'not-set' ? 'not yet confirmed' : 'calendars disagree');
});
