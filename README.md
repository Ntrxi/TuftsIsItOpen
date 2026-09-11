# Is It Open? · Tufts

A fast, mobile-first status board that answers one question for Tufts (Medford/Somerville) students: **is this place open right now?**

Dining halls and cafés, Tisch and the other libraries, the gym and pool, the mailroom, bookstore and post office, Health Service and CMHS, makerspaces and tech support, and the campus shuttles (shown as *Running / Not running*).

Built for Cloudflare Workers. No framework, no database: a typed schedule dataset plus a small engine that resolves the right hours for any instant. The homepage is generated at build time and served as a static asset; the browser computes every status from the bundled dataset and a small live snapshot from the Worker.

## How it works

```
src/
  engine/     schedule types, America/New_York time math, status computation
  data/       one file per category with sourced hours, overrides, and break rules
  render/     HTML rendering shared by the build (static page) and the browser (updates)
  client/     the browser bundle: search, filters, pinning, 30-second refresh
  worker/     the Worker: JSON API and live feed providers
scripts/      the build: client bundle plus the prerendered public/index.html
public/       static assets (icons, manifest, _headers, built index.html/app.js/app.css)
test/         vitest suite for the engine and data integrity
```

**Request flow.** `/` is `public/index.html`, served by Cloudflare's static assets layer without invoking the Worker (as are the icons and the bundle). The page ships every card as *Checking…* with its description and official links; `app.js` fetches `/api/live`, computes every status on the device, and patches the cards in place. The first render waits up to 2.5 s for that snapshot so a normal load never flashes the static schedule before live closures replace it; a slower response falls back to the static schedule and is patched when it lands. Only `/api/*` and `/healthz` reach the Worker. `public/_headers` sets the cache and security headers for assets.

**Resolution order for a given day** (`resolveDay` in `src/engine/status.ts`):

1. Live overrides from feeds (library calendar, dining menu system)
2. Static date overrides (Labor Day, orientation week, one-off closures)
3. University holidays (a location can opt out with `holidays: 'regular'`)
4. Dates past the loaded calendar (`through` in `src/data/calendar.ts`) are unknown, except for locations with `breaks: 'regular'`
5. Named calendar periods: Thanksgiving, winter break, spring break, summer (finals keep regular hours unless listed)
6. Regular weekly hours

Hours are minutes since local midnight; an `end` past 1440 means overnight (Tisch until 4 AM, the Friday shuttle until 2 AM). Split hours (lunch closures, morning/evening shuttle windows) are separate intervals with optional labels (meal periods, "Tufts ID only", route names).

Unknown is a first-class state: if a break schedule has not been published, the site says so rather than guessing.

**Live feeds** (`src/worker/live.ts`), all best-effort with an edge cache and stale-while-revalidate:

- Tisch, Ginn, Lilly, and the Digital Design Studio from the LibCal hours API
- Tufts Dining closures and notices from the Nutrislice weekly menu API (bold `is_holiday` lines). Every meal menu is checked for the dining halls, and a day is closed only when all published menus say so. The digest endpoint is not used because it omits weekends.
- Shuttle vehicle counts from the Passio GO tracker

## Develop

```bash
npm install
npm run dev        # client rebuilds + wrangler dev on http://localhost:8787 (analytics disabled)
npm test           # engine + data tests
npm run typecheck
```

`GET /api/status?at=2026-11-26T17:00:00Z` returns every location's state for any instant, which is handy for checking holiday behaviour.

`npm run build` writes `public/app.js`, `public/app.css`, and `public/index.html`; all three are generated and ignored by git.

## Deploy

```bash
npm run deploy
```

Wrangler's checked-in build hook builds the client bundle before deployment, including direct `wrangler deploy` and connected Workers Builds deployments.

## Analytics

Cloudflare Web Analytics provides basic traffic statistics (visitors, page views, and referrers). The build embeds the beacon in `public/index.html` only when `CF_BEACON_TOKEN` in `wrangler.jsonc` is non-empty. The token is public; `npm run dev` and `npm start` disable the beacon (Wrangler runs the build with `WRANGLER_COMMAND=dev`, which selects the `dev` environment's empty token; `CLOUDFLARE_ENV` selects an environment explicitly).

To configure it, add the site in Cloudflare's Web Analytics dashboard, choose the manual JavaScript snippet, and copy its token into `CF_BEACON_TOKEN`, then redeploy. Keep automatic injection disabled to avoid duplicate beacons. If adding a CSP, allow `https://static.cloudflareinsights.com` in `script-src` and `https://cloudflareinsights.com` in `connect-src`.

Custom interaction tracking is disabled. `/api/event` returns 410 for older clients; those requests still consume Worker quota until users reload. Historical Analytics Engine data is not deleted by this change.

## Usage and rollout checks

Only API requests count as Worker requests now: each page view costs one `/api/live` request instead of one page render plus one live request. Live data polls every two minutes while visible and online. Hidden/offline tabs pause polling; returning to a stale tab or reconnecting refreshes it without overlapping requests. Failed polls retry after two minutes. Statuses still update locally every 30 seconds, with unchanged freshness limits.

Production logs use 10% sampling (including failure logs); development uses 100%. Temporarily set `observability.head_sampling_rate` to `1` to diagnose an incident, then restore `0.1`. `/healthz` continues to report current feed health.

Before deployment, record seven days of account-wide Worker requests, this Worker's requests and CPU errors, and log volume from Cloudflare. Compare another seven days after deployment, accounting for visitor traffic changes, and confirm new clients make no `/api/event` requests. Review account-wide usage at 70,000 requests/day; treat 90,000/day as urgent. These are manual review thresholds, not automated alerts. Caching saves upstream work but does not eliminate incoming Worker requests from the daily allowance; static asset requests, including the homepage, are not Worker requests.

## Updating hours

Edit the relevant file in `src/data/`. Each location records its official `links.source`, a `verified` date, and a `confidence`. Low/medium-confidence regular schedules resolve to unknown; estimated periods and overrides must also carry `confidence`. Use `sourceConflict` for unresolved official-source disagreement and `validThrough` for a schedule that ends before the calendar. `breaks: 'regular'` never extends calendar coverage.

Live date overrides precede static overrides. Within either layer, higher `priority` wins; equal-priority overlapping hours overrides resolve to unknown and static overlaps fail the integrity test. Note-only notices combine without changing hours. When Tufts publishes break schedules, add `periods` entries keyed by `src/data/calendar.ts`.

Failed feeds make affected hours unknown immediately. Snapshots expire after 15 minutes; vehicle counts expire after 3 minutes and disappear on connectivity or provider failure. `/healthz` returns uncached JSON (200 healthy, 503 degraded), including source health, snapshot age, and failed location ids. Provider failures emit structured `live_feed_failure` logs.

CI runs tests, typechecking, and the production build in the `validate` job for pull requests, main pushes, and merge queues. Require `validate` with an up-to-date branch in GitHub branch protection. The workflow must be published before GitHub can run it.

Unofficial student project by Aaron Chung, not affiliated with Tufts University. The Jumbo logo (`public/jumbo.svg` and the app icons) is a Tufts University trademark, used here for identification in a non-commercial student project.
