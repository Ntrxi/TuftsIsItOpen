/**
 * Privacy-safe custom events for Workers Analytics Engine.
 *
 * The browser posts a small JSON event to `POST /api/event`; the Worker validates
 * it with `toDataPoint` and writes one Analytics Engine data point. Nothing here
 * identifies a person: no IPs, user agents, cookies, or free-text (search queries
 * are reduced to their length and result count).
 *
 * Data point schema (see the README for example SQL):
 *   index1  sampling key          location_view:<id> | search | filter
 *   blob1   event type
 *   blob2   subject               location id · category · 'open_only' · ''
 *   blob3   location category     (location_view only)
 *   double1 value                 search: query length · open_only: 1 on / 0 off
 *   double2 visible search result count (includes active filters)
 */

export type AnalyticsEvent =
  | { type: 'location_view'; id: string }
  | { type: 'search'; length: number; results: number }
  | { type: 'filter'; key: 'category'; value: string }
  | { type: 'filter'; key: 'open_only'; on: boolean };

/** Shape accepted by `AnalyticsEngineDataset.writeDataPoint`. */
export interface DataPoint {
  indexes: string[];
  blobs: string[];
  doubles: number[];
}

export interface EventContext {
  /** Map of known location id → category. Events for unknown ids are dropped. */
  locations: ReadonlyMap<string, string>;
  categories: ReadonlySet<string>;
}

const MAX_NUMBER = 1000;

const clamp = (n: unknown): number | null =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.min(Math.round(n), MAX_NUMBER) : null;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Validate an untrusted event body. Returns null for anything that is not an exact, expected event. */
export function toDataPoint(body: unknown, ctx: EventContext): DataPoint | null {
  if (!isRecord(body)) return null;
  const point = (subject: string, category = '', doubles: number[] = []): DataPoint => ({
    indexes: [body.type === 'location_view' ? `location_view:${subject}` : String(body.type)],
    blobs: [String(body.type), subject, category],
    doubles,
  });

  switch (body.type) {
    case 'location_view': {
      const category = typeof body.id === 'string' ? ctx.locations.get(body.id) : undefined;
      return category ? point(body.id as string, category) : null;
    }
    case 'search': {
      const length = clamp(body.length);
      const results = clamp(body.results);
      return length !== null && results !== null ? point('', '', [length, results]) : null;
    }
    case 'filter': {
      if (body.key === 'category') {
        const value = body.value;
        return typeof value === 'string' && (value === 'all' || ctx.categories.has(value)) ? point(value) : null;
      }
      if (body.key === 'open_only') return typeof body.on === 'boolean' ? point('open_only', '', [body.on ? 1 : 0]) : null;
      return null;
    }
    default:
      return null;
  }
}
