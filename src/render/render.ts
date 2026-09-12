import type { Category, Location, State, Status } from '../engine/types';
import type { LiveData } from '../engine/live';
import { CATEGORY_META, CATEGORY_ORDER } from '../data';
import { calendarContext } from '../engine/status';
import { toLocal, TZ } from '../engine/time';
import { fmtTime } from '../engine/format';
import type { Calendar } from '../engine/types';

export function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** States that count as "available now" for the Open-now filter. */
export const OPEN_STATES: State[] = ['open', 'closing_soon', 'running', 'appointment', 'special'];

const STATE_ICON: Record<State, string> = {
  open: '',
  closing_soon: '',
  opening_soon: '',
  closed: '',
  running: '',
  not_running: '',
  appointment: '',
  special: '',
  varies: '',
  unknown: '',
};
void STATE_ICON;

export function renderClock(at: Date, cal: Calendar): string {
  const local = toLocal(at);
  const dateText = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' }).format(at);
  const ctx = calendarContext(cal, at);
  return `<time datetime="${at.toISOString()}">${esc(dateText)} · ${fmtTime(local.minutes)}</time><span class="ctx ctx-${ctx.kind}">${esc(ctx.label)}</span>`;
}

function chips(loc: Location, st: Status): string {
  const out: string[] = [];
  if (st.isSpecial && st.state !== 'unknown') {
    out.push(`<span class="chip chip-special"${st.scheduleNote ? ` title="${esc(st.scheduleNote)}"` : ''}>Special hours</span>`);
  }
  if (loc.confidence === 'low') {
    out.push('<span class="chip chip-low" title="Hours could not be verified against a current official source">Unverified</span>');
  } else if (loc.confidence === 'medium' && st.state !== 'unknown') {
    out.push('<span class="chip chip-medium" title="Hours vary or the official sources disagree; confirm before a special trip">Confirm hours</span>');
  } else if (st.unconfirmed?.length && st.state !== 'unknown') {
    out.push(`<span class="chip chip-medium" title="Unconfirmed today: ${esc(st.unconfirmed.join(', '))}">Confirm hours</span>`);
  }
  return out.join('');
}

/**
 * The shuttle count chip. Counts are only called "live" while the shuttle source is fresh (`ok`);
 * a retained count from a stale snapshot (refresh in flight, or the device is offline) is shown as
 * the last count seen so old data is never presented as current tracking.
 */
export function vehicleChip(vehicles: number | undefined, source: LiveData['sources'][string] | undefined): string {
  if (vehicles === undefined || (source !== 'ok' && source !== 'stale')) return '';
  const buses = vehicles === 0 ? 'no buses' : vehicles === 1 ? '1 bus' : `${vehicles} buses`;
  if (source === 'ok') {
    return `<span class="chip chip-live" title="Vehicles reporting on the live tracker">${vehicles === 0 ? 'No bus tracking' : `${buses} live`}</span>`;
  }
  return `<span class="chip chip-stale" title="Last count from the live tracker; the feed has not refreshed recently">Last seen: ${buses}</span>`;
}

function headInner(loc: Location, st: Status, live: LiveData): string {
  const liveChip = loc.category === 'transit' ? vehicleChip(live.vehicles[loc.id], live.sources.shuttles) : '';
  const period = st.period ? `<span class="period">${esc(st.period)}${st.periodEnds ? ` until ${esc(st.periodEnds)}` : ''}</span>` : '';
  const departures =
    st.nextDepartures && (st.state === 'running' || st.state === 'opening_soon')
      ? `<span class="departs">Next: ${st.nextDepartures
          .slice(0, 2)
          .map((d) => `${esc(d.stop)} ${esc(d.time)}${d.inMinutes <= 60 ? ` <em>(${d.inMinutes <= 1 ? 'now' : `${d.inMinutes} min`})</em>` : ''}`)
          .join(' · ')}</span>`
      : '';
  return `
    <span class="dot" aria-hidden="true"></span>
    <span class="card-main">
      <span class="card-name">${esc(loc.name)}</span>
      <span class="card-status"><span class="state">${esc(st.label)}</span><span class="detail">${esc(st.detail)}</span>${period}${chips(loc, st)}${liveChip}</span>
      ${departures}
    </span>
    <span class="chev" aria-hidden="true"></span>
    <button class="pin" type="button" aria-label="Pin ${esc(loc.name)} to top" aria-pressed="false" title="Pin to top">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
    </button>`;
}

