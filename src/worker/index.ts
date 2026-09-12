import { calendar, locations } from '../data';
import { computeAll } from '../engine/status';
import { EMPTY_LIVE, isLiveData, LIVE_SOURCES, usableLive, type LiveData } from '../engine/live';
import { record } from '../engine/validation';
import { fetchAllLive } from './live';

export interface Env {
  ASSETS: Fetcher;
}

/** How long a live snapshot is served before a background refresh is triggered. */
const LIVE_FRESH_MS = 60_000;
/** Hard cap on how old a snapshot may be before we block on a fresh fetch. */
const LIVE_MAX_AGE_MS = 15 * 60_000;
// Older snapshots lack structured interval access or the Bray calendar source and must be fetched again.
const LIVE_CACHE_KEY = 'https://live.tufts-is-it-open.internal/snapshot-v3';

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

async function getLive(ctx: ExecutionContext, healthCheck = false): Promise<LiveData> {
  if (!memory) {
    try {
      const hit = await edgeCache().match(LIVE_CACHE_KEY);
      if (hit) {
        const value: unknown = await hit.json();
        if (record(value) && isLiveData(value.data)) memory = { data: value.data, at: Date.parse(value.data.fetchedAt) };
      }
    } catch {
      /* ignore */
    }
  }
  const age = memory ? Date.now() - memory.at : Infinity;
  // Readiness accepts cached provider successes until the hours TTL; probes do not refresh every minute.
  if (healthCheck && memory && age >= 0 && age < LIVE_MAX_AGE_MS) {
    return { ...memory.data, sources: age < LIVE_FRESH_MS ? memory.data.sources : markStale(memory.data.sources) };
  }
  if (memory && age >= 0 && age < LIVE_FRESH_MS) return usableLive(memory.data, new Date());
  if (memory && age < LIVE_MAX_AGE_MS) {
    ctx.waitUntil(refreshLive(ctx).catch(() => undefined));
    return usableLive({ ...memory.data, sources: markStale(memory.data.sources) }, new Date());
  }
  try {
    return await refreshLive(ctx);
  } catch {
    // Whatever we still have is older than the freshness window: say so.
    return usableLive(memory?.data ?? EMPTY_LIVE, new Date(), true);
  }
}

function markStale(sources: LiveData['sources']): LiveData['sources'] {
  const out: LiveData['sources'] = {};
  for (const [k, v] of Object.entries(sources)) out[k] = v === 'ok' ? 'stale' : v;
  return out;
}

/**
 * API responses may sit in the browser cache for as long as the Worker itself serves a snapshot without
 * refreshing it (LIVE_FRESH_MS): a reload or a second tab within that window costs no Worker request and
 * sees the same data it would have been served anyway.
 */
const API_CACHE_CONTROL = `public, max-age=${LIVE_FRESH_MS / 1000}`;

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'cache-control': API_CACHE_CONTROL,
      ...(init.headers ?? {}),
    },
  });
}

/**
 * Strict ISO-8601 timestamp: `YYYY-MM-DDTHH:MM[:SS[.fff]]` followed by a mandatory `Z` or
 * `±HH:MM` offset. Requiring the offset removes the ambiguity of local-time strings, and the
 * explicit shape keeps `Date`'s lenient parser (which accepts `09/12/2026` and the like) out of
 * the contract.
 */
const ISO_AT =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:(Z)|([+-])(\d{2}):(\d{2}))$/i;

/**
 * Parse a strict ISO-8601 timestamp into an instant, or `null` if the string does not match the
 * shape or names a calendar date/time that does not exist (e.g. `2026-02-30`, `25:00`, `+99:00`).
 * `Date.UTC` silently rolls impossible fields forward, so every field is checked against the
 * round-tripped result instead of trusting the constructor.
 */
export function parseIsoTimestamp(text: string): Date | null {
  const m = ISO_AT.exec(text);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = Number(m[6] ?? '0');
  const ms = Number((m[7] ?? '0').padEnd(3, '0'));
  const wall = new Date(Date.UTC(year, month - 1, day, hour, minute, second, ms));
  if (
    wall.getUTCFullYear() !== year ||
    wall.getUTCMonth() !== month - 1 ||
    wall.getUTCDate() !== day ||
    wall.getUTCHours() !== hour ||
    wall.getUTCMinutes() !== minute ||
    wall.getUTCSeconds() !== second
  ) {
    return null;
  }
  let offsetMinutes = 0;
  if (!m[8]) {
    const offHour = Number(m[10]);
    const offMinute = Number(m[11]);
    if (offHour > 23 || offMinute > 59) return null;
    offsetMinutes = (offHour * 60 + offMinute) * (m[9] === '-' ? -1 : 1);
  }
  const instant = new Date(wall.getTime() - offsetMinutes * 60_000);
  return Number.isNaN(instant.getTime()) ? null : instant;
}

/**
 * Resolve the optional `at` query parameter: absent means now; a strict ISO-8601 timestamp with an
 * explicit offset means that instant; anything else (including an empty string) is `null`, and the
 * route answers 400 rather than silently evaluating the current time under a timestamp the caller
 * never asked for.
 */
function parseAt(url: URL): Date | null {
  if (!url.searchParams.has('at')) return new Date();
  return parseIsoTimestamp(url.searchParams.get('at')!.trim());
}

const invalidAt = (): Response =>
  json(
    { error: "Invalid 'at' parameter; expected an ISO-8601 timestamp with a UTC offset, e.g. 2026-09-12T15:04:05Z" },
    { status: 400, headers: { 'cache-control': 'no-store' } },
  );

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // The homepage is a static asset (public/index.html, generated by `npm run build`); the assets layer
    // serves it before this Worker runs, so only the API and unknown paths reach this handler.
    if (path === '/api/live') {
      const live = await getLive(ctx);
      return json(live);
    }

    if (path === '/api/status') {
      const at = parseAt(url);
      if (!at) return invalidAt();
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

    // Older browser bundles may still send events after deployment.
    if (path === '/api/event') return new Response(null, { status: 410 });

    if (path === '/api/locations') {
      return json({ calendar, locations }, { headers: { 'cache-control': 'public, max-age=3600' } });
    }

    if (path === '/healthz') {
      const live = await getLive(ctx, true);
      const ok = LIVE_SOURCES.every((id) => ['ok', 'stale'].includes(live.sources[id] ?? '')) && !live.failedLocations?.length;
      return json({ ok, fetchedAt: live.fetchedAt || null, ageSeconds: live.fetchedAt ? Math.max(0, Math.floor((Date.now() - Date.parse(live.fetchedAt)) / 1000)) : null,
        sources: live.sources, failedLocations: live.failedLocations ?? [] },
      { status: ok ? 200 : 503, headers: { 'cache-control': 'no-store' } });
    }

    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;
