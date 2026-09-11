# Is It Open? · Tufts

A fast, mobile-first status board that answers one question for Tufts (Medford/Somerville) students: **is this place open right now?**

Dining halls and cafés, Tisch and the other libraries, the gym and pool, the mailroom, bookstore and post office, Health Service and CMHS, makerspaces and tech support, and the campus shuttles (shown as *Running / Not running*).

Built for Cloudflare Workers. No framework, no database: a typed schedule dataset plus a small engine that resolves the right hours for any instant, server-rendered at the edge and kept live in the browser.

## Architecture

```
src/
  engine/     schedule types, campus-time math, and status computation
  data/       sourced hours, overrides, and academic-calendar rules
  render/     HTML shared by server rendering and browser updates
  client/     search, filters, pinning, and refresh behavior
  worker/     routes, caching, and live-feed providers
public/       static assets (icons, manifest, built app.js/app.css)
test/         engine, feed, rendering, and data-integrity tests
```

The engine resolves live overrides, dated exceptions, holidays, academic periods, and regular weekly hours in that order. Overnight and split intervals retain their campus service date. Missing, conflicting, or unverified hours resolve to an explicit unknown state rather than a guess.

Live data comes from LibCal, Nutrislice, Bray Lab's public calendars, and Passio GO. Providers are best-effort: verified static schedules remain available when appropriate, while affected live data expires or becomes unknown on failure. Current unresolved source decisions and timing concerns are recorded in [`docs/maintenance.md`](docs/maintenance.md).

## Develop

```bash
npm install
npm run dev        # client rebuilds + wrangler dev on http://localhost:8787 (analytics disabled)
npm test
npm run typecheck
npm run build
```

`GET /api/status?at=2026-11-26T17:00:00Z` returns every location's state for any instant, which is handy for checking holiday behaviour.

## Deploy and operate

```bash
npm run deploy
```

Wrangler's checked-in build hook builds the client bundle before direct or connected deployment. `GET /healthz` reports uncached provider health, and provider failures emit structured `live_feed_failure` logs.

Cloudflare Web Analytics is included only when `CF_BEACON_TOKEN` in `wrangler.jsonc` is non-empty; local development disables it. Configure the token with the manual Web Analytics snippet and keep automatic injection disabled to avoid duplicate beacons.

## Updating hours

Edit the relevant category in `src/data/`. Record the official source, update `verified` only when that source was actually checked, and preserve uncertainty instead of inferring unpublished hours. Use the contracts in `src/engine/types.ts` for confidence, conflicts, validity bounds, holidays, and facilities without fixed schedules.

Add focused regression coverage for changed schedule behavior, then run `npm test`, `npm run typecheck`, and `npm run build`.

Unofficial student project by Aaron Chung, not affiliated with Tufts University. The Jumbo logo (`public/jumbo.svg` and the app icons) is a Tufts University trademark, used here for identification in a non-commercial student project.