function bodyInner(loc: Location, st: Status): string {
  const left: string[] = [];
  const parts: string[] = [];
  if (loc.description) left.push(`<p class="desc">${esc(loc.description)}</p>`);
  if (loc.building) left.push(`<p class="where">${esc(loc.building)}</p>`);

  left.push(
    `<div class="today"><span class="k">Today</span><span class="v">${esc(st.today)}</span>${
      st.scheduleNote ? `<span class="note">${esc(st.scheduleNote)}</span>` : ''
    }</div>`,
  );
  if (st.todayPeriods.length) {
    left.push(`<ul class="periods">${st.todayPeriods.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`);
  }
  if (st.nextDepartures) {
    left.push(
      `<div class="departures"><span class="k">Next departures</span><ul>${st.nextDepartures
        .map((d) => `<li><span>${esc(d.stop)}</span><strong>${esc(d.time)}</strong></li>`)
        .join('')}</ul></div>`,
    );
  }
  if (loc.transit?.stops?.length) {
    left.push(`<p class="stops"><span class="k">Stops</span>${esc(loc.transit.stops.join(' → '))}</p>`);
  }
  parts.push(
    `<table class="week"><tbody>${st.week
      .map((l) => `<tr${l.isToday ? ' class="is-today"' : ''}><th scope="row">${esc(l.days)}</th><td>${esc(l.text)}</td></tr>`)
      .join('')}</tbody></table>`,
  );
  if (loc.note) parts.push(`<p class="fine">${esc(loc.note)}</p>`);
  if (loc.afterHours) parts.push(`<p class="after"><span class="k">After hours</span>${esc(loc.afterHours)}</p>`);

  parts.push(linksInner(loc));
  if (loc.verified) parts.push(`<p class="meta">Hours checked ${esc(fmtVerified(loc.verified))}</p>`);
  return `<div class="col">${left.join('')}</div><div class="col">${parts.join('')}</div>`;
}

function linksInner(loc: Location): string {
  const links: string[] = [];
  if (loc.links.menu) links.push(`<a href="${esc(loc.links.menu)}" target="_blank" rel="noopener">Menu</a>`);
  if (loc.links.tracker) links.push(`<a href="${esc(loc.links.tracker)}" target="_blank" rel="noopener">Live tracker</a>`);
  if (loc.links.schedule && loc.links.schedule !== loc.links.source) {
    links.push(`<a href="${esc(loc.links.schedule)}" target="_blank" rel="noopener">${loc.category === 'transit' ? 'Schedule' : loc.category === 'health' ? 'Book' : 'Calendar'}</a>`);
  }
  links.push(`<a href="${esc(loc.links.source)}" target="_blank" rel="noopener">Official page</a>`);
  return `<div class="links">${links.join('')}</div>`;
}

function fmtVerified(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}, ${y}`;
}

export interface CardParts {
  head: string;
  body: string;
  state: State;
}

export function cardParts(loc: Location, st: Status, live: LiveData): CardParts {
  return { head: headInner(loc, st, live), body: bodyInner(loc, st), state: st.state };
}

export function renderCard(loc: Location, st: Status, live: LiveData): string {
  const search = `${loc.name} ${loc.building ?? ''} ${CATEGORY_META[loc.category].label}`.toLowerCase();
  return `<details class="card" id="loc-${esc(loc.id)}" data-id="${esc(loc.id)}" data-cat="${loc.category}" data-state="${st.state}" data-search="${esc(search)}">
  <summary class="card-head">${headInner(loc, st, live)}</summary>
  <div class="card-body">${bodyInner(loc, st)}</div>
