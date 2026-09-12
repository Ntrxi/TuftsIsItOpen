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

  it.each(['not-a-date', '', '2026-13-45', '   '])('rejects invalid `at` %j with a 400 JSON error', async (at) => {
    const res = await status(`?at=${encodeURIComponent(at)}`);
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ error: "Invalid 'at' parameter; expected an ISO-8601 timestamp" });
    expect(fetch).not.toHaveBeenCalled();
  });
});
