import type { LiveOverrides } from './status';
import { addDays, toLocal } from './time';
import { dateKey, dayHours, record } from './validation';

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
  /** Locations with incomplete or failed hours feeds. */
  failedLocations?: string[];
}

export const EMPTY_LIVE: LiveData = { fetchedAt: '', overrides: {}, vehicles: {}, sources: {} };

export const HOURS_MAX_AGE_MS = 15 * 60_000;
export const VEHICLES_MAX_AGE_MS = 3 * 60_000;
export const CLOCK_SKEW_TOLERANCE_MS = 3 * 60_000;
export const FEED_LOCATIONS = {
  library: ['tisch-library', 'tisch-dds', 'ginn-library', 'lilly-music-library'],
  dining: ['dewick', 'carmichael', 'commons', 'hodgdon', 'hotung', 'kindlevan', 'mugar-cafe', 'pax-et-lox', 'tower-cafe', 'smfa-cafe'],
  bray: ['bray-machine-shop'],
};
/** Every provider a snapshot must report on. */
export const LIVE_SOURCES = ['library', 'dining', 'bray', 'shuttles'];

export function isLiveData(value: unknown): value is LiveData {
  if (!record(value) || typeof value.fetchedAt !== 'string' || !Number.isFinite(Date.parse(value.fetchedAt)) ||
      !record(value.overrides) || !record(value.vehicles) || !record(value.sources)) return false;
  const sources = value.sources;
  if (!LIVE_SOURCES.every((id) => typeof sources[id] === 'string' && ['ok', 'stale', 'error', 'empty'].includes(sources[id]))) return false;
  if (value.failedLocations !== undefined && (!Array.isArray(value.failedLocations) || !value.failedLocations.every((id) => typeof id === 'string'))) return false;
  return Object.values(value.vehicles).every((n) => Number.isInteger(n) && Number(n) >= 0) &&
    Object.values(value.overrides).every((list) => Array.isArray(list) && list.every((o) => {
      if (!record(o) || !dateKey(o.from) || (o.to !== undefined && (!dateKey(o.to) || o.to < o.from)) || typeof o.note !== 'string') return false;
      if (o.priority !== undefined && !Number.isFinite(o.priority)) return false;
      if (o.confidence !== undefined && (typeof o.confidence !== 'string' || !['high', 'medium', 'low'].includes(o.confidence))) return false;
      return o.hours === undefined || (typeof o.hours === 'string' && ['closed', 'unknown', 'regular'].includes(o.hours)) || dayHours(o.hours) ||
        (Array.isArray(o.hours) && o.hours.length === 7 && o.hours.every(dayHours));
    }));
}

/** Expire on server and client; discard failed live hours and annotate the static fallback. */
export function usableLive(data: LiveData, at: Date, disconnected = false): LiveData {
  const age = at.getTime() - Date.parse(data.fetchedAt);
  const expired = !Number.isFinite(age) || age < -CLOCK_SKEW_TOLERANCE_MS || age >= HOURS_MAX_AGE_MS;
  const failed = new Set(data.failedLocations ?? []);
  const sources = { ...data.sources };
  for (const [source, ids] of Object.entries(FEED_LOCATIONS)) {
    const wholeProviderFailed = sources[source] === 'error' && !ids.some((id) => failed.has(id));
    if (expired || !sources[source] || wholeProviderFailed || sources[source] === 'empty') {
      ids.forEach((id) => failed.add(id));
      sources[source] = 'error';
    }
  }
  if (disconnected) {
    for (const id of Object.keys(sources)) if (sources[id] === 'ok') sources[id] = 'stale';
  }
  const overrides = expired ? {} : { ...data.overrides };
  const key = toLocal(at).key;
  for (const id of failed) overrides[id] = [{ from: addDays(key, -1), to: addDays(key, 60), note: 'Live hours unavailable; using the verified static schedule where available. Check the official source.' }];
  const vehiclesExpired = expired || age >= VEHICLES_MAX_AGE_MS || !['ok', 'stale'].includes(sources.shuttles ?? '');
  if (vehiclesExpired) sources.shuttles = 'error';
  return { ...data, overrides, sources, failedLocations: [...failed], vehicles: vehiclesExpired ? {} : data.vehicles };
}
