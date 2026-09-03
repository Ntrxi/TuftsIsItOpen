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

This builds the client bundle and runs `wrangler deploy` (Workers + static assets, no other bindings needed).

## Updating hours

Edit the relevant file in `src/data/`. Each location records its official `links.source`, a `verified` date, and a `confidence`. Locations marked `low` show an *Unverified* chip. When Tufts publishes break schedules, add them as `periods` entries keyed by the ids in `src/data/calendar.ts`.

Unofficial student project, not affiliated with Tufts University.
