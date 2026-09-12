import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../src/worker';
import { feedBody, NOW, response } from './live-fixtures';

it('leaves the homepage to the static assets layer', async () => {
  const assets = vi.fn(async (request: Request) => new Response(`asset:${new URL(request.url).pathname}`));
  const env = { ASSETS: { fetch: assets } as unknown as Fetcher } satisfies Env;
  const ctx = { waitUntil() {} } as unknown as ExecutionContext;
  for (const path of ['/', '/index.html', '/jumbo.svg', '/missing']) {
    const response = await worker.fetch(new Request(`https://tufts.example${path}`), env, ctx);
    expect(await response.text()).toBe(`asset:${path}`);
  }
  expect(assets).toHaveBeenCalledTimes(4);
});

describe('/api/status `at` parameter', () => {
  const env = {} as Env;
  const ctx = { waitUntil() {} } as unknown as ExecutionContext;
  // Re-import per test so the module-level live snapshot cache starts empty each time.
  const status = async (query: string) => {
    const { default: fresh } = await import('../src/worker');
    return fresh.fetch(new Request(`https://tufts.example/api/status${query}`), env, ctx);
  };

  beforeEach(() => {
    vi.resetModules();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async (url) => response(feedBody(String(url)))));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it('uses the current time when `at` is absent', async () => {
    const res = await status('');
    expect(res.status).toBe(200);
    expect((await res.json() as { at: string }).at).toBe(NOW.toISOString());
  });

  it('evaluates a valid `at` timestamp instead of now', async () => {
    const at = '2026-03-01T04:30:00.000Z';
    const res = await status(`?at=${encodeURIComponent(at)}`);
    expect(res.status).toBe(200);
    const body = await res.json() as { at: string; locations: unknown[] };
    expect(body.at).toBe(at);
    expect(body.locations.length).toBeGreaterThan(0);
  });

  it.each([
    ['2026-03-01T04:30Z', '2026-03-01T04:30:00.000Z'],
    ['2026-03-01T04:30:15Z', '2026-03-01T04:30:15.000Z'],
    ['2026-03-01T04:30:15.5Z', '2026-03-01T04:30:15.500Z'],
    ['2026-03-01T04:30:00-05:00', '2026-03-01T09:30:00.000Z'],
    ['2026-03-01T04:30:00+05:30', '2026-02-28T23:00:00.000Z'],
    ['2024-02-29T00:00:00Z', '2024-02-29T00:00:00.000Z'],
  ])('accepts strict ISO-8601 `at` %s and applies its offset', async (at, expected) => {
    const res = await status(`?at=${encodeURIComponent(at)}`);
    expect(res.status).toBe(200);
    expect((await res.json() as { at: string }).at).toBe(expected);
  });

  it.each([
    'not-a-date',
    '',
    '   ',
    '2026-13-45',
    '2026-02-30T12:00:00Z', // Date would roll this to March 2
    '2023-02-29T00:00:00Z', // not a leap year
    '2026-03-01T24:00:00Z',
    '2026-03-01T04:60:00Z',
    '2026-03-01T04:30:60Z',
    '2026-03-01T04:30:00+24:00',
    '2026-03-01T04:30:00+05:60',
    '2026-03-01T04:30:00', // offset is required
    '2026-03-01', // date-only is ambiguous
    '09/12/2026', // Date accepts this; the contract does not
    'March 1, 2026 04:30 UTC',
    '1772339400000', // epoch millis
  ])('rejects invalid `at` %j with a 400 JSON error', async (at) => {
    const res = await status(`?at=${encodeURIComponent(at)}`);
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({
      error: "Invalid 'at' parameter; expected an ISO-8601 timestamp with a UTC offset, e.g. 2026-09-12T15:04:05Z",
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});
