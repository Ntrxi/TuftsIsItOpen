/**
 * Live data providers. Each provider fetches an official feed and converts it into
 * date overrides (or vehicle counts) that the schedule engine layers on top of the
 * static hours. Everything is best-effort: a failing feed never breaks the page.
 */
import type { DateOverride, DayHours, Interval } from '../engine/types';
import type { LiveData } from '../engine/live';
import { calendar, locations } from '../data';
import { resolveDay } from '../engine/status';
import { mergeContiguous, sameHours } from '../engine/format';
import { addDays, toLocal } from '../engine/time';

const FETCH_TIMEOUT_MS = 6000;
const UA = 'TuftsIsItOpen/1.0 (+https://github.com/Ntrxi/TuftsIsItOpen)';

async function getJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { accept: 'application/json', 'user-agent': UA, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return (await res.json()) as T;
}

/* LibCal (Tisch Library hours) ------------------------------------------- */

const LIBCAL_IID = 1412;
const PUBLIC_END = 21 * 60;
const LIBCAL_LOCATIONS: { lid: number; locId: string; splitLateNight?: boolean }[] = [
  { lid: 20832, locId: 'tisch-library', splitLateNight: true },
  { lid: 20836, locId: 'tisch-dds' },
  { lid: 15418, locId: 'ginn-library' },
  { lid: 14360, locId: 'lilly-music-library' },
];

interface LibCalDay {
  date: string;
  times: { status: string; hours?: { from: string; to: string }[] };
  rendered?: string;
}
type LibCalGrid = Record<string, { weeks: Record<string, LibCalDay>[] }>;

function parseLibCalTime(text: string): number | undefined {
  const s = text.trim().toLowerCase();
  if (s === 'noon') return 720;
  if (s === 'midnight') return 0;
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/.exec(s);
  if (!m) return undefined;
  let h = Number(m[1]) % 12;
  if (m[3] === 'pm') h += 12;
  return h * 60 + Number(m[2] ?? 0);
}

function libcalDayHours(day: LibCalDay, splitLateNight: boolean): DayHours | 'closed' | undefined {
  const status = day.times.status;
  if (status === 'closed') return 'closed';
  if (status === '24hours') return [{ start: 0, end: 1440 }];
  if (status !== 'open' || !day.times.hours?.length) return undefined; // not-set etc.
  const out: DayHours = [];
  for (const h of day.times.hours) {
    const from = parseLibCalTime(h.from);
    let to = parseLibCalTime(h.to);
    if (from === undefined || to === undefined) return undefined;
    if (to <= from) to += 1440;
    if (splitLateNight && from < PUBLIC_END && to > PUBLIC_END) {
      out.push({ start: from, end: PUBLIC_END, label: 'Open to public' }, { start: PUBLIC_END, end: to, label: 'Tufts ID only · late-night study' });
    } else {
      out.push({ start: from, end: to });
    }
  }
  return out;
}

