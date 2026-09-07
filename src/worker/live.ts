/**
 * Live data providers. Each provider fetches an official feed and converts it into
 * date overrides (or vehicle counts) that the schedule engine layers on top of the
 * static hours. Everything is best-effort: a failing feed never breaks the page.
 */
import type { DateOverride, DayHours, Interval } from '../engine/types';
import { usableLive, type LiveData } from '../engine/live';
import { record, dateKey } from '../engine/validation';
import { calendar, locations } from '../data';
import { resolveDay } from '../engine/status';
import { sameHours } from '../engine/format';
import { addDays, toLocal } from '../engine/time';

const FETCH_TIMEOUT_MS = 6000;
const UA = 'TuftsIsItOpen/1.0 (+https://github.com/Ntrxi/TuftsIsItOpen)';

async function getJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...init,
    headers: { accept: 'application/json', 'user-agent': UA, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return await res.json();
}

/* LibCal (Tisch Library hours) ------------------------------------------- */

const LIBCAL_IID = 1412;
const LIBCAL_LOCATIONS: { lid: number; locId: string; splitLateNight?: boolean; publicUntil?: number }[] = [
  { lid: 20832, locId: 'tisch-library', splitLateNight: true },
  { lid: 20836, locId: 'tisch-dds' },
  { lid: 15418, locId: 'ginn-library', publicUntil: 1260 },
  { lid: 14360, locId: 'lilly-music-library' },
];

interface LibCalDay {
  date: string;
  times: { status: string; hours?: { from: string; to: string }[] };
  rendered?: string;
}
function libcalDays(entry: unknown): Map<string, LibCalDay> {
  if (!record(entry) || !Array.isArray(entry.weeks)) throw new Error('Invalid LibCal location');
  const days = new Map<string, LibCalDay>();
  for (const week of entry.weeks) {
    if (!record(week)) continue;
    for (const day of Object.values(week)) {
      if (!record(day) || !dateKey(day.date) || !record(day.times) ||
          typeof day.times.status !== 'string' || !['open', 'closed', '24hours', 'not-set'].includes(day.times.status)) continue;
      const times = day.times;
      if (times.status === 'open' && (!Array.isArray(times.hours) || !times.hours.length || !times.hours.every((h) =>
        record(h) && typeof h.from === 'string' && typeof h.to === 'string' &&
        parseLibCalTime(h.from) !== undefined && parseLibCalTime(h.to) !== undefined))) continue;
      if (days.has(day.date)) throw new Error('Duplicate LibCal date');
      days.set(day.date, { date: day.date, times: { status: day.times.status,
        hours: times.status === 'open' && Array.isArray(times.hours) ? times.hours.map((h: Record<string, unknown>) => ({ from: String(h.from), to: String(h.to) })) : undefined } });
    }
  }
  return days;
}

function parseLibCalTime(text: string): number | undefined {
  const s = text.trim().toLowerCase();
  if (s === 'noon') return 720;
  if (s === 'midnight') return 0;
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/.exec(s);
  if (!m || Number(m[1]) < 1 || Number(m[1]) > 12 || Number(m[2] ?? 0) > 59) return undefined;
  let h = Number(m[1]) % 12;
  if (m[3] === 'pm') h += 12;
  return h * 60 + Number(m[2] ?? 0);
}

function libcalDayHours(day: LibCalDay, splitLateNight: boolean, publicHours?: DayHours): DayHours | 'closed' | undefined {
  const status = day.times.status;
  if (status === 'closed') return 'closed';
  // Building hours do not imply public access, especially at midnight on a 24-hour day.
  const ranges = status === '24hours' ? [{ from: 'midnight', to: 'midnight' }] : status === 'open' ? day.times.hours : undefined;
  if (!ranges?.length) return undefined; // not-set etc.
  const out: DayHours = [];
  for (const h of ranges) {
    const from = parseLibCalTime(h.from);
    let to = parseLibCalTime(h.to);
    if (from === undefined || to === undefined) return undefined;
    if (to <= from) to += 1440;
    if (!splitLateNight) { out.push({ start: from, end: to }); continue; }
    const cuts = [...new Set([from, to, ...(publicHours ?? []).flatMap((p) => [p.start, p.end]).filter((n) => n > from && n < to)])].sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const start = cuts[i]!;
      const end = cuts[i + 1]!;
      const isPublic = publicHours?.some((p) => p.start <= start && p.end >= end);
      out.push({ start, end, access: publicHours === undefined ? 'unknown' : isPublic ? undefined : 'special', label: publicHours === undefined ? 'Access hours unconfirmed' : isPublic ? 'Open to public' : 'Tufts ID only · late-night study' });
    }
  }
  return out;
}

