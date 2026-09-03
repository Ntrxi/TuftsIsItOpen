import type { Calendar, Location, Status } from '../engine/types';
import type { LiveData } from '../engine/live';
import { DATA_VERIFIED } from '../data';
import { esc, renderClock, renderGroups, renderToolbar } from './render';

/** Jumbo, the Tufts elephant (athletics logo; used here in an unofficial, non-commercial student project). */
export const MARK_SVG = `<img class="mark" src="/jumbo.svg" width="40" height="44" alt="Jumbo the elephant" decoding="async">`;

export function renderPage(locations: Location[], statuses: Status[], cal: Calendar, live: LiveData, at: Date): string {
  const liveJson = JSON.stringify(live).replace(/</g, '\\u003c');
  const verified = DATA_VERIFIED ? fmtDate(DATA_VERIFIED) : 'recently';
  const liveSources = Object.entries(live.sources)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
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
    <div class="clock" id="clock">${renderClock(at, cal)}</div>
  </div>
  ${renderToolbar()}
</header>
<main id="list" class="list" data-cat="all">
  ${renderGroups(locations, statuses, live)}
  <p class="empty" id="empty" hidden>Nothing on the Hill matches that. Try another search, or turn off <em>Open now</em>.</p>
</main>
<footer class="foot">
  <div class="colophon">
    <span class="credit">Built by Aaron Chung, a Tufts student.</span>
    <span><a href="https://github.com/Ntrxi/TuftsIsItOpen" target="_blank" rel="noopener">Source &amp; corrections</a> · <a href="/api/status">JSON API</a></span>
  </div>
  <p>Unofficial and not affiliated with Tufts University. Hours come from official Tufts pages (checked ${esc(verified)}) plus live feeds from the library calendar, the dining menu system, and the shuttle tracker${liveSources ? ` (${esc(liveSources)})` : ''}. Always confirm before a special trip.</p>
</footer>
<script>window.__LIVE__=${liveJson};window.__RENDERED_AT__=${JSON.stringify(at.toISOString())};</script>
</body>
</html>`;
}

function fmtDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}, ${y}`;
}
