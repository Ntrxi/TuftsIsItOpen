import { calendar, locations } from '../data';
import { computeAll } from '../engine/status';
import { EMPTY_LIVE, type LiveData } from '../engine/live';
import { cardParts, OPEN_STATES, renderClock } from '../render/render';
import type { AnalyticsEvent } from '../engine/analytics';
import type { State } from '../engine/types';

declare global {
  interface Window {
    __LIVE__?: LiveData;
    __RENDERED_AT__?: string;
  }
}

const TICK_MS = 30_000;
const LIVE_POLL_MS = 120_000;
const LS_PINNED = 'iio:pinned';
const LS_CAT = 'iio:cat';
/** Wait for typing to settle before counting a search. */
const SEARCH_TRACK_MS = 1_000;

const byId = new Map(locations.map((l) => [l.id, l]));
let live: LiveData = window.__LIVE__ ?? EMPTY_LIVE;
let pinned = new Set<string>(readJson<string[]>(LS_PINNED) ?? []);
let cat = readJson<string>(LS_CAT) ?? 'all';
let query = '';
let openOnly = false;

function readJson<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : undefined;
  } catch {
    return undefined;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode etc. */
  }
}

const $ = <T extends Element>(sel: string, root: ParentNode = document): T | null => root.querySelector<T>(sel);
const $$ = <T extends Element>(sel: string, root: ParentNode = document): T[] => Array.from(root.querySelectorAll<T>(sel));

/* Analytics -------------------------------------------------------------- */

/**
 * Fire-and-forget custom event to the Worker, which validates it and writes a
 * Workers Analytics Engine data point. No PII: ids/categories are from our own
 * dataset and search text never leaves the browser (only its length and hit count).
 */
function track(event: AnalyticsEvent): void {
  try {
    const body = JSON.stringify(event);
    if (!navigator.sendBeacon?.('/api/event', body)) {
      void fetch('/api/event', { method: 'POST', body, keepalive: true }).catch(() => undefined);
    }
  } catch {
    /* analytics must never break the page */
  }
}

/* Rendering --------------------------------------------------------------- */

function refresh(): void {
  const now = new Date();
  const statuses = computeAll(locations, calendar, now, live.overrides);
  for (const st of statuses) {
    const card = document.getElementById(`loc-${st.id}`);
    const loc = byId.get(st.id);
    if (!card || !loc) continue;
    const parts = cardParts(loc, st, live);
    const head = $('.card-head', card);
    const body = $('.card-body', card);
    if (head) head.innerHTML = parts.head;
    if (body) body.innerHTML = parts.body;
    card.dataset.state = parts.state;
    syncPinButton(card);
  }
  const clock = document.getElementById('clock');
  if (clock) clock.innerHTML = renderClock(now, calendar);
  applyFilters();
}

function syncPinButton(card: Element): void {
  const id = (card as HTMLElement).dataset.id ?? '';
  const btn = $<HTMLButtonElement>('.pin', card);
  if (btn) btn.setAttribute('aria-pressed', pinned.has(id) ? 'true' : 'false');
}

/* Pinning ----------------------------------------------------------------- */

function placePinned(): void {
  const pinnedGroup = $<HTMLElement>('.group[data-group="pinned"]');
  const pinnedCards = pinnedGroup ? $('.cards', pinnedGroup) : null;
  if (!pinnedGroup || !pinnedCards) return;
  // Move pinned cards up, and unpinned cards back to their category group (in original order).
  for (const card of $$<HTMLElement>('.card')) {
    const id = card.dataset.id ?? '';
    const loc = byId.get(id);
    if (!loc) continue;
    const wantGroup = pinned.has(id) ? 'pinned' : loc.category;
    const currentGroup = card.closest<HTMLElement>('.group')?.dataset.group;
    if (wantGroup !== currentGroup) {
      const target = $<HTMLElement>(`.group[data-group="${wantGroup}"] .cards`);
      if (!target) continue;
      if (wantGroup === 'pinned') {
        target.appendChild(card);
      } else {
        // Reinsert in dataset order.
        const order = locations.filter((l) => l.category === loc.category).map((l) => l.id);
        const myIndex = order.indexOf(id);
        const next = Array.from(target.children).find((c) => order.indexOf((c as HTMLElement).dataset.id ?? '') > myIndex);
        target.insertBefore(card, next ?? null);
      }
    }
    syncPinButton(card);
  }
  pinnedGroup.hidden = pinned.size === 0;
}