async function libcalOverrides(todayKey: string): Promise<NutrisliceResult> {
  const out: Record<string, DateOverride[]> = {};
  const failed: string[] = [];
  const url = `https://tufts.libcal.com/api_hours_grid.php?iid=${LIBCAL_IID}&format=json&weeks=3&date=${addDays(todayKey, -1)}`;
  const grid = await getJson(url);
  if (!record(grid) || !Array.isArray(grid.locations)) throw new Error('Invalid LibCal envelope');
  const entries = grid.locations;
  const readLocation = (lid: number) => {
    const matches = entries.filter((e) => record(e) && Number(e.lid) === lid);
    if (matches.length !== 1) throw new Error('Missing or duplicate LibCal location');
    return libcalDays(matches[0]);
  };
  for (const cfg of LIBCAL_LOCATIONS) {
    try {
      const days = readLocation(cfg.lid);
      let publicDays: Map<string, LibCalDay> | undefined;
      if (cfg.splitLateNight) {
        try { publicDays = readLocation(20834); } catch { /* Building hours remain usable; access is unknown. */ }
      }
      if (!days.has(todayKey) || !days.has(addDays(todayKey, -1))) throw new Error('LibCal missing current or previous date');
      out[cfg.locId] = [];
      for (const [date, day] of days) {
        if (date < addDays(todayKey, -1)) continue;
        let publicHours: DayHours | undefined;
        if (publicDays) {
          const current = publicDays.get(date);
          const next = publicDays.get(addDays(date, 1));
          const a = current && libcalDayHours(current, false);
          const b = next && libcalDayHours(next, false);
          const building = libcalDayHours(day, false);
          const overnight = Array.isArray(building) && building.some((h) => h.end > 1440);
          if (a !== undefined && (!overnight || b !== undefined)) {
            publicHours = [...(a === 'closed' ? [] : a), ...(Array.isArray(b) ? b.map((h) => ({ ...h, start: h.start + 1440, end: h.end + 1440 })) : [])];
          }
        }
        if (cfg.publicUntil !== undefined) publicHours = [{ start: 0, end: cfg.publicUntil }];
        let hours = libcalDayHours(day, cfg.splitLateNight || cfg.publicUntil !== undefined, publicHours);
        if (cfg.publicUntil !== undefined && Array.isArray(hours)) {
          hours = hours.map(({ start, end, access }) => access ? { start, end, access, label: 'Tufts ID only' } : { start, end });
        }
        if (hours === undefined) continue;
        // DDS staffed hours cannot establish access while the enclosing building is closed.
        if (cfg.locId === 'tisch-dds' && Array.isArray(hours)) {
          const buildingDay = readLocation(20832).get(date);
          const buildingHours = buildingDay && libcalDayHours(buildingDay, false);
          if (buildingHours !== undefined && hours.some((h) => buildingHours === 'closed' ||
              !buildingHours.some((b) => b.start <= h.start && b.end >= h.end))) {
            out[cfg.locId]!.push({ from: date, hours: 'unknown', note: 'Library calendars disagree: DDS desk hours extend beyond Tisch building hours. Confirm with the library.' });
            continue;
          }
          if (buildingHours === undefined) {
            out[cfg.locId]!.push({ from: date, hours: 'unknown', note: 'DDS desk hours are published, but Tisch building access is not yet confirmed.' });
            continue;
          }
        }
        const baseline = resolveDay(locations.find((loc) => loc.id === cfg.locId)!, date, calendar).hours;
        if (baseline !== 'unknown' && sameHours(hours === 'closed' ? [] : hours, baseline)) continue;
        out[cfg.locId]!.push({ from: date, hours, note: 'Hours from the library calendar' });
      }
    } catch (error) {
      failed.push(cfg.locId);
      console.warn(JSON.stringify({ event: 'live_feed_failure', provider: 'library', location: cfg.locId, reason: String(error) }));
    }
  }
  return { overrides: out, failed };
}

/* Nutrislice (Tufts Dining closures) -------------------------------------- */

/** Dining halls publish separate breakfast/lunch/dinner menus; cafés have a single menu. */
const NUTRISLICE: { slug: string; menus: string[]; locId: string }[] = [
  { slug: 'dewick-dining', menus: ['breakfast', 'lunch', 'dinner'], locId: 'dewick' },
  { slug: 'carmichael-dining-hall', menus: ['breakfast', 'lunch', 'dinner'], locId: 'carmichael' },
  { slug: 'commons-marketplace', menus: ['lunch'], locId: 'commons' },
  { slug: 'hodgdon-food-on-the-run', menus: ['lunch'], locId: 'hodgdon' },
  { slug: 'hotung-cafe', menus: ['lunch'], locId: 'hotung' },
  { slug: 'kindlevan-cafe', menus: ['daily'], locId: 'kindlevan' },
  { slug: 'mugar-cafe', menus: ['daily'], locId: 'mugar-cafe' },
  { slug: 'pax-et-lox-glatt-kosher-deli', menus: ['lunch'], locId: 'pax-et-lox' },
  { slug: 'tower-cafe', menus: ['daily'], locId: 'tower-cafe' },
  { slug: 'smfa', menus: ['lunch'], locId: 'smfa-cafe' },
];

