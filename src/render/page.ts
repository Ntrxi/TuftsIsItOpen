import type { Location } from '../engine/types';
import { DATA_VERIFIED } from '../data';
import { esc, renderPendingGroups, renderToolbar } from './render';

/** Jumbo, the Tufts elephant (athletics logo; used here in an unofficial, non-commercial student project). */
export const MARK_SVG = `<img class="mark" src="/jumbo.svg" width="40" height="44" alt="Jumbo the elephant" decoding="async">`;

export interface PageOptions {
  /** Cloudflare Web Analytics site token; omit or leave empty to render no beacon. */
  beaconToken?: string;
}

/**
 * The static homepage, generated once at build time and served as an asset without invoking the Worker.
 * Nothing time-dependent is baked in: cards render in a pending state and the browser bundle computes
 * statuses from the same dataset once it has fetched the live snapshot from /api/live.
 */
export function renderPage(locations: Location[], opts: PageOptions = {}): string {
  // Cloudflare Web Analytics beacon (cookie-less, no PII). The attribute is double-quoted, so esc() keeps it safe.
  const beacon = opts.beaconToken
    ? `\n<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon="${esc(JSON.stringify({ token: opts.beaconToken }))}"></script>`
    : '';
  const verified = DATA_VERIFIED ? fmtDateRange(DATA_VERIFIED.earliest, DATA_VERIFIED.latest) : 'recently';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Is It Open? · Tufts</title>
<meta name="description" content="Is this Tufts place open right now? Live status for dining halls, Tisch Library, the gym, mailroom, health services, makerspaces, and shuttles.">
<meta name="author" content="Aaron Chung">
<meta name="theme-color" content="#f5f2ed" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#1a1310" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<meta property="og:title" content="Is It Open? · Tufts">
<meta property="og:description" content="Quick answer to whether a Tufts dining hall, library, gym, office, or shuttle is open right now.">
<link rel="icon" href="/jumbo.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon-180.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,600..900,0..100;1,9..144,600..900,0..100&display=swap">
<link rel="stylesheet" href="/app.css">
<link rel="preload" href="/api/live" as="fetch" crossorigin="anonymous">
<script type="module" src="/app.js"></script>
</head>
<body>
<a class="skip" href="#list">Skip to list</a>
<header class="top">
  <div class="brand">
    <div class="wordmark">
      ${MARK_SVG}
      <h1><span class="q">Is it open?</span><span class="sub">Tufts · Medford/Somerville</span></h1>
    </div>
    <div class="clock" id="clock"><time>&nbsp;</time><span class="ctx ctx-pending">&nbsp;</span></div>
  </div>
  ${renderToolbar()}
</header>
<main id="list" class="list" data-cat="all">
  <noscript><p class="nojs">Live status needs JavaScript. Each card still links to the official Tufts page for its hours.</p></noscript>
  ${renderPendingGroups(locations)}
  <p class="empty" id="empty" hidden>Nothing on the Hill matches that. Try another search, or turn off <em>Open now</em>.</p>
</main>
<footer class="foot">
  <div class="colophon">
    <span class="credit">Built by Aaron Chung, a Tufts student.</span>
  </div>
  <p>Unofficial and not affiliated with Tufts University. Hours come from official Tufts pages (checked ${esc(verified)}) plus live feeds from the library calendar, the dining menu system, the Bray Lab shop calendar, and the shuttle tracker<span id="live-sources"></span>. Always confirm before a special trip.</p>
</footer>${beacon}
</body>
</html>`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sep 5, 2026", "Sep 3–5, 2026", "Aug 30 – Sep 5, 2026", or "Dec 30, 2026 – Jan 2, 2027". */
export function fmtDateRange(from: string, to: string): string {
  const [y1, m1, d1] = from.split('-').map(Number) as [number, number, number];
  const [y2, m2, d2] = to.split('-').map(Number) as [number, number, number];
  if (y1 !== y2) return `${MONTHS[m1 - 1]} ${d1}, ${y1} – ${MONTHS[m2 - 1]} ${d2}, ${y2}`;
  if (m1 !== m2) return `${MONTHS[m1 - 1]} ${d1} – ${MONTHS[m2 - 1]} ${d2}, ${y2}`;
  if (d1 !== d2) return `${MONTHS[m1 - 1]} ${d1}–${d2}, ${y2}`;
  return `${MONTHS[m1 - 1]} ${d1}, ${y1}`;
}
