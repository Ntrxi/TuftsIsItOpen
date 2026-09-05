# Is It Open? · Tufts

A fast, mobile-first status board that answers one question for Tufts (Medford/Somerville) students: **is this place open right now?**

Dining halls and cafés, Tisch and the other libraries, the gym and pool, the mailroom, bookstore and post office, Health Service and CMHS, makerspaces and tech support, and the campus shuttles (shown as *Running / Not running*).

Built for Cloudflare Workers. No framework, no database: a typed schedule dataset plus a small engine that resolves the right hours for any instant, server-rendered at the edge and kept live in the browser.

## How it works

```
src/
  engine/     schedule types, America/New_York time math, status computation
  data/       one file per category with sourced hours, overrides, and break rules
  render/     HTML rendering shared by the Worker (SSR) and the browser (updates)
  client/     the browser bundle: search, filters, pinning, 30-second refresh
  worker/     the Worker: SSR, JSON API, live feed providers
public/       static assets (icons, manifest, built app.js/app.css)
test/         vitest suite for the engine and data integrity
```

**Resolution order for a given day** (`resolveDay` in `src/engine/status.ts`):

1. Live overrides from feeds (library calendar, dining menu system)
2. Static date overrides (Labor Day, orientation week, one-off closures)
3. University holidays (a location can opt out with `holidays: 'regular'`)
4. Named calendar periods: Thanksgiving, winter break, spring break, summer, finals
5. Regular weekly hours

Hours are minutes since local midnight; an `end` past 1440 means overnight (Tisch until 4 AM, the Friday shuttle until 2 AM). Split hours (lunch closures, morning/evening shuttle windows) are separate intervals with optional labels (meal periods, "Tufts ID only", route names).

Unknown is a first-class state: if a break schedule has not been published, the site says so rather than guessing.

**Live feeds** (`src/worker/live.ts`), all best-effort with an edge cache and stale-while-revalidate:

- Tisch, Ginn, Lilly, and the Digital Design Studio from the LibCal hours API
- Tufts Dining closures from the Nutrislice menu digest (`holiday_text`)
- Shuttle vehicle counts from the Passio GO tracker

## Develop

```bash
npm install
npm run dev        # esbuild watch + wrangler dev on http://localhost:8787
npm test           # engine + data tests
npm run typecheck
```

`GET /api/status?at=2026-11-26T17:00:00Z` returns every location's state for any instant, which is handy for checking holiday behaviour.

## Deploy

```bash
npm run deploy
```

This builds the client bundle and runs `wrangler deploy` (Workers + static assets + one Analytics Engine binding).

## Analytics

Two free Cloudflare products, both cookie-less and with no personal data:

**Cloudflare Web Analytics** (visitors, page views, referrers, countries, trends). The Worker injects the beacon script into the page only when `CF_BEACON_TOKEN` in `wrangler.jsonc` is non-empty. The token is public (it ships in the HTML), so it lives in config rather than a secret.

**Workers Analytics Engine** (custom events). The browser posts tiny JSON events to `POST /api/event`; the Worker validates them against the location dataset (`src/engine/analytics.ts`) and writes one data point to the `tufts_is_it_open_events` dataset via the `ANALYTICS` binding. Events:

| Event | Recorded as | Not recorded |
| --- | --- | --- |
| Card opened (tap or `#loc-…` deep link) | `location_view`, location id, category | |
| Search (1 s after typing stops) | `search`, query length, result count | the query text |
| Category chip | `filter`, category id | |
| *Open now* toggle | `filter`, `open_only`, 1 / 0 | |

Data point layout: `index1`/`blob1` event type, `blob2` subject (location id, category, or `open_only`), `blob3` location category, `double1` query length or toggle state, `double2` result count. Unknown ids, categories, or event types are rejected with 400. No IPs, user agents, or free text are stored.

### One-time dashboard setup

1. **Web Analytics**: Cloudflare Dashboard → *Analytics & Logs* → *Web Analytics* → *Add a site*. Enter the site hostname (the `workers.dev` hostname or your custom domain), choose the manual JavaScript snippet, and copy the `token` value from it. Paste it into `"CF_BEACON_TOKEN"` in `wrangler.jsonc` and redeploy. You do not need to paste the snippet itself; the Worker renders it.
2. **Analytics Engine**: nothing to create manually. The dataset in `wrangler.jsonc` is created on first write after `npm run deploy`. Data appears under *Workers & Pages* → the Worker → *Analytics Engine*, or query it with SQL (needs an API token with the *Account Analytics: Read* permission):

```bash
curl "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/analytics_engine/sql"   -H "Authorization: Bearer $API_TOKEN"   -d "SELECT blob2 AS location, blob3 AS category, SUM(_sample_interval) AS views
      FROM tufts_is_it_open_events
      WHERE blob1 = 'location_view' AND timestamp > NOW() - INTERVAL '7' DAY
      GROUP BY location, category ORDER BY views DESC"
```

Always sum `_sample_interval` rather than `COUNT(*)`, because Analytics Engine samples under load. Data is retained for 3 months.

## Updating hours

Edit the relevant file in `src/data/`. Each location records its official `links.source`, a `verified` date, and a `confidence`. Locations marked `low` show an *Unverified* chip. When Tufts publishes break schedules, add them as `periods` entries keyed by the ids in `src/data/calendar.ts`.

Unofficial student project by Aaron Chung, not affiliated with Tufts University. The Jumbo logo (`public/jumbo.svg` and the app icons) is a Tufts University trademark, used here for identification in a non-commercial student project.