/**
 * Shape of the weekly menu API (`/menu/api/weeks/school/…/menu-type/…/Y/M/D/`), which
 * returns every day Sunday–Saturday of the week containing the date. Closures and notices
 * are bold `is_holiday` lines; real menu entries carry a `food` object.
 *
 * The lighter "digest" endpoint is deliberately not used: it only ever returns
 * Monday–Friday, so a weekend closure (e.g. Carmichael on Sat 2026-09-05) never surfaced.
 */
interface NutrisliceItem {
  text?: string | null;
  is_holiday?: boolean;
  is_station_header?: boolean;
  is_section_title?: boolean;
  food?: unknown;
}
interface NutrisliceDay {
  date: string;
  menu_items?: NutrisliceItem[];
}
interface NutrisliceWeek {
  days?: NutrisliceDay[];
}

function parseNutrisliceWeek(value: unknown): NutrisliceWeek {
  if (!record(value) || !Array.isArray(value.days)) throw new Error('Invalid Nutrislice week');
  const dates = new Set<string>();
  for (const day of value.days) {
    if (!record(day) || !dateKey(day.date) || dates.has(day.date) || !Array.isArray(day.menu_items)) throw new Error('Invalid Nutrislice day');
    dates.add(day.date);
    for (const item of day.menu_items) {
      if (!record(item) || (item.text != null && typeof item.text !== 'string') ||
          ['is_holiday', 'is_station_header', 'is_section_title'].some((k) => item[k] !== undefined && typeof item[k] !== 'boolean') ||
          (item.food != null && !record(item.food))) throw new Error('Invalid Nutrislice item');
    }
  }
  return value as NutrisliceWeek;
}

/** What one published menu says about a day. */
interface MenuDay {
  /** Notice or closure text, if any. */
  text: string;
  /** Whether real menu entries were published. */
  hasFood: boolean;
}

const CLOSED_RE = /\b(close[ds]?|closing|closures?|holiday|break|no service|not open)\b/i;

/** Summarize one menu's day; undefined when nothing is published for it (no food and no notice). */
function readMenuDay(day: NutrisliceDay): MenuDay | undefined {
  const items = day.menu_items ?? [];
  const text = (items.find((i) => i.is_holiday && (i.text ?? '').trim())?.text ?? '').trim();
  const hasFood = items.some((i) => !i.is_holiday && i.food != null);
  return text || hasFood ? { text, hasFood } : undefined;
}

/**
 * Combine every published menu for a date into one override, or undefined when there is
 * nothing to report. The day counts as closed only when every published menu is a closure
 * notice with no food. Mixed closure/service evidence cannot establish exact opening hours.
 */
function nutrisliceDayOverride(date: string, menus: MenuDay[]): DateOverride | undefined {
  const texts = [...new Set(menus.map((m) => m.text).filter(Boolean))];
  if (!date || !texts.length) return undefined;
  const quoted = texts.map((t) => `“${t}”`).join(', ');
  const allClosed = menus.every((m) => m.text && !m.hasFood && CLOSED_RE.test(m.text));
  if (allClosed) return { from: date, hours: 'closed', note: `Closed: ${quoted} (per Tufts Dining menu)` };
  if (menus.some((m) => !m.hasFood && CLOSED_RE.test(m.text))) return { from: date, hours: 'unknown', note: `Dining service differs by meal; confirm hours: ${quoted}` };
  return { from: date, note: `Tufts Dining notice: ${quoted}` };
}

interface NutrisliceResult {
  overrides: Record<string, DateOverride[]>;
  /** Location ids for which at least one menu request failed, so "no closure found" cannot be trusted. */
  failed: string[];
}

async function nutrisliceOverrides(todayKey: string): Promise<NutrisliceResult> {
  const out: Record<string, DateOverride[]> = {};
  const failed = new Set<string>();
  // Each call covers Sun–Sat of the week containing the date, so two calls span today through next week.
  const weeks = [todayKey, addDays(todayKey, 7)];
  await Promise.all(
    NUTRISLICE.map(async (cfg) => {
      const byDate = new Map<string, MenuDay[]>();
      await Promise.all(
        cfg.menus.flatMap((menu) =>
          weeks.map(async (weekKey) => {
            const [y, m, d] = weekKey.split('-');
            const url = `https://tufts.api.nutrislice.com/menu/api/weeks/school/${cfg.slug}/menu-type/${menu}/${y}/${m}/${d}/`;
            let week: NutrisliceWeek;
            try {
              week = parseNutrisliceWeek(await getJson(url));
            } catch (error) {
              console.warn(JSON.stringify({ event: 'live_feed_failure', provider: 'dining', location: cfg.locId, menu, week: weekKey, reason: String(error) }));
              failed.add(cfg.locId);
              return;
            }
            for (const day of week.days ?? []) {
              if (!day?.date || day.date < todayKey) continue;
              const summary = readMenuDay(day);
              if (summary) byDate.set(day.date, [...(byDate.get(day.date) ?? []), summary]);
            }
          }),
        ),
      );
      if (failed.has(cfg.locId)) return;
      const overrides = [...byDate]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, menus]) => nutrisliceDayOverride(date, menus))
        .filter((o): o is DateOverride => o !== undefined);
      if (overrides.length) out[cfg.locId] = overrides;
    }),
  );
  return { overrides: out, failed: [...failed] };
}