function togglePin(id: string): void {
  if (pinned.has(id)) pinned.delete(id);
  else pinned.add(id);
  writeJson(LS_PINNED, Array.from(pinned));
  placePinned();
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
    const isPinnedGroup = group.dataset.group === 'pinned';
    group.hidden = groupVisible === 0 || (isPinnedGroup && pinned.size === 0);
    visible += groupVisible;
  }
  const empty = document.getElementById('empty');
  if (empty) empty.hidden = visible > 0;
  const list = document.getElementById('list');
  if (list) list.dataset.cat = cat;
  return visible;
}

/* Live data --------------------------------------------------------------- */

async function pollLive(): Promise<void> {
  try {
    const res = await fetch('/api/live', { headers: { accept: 'application/json' } });
    if (!res.ok) return;
    const data = (await res.json()) as LiveData;
    if (data && typeof data === 'object' && data.overrides) {
      live = data;
      refresh();
    }
  } catch {
    /* offline: keep using the last data */
  }
}

/* Wiring ------------------------------------------------------------------ */

function init(): void {
  const q = document.getElementById('q') as HTMLInputElement | null;
  const openBtn = document.getElementById('open-only');
  const filters = $$<HTMLButtonElement>('.filter');

  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let trackedQuery = '';
  q?.addEventListener('input', () => {
    query = q.value.trim().toLowerCase();
    applyFilters();
    clearTimeout(searchTimer);
    if (!query) trackedQuery = '';
    if (query && query !== trackedQuery) {
      searchTimer = setTimeout(() => {
        trackedQuery = query;
        track({ type: 'search', length: query.length, results: applyFilters() });
      }, SEARCH_TRACK_MS);
    }
  });
  q?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      clearTimeout(searchTimer);
      trackedQuery = '';
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
    track({ type: 'filter', key: 'open_only', on: openOnly });
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
      track({ type: 'filter', key: 'category', value: cat });
      f.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    });
    if ((f.dataset.cat ?? 'all') === cat) {
      for (const other of filters) {
        other.classList.toggle('is-active', other === f);
        other.setAttribute('aria-pressed', other === f ? 'true' : 'false');
      }
    }
  }

  // Pin buttons live inside <summary>; stop the click from toggling the card.
  document.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('.pin');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const card = btn.closest<HTMLElement>('.card');
    if (card?.dataset.id) togglePin(card.dataset.id);
  });

  // A card expanding (tap or deep link) counts as a location view. `toggle` does not bubble, so capture it.
  document.addEventListener(
    'toggle',
    (e) => {
      const card = e.target as HTMLDetailsElement;
      if (card.open && card.classList.contains('card') && card.dataset.id) track({ type: 'location_view', id: card.dataset.id });
    },
    true,
  );

  // Deep link: /#loc-dewick opens that card.
  if (location.hash.startsWith('#loc-')) {
    const card = document.getElementById(location.hash.slice(1)) as HTMLDetailsElement | null;
    if (card) {
      card.open = true;
      card.scrollIntoView({ block: 'center' });
    }
  }

  placePinned();
  refresh();

  // Keep statuses current: every 30s, when the tab becomes visible, and after the device wakes.
  setInterval(refresh, TICK_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refresh();
      void pollLive();
    }
  });
  window.addEventListener('focus', refresh);
  window.addEventListener('online', () => void pollLive());
  setInterval(() => void pollLive(), LIVE_POLL_MS);

  // If the server-rendered snapshot is old (cached), pull fresh live data now.
  const renderedAt = window.__RENDERED_AT__ ? Date.parse(window.__RENDERED_AT__) : 0;
  if (!renderedAt || Date.now() - renderedAt > 60_000) void pollLive();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
