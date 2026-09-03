import type { LiveOverrides } from './status';

/** Runtime data merged on top of the static schedule: live hours feeds and shuttle vehicle counts. */
export interface LiveData {
  /** ISO timestamp when the newest source was fetched. */
  fetchedAt: string;
  /** Date overrides by location id (e.g. from the library calendar or dining menu feed). */
  overrides: LiveOverrides;
  /** Number of vehicles currently reporting per transit location id. */
  vehicles: Record<string, number>;
  /** Per-source health, for the footer. */
  sources: Record<string, 'ok' | 'stale' | 'error' | 'empty'>;
}

export const EMPTY_LIVE: LiveData = { fetchedAt: '', overrides: {}, vehicles: {}, sources: {} };
