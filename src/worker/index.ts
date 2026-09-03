import { calendar, locations } from '../data';
import { computeAll } from '../engine/status';
import { EMPTY_LIVE, type LiveData } from '../engine/live';
import { renderPage } from '../render/page';
import { fetchAllLive } from './live';

export interface Env {
  ASSETS: Fetcher;
}

/** How long a live snapshot is served before a background refresh is triggered. */
const LIVE_FRESH_MS = 60_000;
/** Hard cap on how old a snapshot may be before we block on a fresh fetch. */
const LIVE_MAX_AGE_MS = 15 * 60_000;
const LIVE_CACHE_KEY = 'https://live.tufts-is-it-open.internal/snapshot';

let memory: { data: LiveData; at: number } | undefined;
let inflight: Promise<LiveData> | undefined;

const edgeCache = (): Cache => (caches as unknown as { default: Cache }).default;

async function refreshLive(ctx: ExecutionContext): Promise<LiveData> {
  if (inflight) return inflight;
  inflight = (async () => {
    const data = await fetchAllLive(new Date());
    memory = { data, at: Date.now() };
    try {
      const cache = edgeCache();
      await cache.put(
        LIVE_CACHE_KEY,
        new Response(JSON.stringify(memory), { headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' } }),
      );
    } catch {
      /* cache unavailable (e.g. local dev) */
    }
    return data;
  })();
  try {
    return await inflight;
  } finally {
    inflight = undefined;
    void ctx;
  }
}

async function getLive(ctx: ExecutionContext): Promise<LiveData> {
  if (!memory) {
    try {
      const hit = await edgeCache().match(LIVE_CACHE_KEY);
      if (hit) memory = (await hit.json()) as { data: LiveData; at: number };
    } catch {
      /* ignore */
    }
  }
  const age = memory ? Date.now() - memory.at : Infinity;
  if (memory && age < LIVE_FRESH_MS) return memory.data;
  if (memory && age < LIVE_MAX_AGE_MS) {
    ctx.waitUntil(refreshLive(ctx).catch(() => undefined));
    return { ...memory.data, sources: markStale(memory.data.sources) };
  }
  try {
    return await refreshLive(ctx);
  } catch {
    return memory?.data ?? EMPTY_LIVE;
  }
}

function markStale(sources: LiveData['sources']): LiveData['sources'] {
  const out: LiveData['sources'] = {};
  for (const [k, v] of Object.entries(sources)) out[k] = v === 'ok' ? 'stale' : v;
  return out;
}

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': 'public, max-age=30',
      ...(init.headers ?? {}),
    },
  });
}

function parseAt(url: URL): Date {
  const at = url.searchParams.get('at');
  if (!at) return new Date();
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/' || path === '/index.html') {
      const now = new Date();
      const live = await getLive(ctx);
      const statuses = computeAll(locations, calendar, now, live.overrides);
      const html = renderPage(locations, statuses, calendar, live, now);
      return new Response(html, {
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'public, max-age=30, stale-while-revalidate=60',
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'strict-origin-when-cross-origin',
        },
      });
    }

    if (path === '/api/live') {
      const live = await getLive(ctx);
      return json(live);
    }

    if (path === '/api/status') {
      const at = parseAt(url);
      const live = await getLive(ctx);
      const statuses = computeAll(locations, calendar, at, live.overrides);
      const byId = new Map(locations.map((l) => [l.id, l]));
      return json({
        at: at.toISOString(),
        timezone: 'America/New_York',
        liveFetchedAt: live.fetchedAt || null,
        locations: statuses.map((s) => {
          const loc = byId.get(s.id)!;
          return {
            id: s.id,
            name: loc.name,
            category: loc.category,
            state: s.state,
            label: s.label,
            detail: s.detail,
            period: s.period ?? null,
            today: s.today,
            scheduleNote: s.scheduleNote ?? null,
            nextDepartures: s.nextDepartures ?? null,
            vehicles: live.vehicles[s.id] ?? null,
            links: loc.links,
          };
        }),
      });
    }

    if (path === '/api/locations') {
      return json({ calendar, locations }, { headers: { 'cache-control': 'public, max-age=3600' } });
    }

    if (path === '/healthz') return new Response('ok');

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