/* Passio GO (shuttle vehicles) -------------------------------------------- */

const PASSIO_SYSTEM = '6670';
const ROUTE_TO_LOC: Record<string, string> = {
  '63771': 'davis-shuttle', // Davis All Stops
  '75069': 'davis-shuttle', // Davis Direct
  '66894': 'smfa-connected',
  '66896': 'smfa-connected',
  '65595': 'smfa-connected', // SMFA After 7PM
  '66903': 'smfa-connected',
  '63773': 'smfa-connected', // SMFA Weekend
  '63775': 'grocery-shuttle', // Tufts Shoppers Shuttle
};

async function passioVehicles(): Promise<Record<string, number>> {
  const json = await getJson('https://passiogo.com/mapGetData.php?getBuses=1&deviceId=1', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ s0: PASSIO_SYSTEM, sA: 1 }),
  });
  if (!record(json) || (!record(json.buses) && !Array.isArray(json.buses))) throw new Error('Invalid Passio buses');
  const counts: Record<string, number> = {};
  const seen = new Set<string>();
  for (const id of new Set(Object.values(ROUTE_TO_LOC))) counts[id] = 0;
  let valid = 0;
  let invalid = 0;
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if ('routeId' in obj || 'busId' in obj) {
        if (!['string', 'number'].includes(typeof obj.routeId) || !['string', 'number'].includes(typeof obj.busId)) { invalid++; return; }
        if (obj.outOfService !== undefined && !['0', '1'].includes(String(obj.outOfService))) { invalid++; return; }
        if (obj.outdated !== undefined && !['0', '1'].includes(String(obj.outdated))) { invalid++; return; }
        valid++;
        if (String(obj.outOfService ?? '0') === '1') return;
        if (String(obj.outdated ?? '0') === '1' || seen.has(String(obj.busId))) return;
        seen.add(String(obj.busId));
        const locId = ROUTE_TO_LOC[String(obj.routeId ?? '')];
        if (locId) counts[locId] = (counts[locId] ?? 0) + 1;
        return;
      }
      Object.values(obj).forEach(walk);
    } else {
      invalid++;
    }
  };
  walk(json.buses ?? {});
  if (invalid && !valid) throw new Error('No readable Passio vehicles');
  return counts;
}

/* Assembly ---------------------------------------------------------------- */

/** Failed feeds fall back to static schedules; old live closures/openings are discarded. */
export async function fetchAllLive(now: Date): Promise<LiveData> {
  const todayKey = toLocal(now).key;
  const [lib, nutri, passio] = await Promise.allSettled([libcalOverrides(todayKey), nutrisliceOverrides(todayKey), passioVehicles()]);
  const overrides: Record<string, DateOverride[]> = {};
  const sources: LiveData['sources'] = {};
  const failedLocations: string[] = [];
  for (const [provider, result] of [['library', lib], ['dining', nutri]] as const) {
    if (result.status === 'fulfilled') {
      Object.assign(overrides, result.value.overrides);
      failedLocations.push(...result.value.failed);
      sources[provider] = result.value.failed.length ? 'error' : 'ok';
    } else {
      sources[provider] = 'error';
      console.warn(JSON.stringify({ event: 'live_feed_failure', provider, reason: String(result.reason) }));
    }
  }
  const vehicles = passio.status === 'fulfilled' ? passio.value : {};
  sources.shuttles = passio.status === 'fulfilled' ? 'ok' : 'error';
  if (passio.status === 'rejected') console.warn(JSON.stringify({ event: 'live_feed_failure', provider: 'shuttles', reason: String(passio.reason) }));
  return usableLive({ fetchedAt: now.toISOString(), overrides, vehicles, sources, failedLocations }, now);
}

/** Exposed for tests. */
export const _internal = { parseLibCalTime, libcalDayHours, CLOSED_RE, readMenuDay, nutrisliceDayOverride, parseNutrisliceWeek, libcalDays, LIBCAL_LOCATIONS, NUTRISLICE };
export type { Interval };
