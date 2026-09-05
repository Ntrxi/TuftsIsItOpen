import { afterEach, describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../src/worker';
import type { LiveData } from '../src/engine/live';

const env = { EVENT_RATE_LIMITER: { limit: vi.fn() } } as unknown as Env;
const ctx = { waitUntil: () => undefined, passThroughOnException: () => undefined } as unknown as ExecutionContext;
const json = (body: string) => new Response(body, { headers: { 'content-type': 'application/json' } });

/** A Nutrislice week where Carmichael is closed on Sat Sep 12; every other feed returns an empty object. */
const closedWeek = JSON.stringify({ days: [{ date: '2026-09-12', menu_items: [{ text: 'Closed for testing', is_holiday: true }] }] });
const feedsUp = () => vi.fn((url: string | URL | Request) => Promise.resolve(json(String(url).includes('carmichael') ? closedWeek : '{}')));
const feedsDown = () => vi.fn(() => Promise.reject(new Error('offline')));

async function live(): Promise<LiveData> {
  const res = await worker.fetch(new Request('https://tufts.example/api/live'), env, ctx);
  return (await res.json()) as LiveData;
}

describe('live snapshot cache', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('keeps a feed’s previous data and reports it stale when the feed fails on refresh', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-09-10T16:00:00Z'));
    vi.stubGlobal('fetch', feedsUp());
    const first = await live();
    expect(first.sources).toEqual({ library: 'ok', dining: 'ok', shuttles: 'ok' });
    expect(first.overrides.carmichael?.[0]).toMatchObject({ from: '2026-09-12', hours: 'closed' });

    // Past the hard cap, so the next request blocks on a refresh; every feed is now failing.
    vi.setSystemTime(new Date('2026-09-10T16:20:00Z'));
    vi.stubGlobal('fetch', feedsDown());
    const second = await live();
    expect(second.sources).toEqual({ library: 'stale', dining: 'stale', shuttles: 'error' });
    expect(second.overrides.carmichael?.[0]).toMatchObject({ from: '2026-09-12', hours: 'closed' });
    expect(second.overrides.carmichael?.[0]?.note).toBe('Closed: “Closed for testing” (per Tufts Dining menu) · live feed unavailable, may be out of date');
    // Bus counts are not carried forward: the chip disappears instead of showing an old number.
    expect(second.vehicles).toEqual({});

    // A further failure keeps the label single.
    vi.setSystemTime(new Date('2026-09-10T16:40:00Z'));
    const third = await live();
    expect(third.overrides.carmichael?.[0]?.note).toBe(second.overrides.carmichael?.[0]?.note);
  });
});
