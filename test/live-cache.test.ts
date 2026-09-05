import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/worker';
import type { LiveData } from '../src/engine/live';
import { feedBody, NOW, response } from './live-fixtures';

const env = {} as Env;
let pending: Promise<unknown>[];
const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p) } as unknown as ExecutionContext;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  pending = [];
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.stubGlobal('fetch', vi.fn(async (url) => response(feedBody(String(url)))));
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

async function request(path: string) {
  const { default: worker } = await import('../src/worker');
  return worker.fetch(new Request(`https://tufts.example${path}`), env, ctx);
}

describe('live snapshot cache and health', () => {
  it('reports healthy feeds, then fails readiness and removes old hours/counts after failure', async () => {
    const first = await request('/healthz');
    expect(first.status).toBe(200);
    expect(first.headers.get('cache-control')).toBe('no-store');
    vi.setSystemTime(new Date(NOW.getTime() + 20 * 60_000));
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const second = await request('/api/live');
    const data = await second.json() as LiveData;
    expect(data.sources).toEqual({ library: 'error', dining: 'error', shuttles: 'error' });
    expect(data.overrides.carmichael?.[0]?.hours).toBe('unknown');
    expect(data.vehicles).toEqual({});
    expect((await request('/healthz')).status).toBe(503);
    expect(console.warn).toHaveBeenCalled();
  });
  it('marks a background-refresh snapshot stale and hides shuttle counts', async () => {
    await request('/api/live');
    vi.setSystemTime(new Date(NOW.getTime() + 90_000));
    const stale = await request('/healthz');
    expect(stale.status).toBe(503);
    expect((await stale.json() as { sources: LiveData['sources'] }).sources.library).toBe('stale');
    await Promise.all(pending);
    expect((await request('/healthz')).status).toBe(200);
  });
  it('rejects a malformed edge-cache snapshot', async () => {
    vi.stubGlobal('caches', { default: { match: async () => response({ data: { overrides: {} }, at: NOW.getTime() }), put: async () => undefined } });
    expect((await request('/healthz')).status).toBe(200);
    expect(fetch).toHaveBeenCalled();
  });
});
