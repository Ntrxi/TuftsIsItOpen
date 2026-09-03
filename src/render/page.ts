import type { Calendar, Location, Status } from '../engine/types';
import type { LiveData } from '../engine/live';
import { DATA_VERIFIED } from '../data';
import { esc, renderClock, renderGroups, renderToolbar } from './render';

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
<meta name="theme-color" content="#3e8ede" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0f1720" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<meta property="og:title" content="Is It Open? · Tufts">
<meta property="og:description" content="Quick answer to whether a Tufts dining hall, library, gym, office, or shuttle is open right now.">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon-180.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="stylesheet" href="/app.css">
<script type="module" src="/app.js"></script>
</head>
<body>
<a class="skip" href="#list">Skip to list</a>
<header class="top">
  <div class="brand">
    <h1><span class="q">Is it open?</span><span class="sub">Tufts · Medford/Somerville</span></h1>
    <div class="clock" id="clock">${renderClock(at, cal)}</div>
  </div>
  ${renderToolbar()}
</header>
<main id="list" class="list" data-cat="all">
  ${renderGroups(locations, statuses, live)}
  <p class="empty" id="empty" hidden>Nothing matches. Try another search or turn off <em>Open now</em>.</p>
</main>
<footer class="foot">
  <p>Unofficial student project, not affiliated with Tufts University. Hours come from official Tufts pages (checked ${esc(verified)}) plus live feeds from the library calendar, the dining menu system, and the shuttle tracker${liveSources ? ` (${esc(liveSources)})` : ''}. Always confirm before a special trip.</p>
  <p><a href="https://github.com/Ntrxi/TuftsIsItOpen" target="_blank" rel="noopener">Source &amp; corrections on GitHub</a> · <a href="/api/status">JSON API</a></p>
</footer>
<script>window.__LIVE__=${liveJson};window.__RENDERED_AT__=${JSON.stringify(at.toISOString())};</script>
</body>
</html>`;
}

function fmtDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}, ${y}`;
}
