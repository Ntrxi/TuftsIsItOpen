import { calendar, locations } from '../data';
import { computeAll } from '../engine/status';
import { CLOCK_SKEW_TOLERANCE_MS, EMPTY_LIVE, isLiveData, usableLive, type LiveData } from '../engine/live';
import { updateHTML } from './update';
import { cardParts, OPEN_STATES, renderClock } from '../render/render';
import type { State } from '../engine/types';

const TICK_MS = 30_000;
const LIVE_POLL_MS = 120_000;
const LS_CAT = 'iio:cat';

const byId = new Map(locations.map((l) => [l.id, l]));
const categories = new Set(['all', ...locations.map((l) => l.category)]);
let live: LiveData = EMPTY_LIVE;
/**
 * False until the first /api/live request has succeeded or failed. The static page carries no live
 * data, so the first render uses the scheduled hours alone; the "live hours unavailable" annotations
 * only apply once a request has actually failed, not while the first one is still in flight.
 */
let liveSettled = false;
let disconnected = !navigator.onLine;
let cat = readCategory();
let query = '';
let openOnly = false;

/* Clock ------------------------------------------------------------------- */

/**
 * Statuses are computed on the device, so a wrong device clock would show the wrong answer.
 * The Date header of live responses corrects it. It may come from a cache up to ~60 s old,
 * so only a clearly larger skew is applied.
 */
const SKEW_THRESHOLD_MS = CLOCK_SKEW_TOLERANCE_MS;
let clockSkewMs = 0;

function noteServerTime(iso: string | null | undefined): void {
  const server = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(server)) return;
  const skew = server - Date.now();
  clockSkewMs = Math.abs(skew) > SKEW_THRESHOLD_MS ? skew : 0;
}

/** The current instant, on the server's clock. */
const now = (): Date => new Date(Date.now() + clockSkewMs);

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    removeStored(key);
    return undefined;
  }
}

function removeStored(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* private mode etc. */
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode etc. */
  }
}

function readCategory(): string {
  const value = readJson(LS_CAT);
  if (typeof value === 'string' && categories.has(value)) return value;
  if (value !== undefined) removeStored(LS_CAT);
  return 'all';
}

const $ = <T extends Element>(sel: string, root: ParentNode = document): T | null => root.querySelector<T>(sel);
const $$ = <T extends Element>(sel: string, root: ParentNode = document): T[] => Array.from(root.querySelectorAll<T>(sel));

/* Rendering --------------------------------------------------------------- */

function refresh(): void {
  const at = now();
  const clock = document.getElementById('clock');
  if (clock) clock.innerHTML = renderClock(at, calendar);
  const current = liveSettled ? usableLive(live, at, disconnected) : EMPTY_LIVE;
  const statuses = computeAll(locations, calendar, at, current.overrides);
  for (const st of statuses) {
    const card = document.getElementById(`loc-${st.id}`);
    const loc = byId.get(st.id);
    if (!card || !loc) continue;
    const parts = cardParts(loc, st, current);
    const head = $('.card-head', card);
    const body = $('.card-body', card);
    if (head) updateHTML(head, parts.head);
    if (body) updateHTML(body, parts.body);
    card.dataset.state = parts.state;
  }
  const health = document.getElementById('live-sources');
  const healthText = liveSettled ? ` (${Object.entries(current.sources).map(([id, state]) => `${id}: ${state}`).join(', ')})` : ' (loading live feeds…)';
  if (health && health.textContent !== healthText) health.textContent = healthText;
  applyFilters();
}

/* Filtering --------------------------------------------------------------- */

function matches(card: HTMLElement): boolean {
  const state = (card.dataset.state ?? 'unknown') as State;
  if (openOnly && !OPEN_STATES.includes(state)) return false;
  if (cat !== 'all' && card.dataset.cat !== cat) return false;
  if (query) {
    const hay = card.dataset.search ?? '';
    return query.split(/\s+/).every((word) => hay.includes(word));
  }
  return true;
}