async function libcalOverrides(todayKey: string): Promise<Record<string, DateOverride[]>> {
  const out: Record<string, DateOverride[]> = {};
  const url = `https://tufts.libcal.com/api_hours_grid.php?iid=${LIBCAL_IID}&format=json&weeks=3&date=${todayKey}`;
  const grid = await getJson<LibCalGrid>(url);
  for (const cfg of LIBCAL_LOCATIONS) {
    const entry = grid[`loc_${cfg.lid}`];
    const loc = locations.find((l) => l.id === cfg.locId);
    if (!entry || !loc) continue;
    const overrides: DateOverride[] = [];
    for (const week of entry.weeks) {
      for (const day of Object.values(week)) {
        if (!day?.date || day.date < addDays(todayKey, -1)) continue;
        const hours = libcalDayHours(day, cfg.splitLateNight ?? false);
        if (hours === undefined) continue;
        // Only override when the feed disagrees with the static schedule, so labels/notes survive.
        const staticDay = resolveDay(loc, day.date, calendar);
        const staticHours = staticDay.hours === 'unknown' ? undefined : mergeContiguous(staticDay.hours);
        const liveHours = hours === 'closed' ? [] : mergeContiguous(hours);
        if (staticHours && sameHours(staticHours, liveHours)) continue;
        overrides.push({
          from: day.date,
          hours: hours === 'closed' ? 'closed' : hours,
          note: hours === 'closed' ? 'Closed (per library calendar)' : 'Hours from the library calendar',
        });
      }
    }
    if (overrides.length) out[cfg.locId] = overrides;
  }
  return out;
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

/** What one published menu says about a day. */
interface MenuDay {
  /** Notice or closure text, if any. */
  text: string;
  /** Whether real menu entries were published. */
  hasFood: boolean;
}

const CLOSED_RE = /\b(clos|holiday|break|no service|not open)/i;

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
 * notice with no food; a closure on some meals (e.g. "dinner closed for the food fair") keeps
 * the scheduled hours and shows the text as a notice instead.
 */
function nutrisliceDayOverride(date: string, menus: MenuDay[]): DateOverride | undefined {
  const texts = [...new Set(menus.map((m) => m.text).filter(Boolean))];
  if (!date || !texts.length) return undefined;
  const quoted = texts.map((t) => `“${t}”`).join(', ');
  const allClosed = menus.every((m) => m.text && !m.hasFood && CLOSED_RE.test(m.text));
  if (allClosed) return { from: date, hours: 'closed', note: `Closed: ${quoted} (per Tufts Dining menu)` };
  return { from: date, note: `Tufts Dining notice: ${quoted}` };
}

async function nutrisliceOverrides(todayKey: string): Promise<Record<string, DateOverride[]>> {
  const out: Record<string, DateOverride[]> = {};
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
              week = await getJson<NutrisliceWeek>(url);
            } catch {
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
      const overrides = [...byDate]
        .sort(([a], [b]) => (a < b ? -1 : 1))
        .map(([date, menus]) => nutrisliceDayOverride(date, menus))
        .filter((o): o is DateOverride => o !== undefined);
      if (overrides.length) out[cfg.locId] = overrides;
    }),
  );
  return out;
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
  const json = await getJson<{ buses?: Record<string, unknown> }>('https://passiogo.com/mapGetData.php?getBuses=1&deviceId=1', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ s0: PASSIO_SYSTEM, sA: 1 }),
  });
  const counts: Record<string, number> = {};
  for (const id of new Set(Object.values(ROUTE_TO_LOC))) counts[id] = 0;
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if ('routeId' in obj || 'busId' in obj) {
        if (String(obj.outOfService ?? '0') === '1') return;
        const locId = ROUTE_TO_LOC[String(obj.routeId ?? '')];
        if (locId) counts[locId] = (counts[locId] ?? 0) + 1;
        return;
      }
      Object.values(obj).forEach(walk);
    }
  };
  walk(json.buses ?? {});
  return counts;
}

/* Assembly ---------------------------------------------------------------- */

export interface ProviderResult {
  overrides: Record<string, DateOverride[]>;
  vehicles: Record<string, number>;
  sources: LiveData['sources'];
}

export async function fetchAllLive(now: Date): Promise<LiveData> {
  const todayKey = toLocal(now).key;
  const [lib, nutri, passio] = await Promise.allSettled([libcalOverrides(todayKey), nutrisliceOverrides(todayKey), passioVehicles()]);
  const overrides: Record<string, DateOverride[]> = {};
  const sources: LiveData['sources'] = {};

  if (lib.status === 'fulfilled') {
    Object.assign(overrides, lib.value);
    sources.library = 'ok';
  } else sources.library = 'error';

  if (nutri.status === 'fulfilled') {
    for (const [id, list] of Object.entries(nutri.value)) {
      overrides[id] = [...(overrides[id] ?? []), ...list];
    }
    sources.dining = 'ok';
  } else sources.dining = 'error';

  let vehicles: Record<string, number> = {};
  if (passio.status === 'fulfilled') {
    vehicles = passio.value;
    sources.shuttles = 'ok';
  } else sources.shuttles = 'error';

  return { fetchedAt: now.toISOString(), overrides, vehicles, sources };
}

/** Exposed for tests. */
export const _internal = { parseLibCalTime, libcalDayHours, CLOSED_RE, readMenuDay, nutrisliceDayOverride };
export type { Interval };