</details>`;
}

/**
 * A card with no status yet: the static page ships every card like this, and the browser fills in the
 * status, today's hours, and the week table once it has computed them. The shape matches renderCard so
 * the client-side patch touches only the parts that change.
 */
export function renderPendingCard(loc: Location): string {
  const search = `${loc.name} ${loc.building ?? ''} ${CATEGORY_META[loc.category].label}`.toLowerCase();
  const left: string[] = [];
  if (loc.description) left.push(`<p class="desc">${esc(loc.description)}</p>`);
  if (loc.building) left.push(`<p class="where">${esc(loc.building)}</p>`);
  if (loc.transit?.stops?.length) left.push(`<p class="stops"><span class="k">Stops</span>${esc(loc.transit.stops.join(' → '))}</p>`);
  const right: string[] = [];
  if (loc.note) right.push(`<p class="fine">${esc(loc.note)}</p>`);
  if (loc.afterHours) right.push(`<p class="after"><span class="k">After hours</span>${esc(loc.afterHours)}</p>`);
  right.push(linksInner(loc));
  if (loc.verified) right.push(`<p class="meta">Hours checked ${esc(fmtVerified(loc.verified))}</p>`);
  return `<details class="card" id="loc-${esc(loc.id)}" data-id="${esc(loc.id)}" data-cat="${loc.category}" data-state="pending" data-search="${esc(search)}">
  <summary class="card-head">
    <span class="dot" aria-hidden="true"></span>
    <span class="card-main">
      <span class="card-name">${esc(loc.name)}</span>
      <span class="card-status"><span class="state">Checking…</span></span>
    </span>
    <span class="chev" aria-hidden="true"></span>
    <button class="pin" type="button" aria-label="Pin ${esc(loc.name)} to top" aria-pressed="false" title="Pin to top">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z" fill="currentColor" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
    </button></summary>
  <div class="card-body"><div class="col">${left.join('')}</div><div class="col">${right.join('')}</div></div>
</details>`;
}

export function renderPendingGroups(locations: Location[]): string {
  const groups: string[] = [];
  groups.push(`<section class="group" data-group="pinned" hidden><h2><span class="icon">★</span>Pinned</h2><div class="cards"></div></section>`);
  for (const cat of CATEGORY_ORDER as Category[]) {
    const locs = locations.filter((l) => l.category === cat);
    if (!locs.length) continue;
    const meta = CATEGORY_META[cat];
    groups.push(
      `<section class="group" data-group="${cat}"><h2><span class="icon" aria-hidden="true">${meta.icon}</span>${esc(meta.label)}</h2><div class="cards">${locs
        .map(renderPendingCard)
        .join('')}</div></section>`,
    );
  }
  return groups.join('');
}

export function renderToolbar(): string {
  const chips = [`<button type="button" class="filter is-active" data-cat="all" aria-pressed="true">All</button>`]
    .concat(
      CATEGORY_ORDER.map(
        (c) => `<button type="button" class="filter" data-cat="${c}" aria-pressed="false">${CATEGORY_META[c].icon} ${esc(CATEGORY_META[c].short)}</button>`,
      ),
    )
    .join('');
  return `
  <div class="toolbar">
    <div class="search-row">
      <label class="search"><span class="visually-hidden">Search locations</span>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16.5 16.5L21 21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <input id="q" type="search" placeholder="Search: Dewick, pool, shuttle…" autocomplete="off" autocapitalize="off" spellcheck="false">
      </label>
      <button id="open-only" class="toggle" type="button" aria-pressed="false">Open now</button>
    </div>
    <div class="filters" role="group" aria-label="Category">${chips}</div>
  </div>`;
}