function applyFilters(): number {
  let visible = 0;
  for (const group of $$<HTMLElement>('.group')) {
    let groupVisible = 0;
    for (const card of $$<HTMLElement>('.card', group)) {
      const show = matches(card);
      card.hidden = !show;
      if (show) groupVisible++;
    }
    group.hidden = groupVisible === 0;
    visible += groupVisible;
  }
  const empty = document.getElementById('empty');
  if (empty) empty.hidden = visible > 0;
  const list = document.getElementById('list');
  if (list) list.dataset.cat = cat;
  return visible;
}

/* Live data --------------------------------------------------------------- */

let pollTimer: ReturnType<typeof setTimeout> | undefined;
let polling = false;
let lastSuccess = 0;
let lastAttempt = -Infinity;
const canPoll = (): boolean => document.visibilityState === 'visible' && navigator.onLine;

function schedulePoll(): void {
  clearTimeout(pollTimer);
  if (!canPoll() || polling) return;
  const due = Math.max(lastSuccess, lastAttempt) + LIVE_POLL_MS;
  pollTimer = setTimeout(() => void pollLive(), Math.max(0, due - Date.now()));
}

async function pollLive(force = false): Promise<void> {
  if (!canPoll() || polling) return;
  if (!force && Date.now() - Math.max(lastSuccess, lastAttempt) < LIVE_POLL_MS) {
    schedulePoll();
    return;
  }
  clearTimeout(pollTimer);
  polling = true;
  lastAttempt = Date.now();
  // AbortController rather than AbortSignal.timeout: the latter is missing in older mobile browsers.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch('/api/live', { headers: { accept: 'application/json' }, signal: controller.signal });
    if (!res.ok) throw new Error('Live request failed');
    noteServerTime(res.headers.get('date'));
    const data: unknown = await res.json();
    if (!isLiveData(data)) throw new Error('Invalid live response');
    live = data;
    disconnected = !navigator.onLine;
    lastSuccess = Date.now();
  } catch {
    disconnected = true;
  } finally {
    clearTimeout(timeout);
  }
  polling = false;
  liveSettled = true;
  refresh();
  schedulePoll();
}

/* Wiring ------------------------------------------------------------------ */

function init(): void {
  const q = document.getElementById('q') as HTMLInputElement | null;
  const openBtn = document.getElementById('open-only');
  const filters = $$<HTMLButtonElement>('.filter');

  q?.addEventListener('input', () => {
    query = q.value.trim().toLowerCase();
    applyFilters();
  });
  q?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      q.value = '';
      query = '';
      applyFilters();
      q.blur();
    }
  });

  openBtn?.addEventListener('click', () => {
    openOnly = !openOnly;
    openBtn.setAttribute('aria-pressed', openOnly ? 'true' : 'false');
    applyFilters();
  });

  for (const f of filters) {
    f.addEventListener('click', () => {
      if (cat === (f.dataset.cat ?? 'all')) return;
      cat = f.dataset.cat ?? 'all';
      writeJson(LS_CAT, cat);
      for (const other of filters) {
        const active = other === f;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-pressed', active ? 'true' : 'false');
      }
      applyFilters();
      f.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    });
    if ((f.dataset.cat ?? 'all') === cat) {
      for (const other of filters) {
        other.classList.toggle('is-active', other === f);
        other.setAttribute('aria-pressed', other === f ? 'true' : 'false');
      }
    }
  }

  // Deep link: /#loc-dewick opens that card.
  if (location.hash.startsWith('#loc-')) {
    const card = document.getElementById(location.hash.slice(1)) as HTMLDetailsElement | null;
    if (card) {
      card.open = true;
      card.scrollIntoView({ block: 'center' });
    }
  }

  // Scheduled hours render at once from the bundled dataset; live overrides are patched in below.
  // Offline, the scheduled hours are all there is, so the live annotations apply straight away.
  liveSettled = !navigator.onLine;
  refresh();

  // Keep statuses current: every 30s, when the tab becomes visible, and after the device wakes.
  setInterval(refresh, TICK_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refresh();
      void pollLive();
    } else {
      clearTimeout(pollTimer);
    }
  });
  window.addEventListener('focus', refresh);
  window.addEventListener('online', () => void pollLive(true));
  window.addEventListener('offline', () => {
    clearTimeout(pollTimer);
    disconnected = true;
    refresh();
  });

  // Fetch the live snapshot in parallel with the first render.
  if (navigator.onLine) void pollLive(true);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
