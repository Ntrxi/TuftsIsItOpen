# Timing engine review: known issues

Review date: 2026-09-07  
Scope: schedule resolution, local-time conversion, live-feed interpretation, status calculation, client refresh behavior, and related architecture.

This document records the issues found during the timing-engine review. No production code was changed as part of the original review. The PR 1 implementation record at the end documents subsequent fixes; the other findings remain separate work.

## Correctness issues

### 1. Date-specific closures do not consistently cancel overnight service (P1)

`computeStatus()` combines yesterday's hours, shifted into today's frame, with today's hours. A date override is resolved for today, but the prior day's overnight interval can still remain active after midnight. That creates contradictory output: the Today row can say `Closed` while the status says `Special access` and reports a 4:00 AM closing time.

The inverse case is also unclear: an `unknown` or changed schedule for today can discard a known overnight interval that began yesterday. The engine needs an explicit policy for whether an override owns a calendar date, a service start date, or both, and it must apply that policy before merging intervals.

Relevant code: [status.ts](/C:/Users/aaron/OneDrive/Documents/GitHub/TuftsIsItOpen/src/engine/status.ts:276).

Recommended direction:

- Represent intervals with their service date or source date before shifting them across midnight.
- Apply closures and unknown states to the affected service span according to one documented rule.
- Add regressions for a closure, an unknown day, and a reopening after an overnight interval.

### 2. Dining notices can create false full-day closures or leave contradicted hours unchanged (P1)

The Nutrislice parser currently uses menu food presence and a broad closure-word regular expression to infer a day's status. A notice such as `Cafe closes at 5 PM today` can produce two incorrect outcomes:

- With no food entries, it is interpreted as a full-day closure.
- With food entries, it remains a note only, so the regular schedule still claims the cafe stays open past 5 PM.

The matcher also treats words such as `holiday` and `break` as closure evidence even when the notice may be informational. The parser cannot safely infer an exact shortened schedule from arbitrary text, but it must not claim a full-day closure or silently retain hours that the notice contradicts.

Relevant code: [live.ts](/C:/Users/aaron/OneDrive/Documents/GitHub/TuftsIsItOpen/src/worker/live.ts:245).

Recommended direction:

- Distinguish explicit full-day closures, meal-specific closures, shortened hours, and general notices.
- Parse an exact closing time only when the source provides an unambiguous structured value or tightly validated text.
- Treat ambiguous timing notices as `unknown` for the affected service period, with the notice shown to the user.
- Add cases for all-day closure, early close with food, early close without food, meal-only closure, and informational holiday/break banners.

### 3. Continuous service can appear to end at midnight (P2)

The continuity check only treats tomorrow as continuous when tomorrow contains an interval starting at minute 0 and ending at or beyond minute 1440. If today is open through midnight and tomorrow is open from midnight to 4:00 AM, the engine does not join the intervals. At 11:45 PM it reports `Closes 12:00 AM (in 15 min)` even though service continues.

Relevant code: [status.ts](/C:/Users/aaron/OneDrive/Documents/GitHub/TuftsIsItOpen/src/engine/status.ts:290).

Recommended direction:

- Build a single timeline around the current instant, including today's and tomorrow's intervals.
- Merge touching intervals before determining the closing boundary.
- Add a regression for 24-hour or midnight-crossing service followed by a partial early-morning interval.

### 4. Countdown arithmetic is wrong across daylight-saving transitions (P2)

The engine subtracts local wall-clock minutes for `changesInMinutes`, assuming every calendar day has 1,440 elapsed minutes. That is false on DST transition days:

- On spring-forward day, SafeRide at 1:30 AM reports 330 minutes until 7:00 AM; the actual elapsed duration is 270 minutes.
- On fall-back day, the same wall-clock comparison reports 330 minutes; the actual duration is 390 minutes for the first 1:30 AM occurrence.

`localToDate()` also has no explicit policy for nonexistent or repeated local times. In the reproduction, the nonexistent spring-forward 2:30 AM maps back to 1:30 AM rather than being rejected or clearly clamped forward.

Relevant code: [status.ts](/C:/Users/aaron/OneDrive/Documents/GitHub/TuftsIsItOpen/src/engine/status.ts:287) and [time.ts](/C:/Users/aaron/OneDrive/Documents/GitHub/TuftsIsItOpen/src/engine/time.ts:85).

Recommended direction:

- Convert each transition boundary to an absolute instant in `America/New_York` before subtracting.
- Define and test a policy for nonexistent and repeated local times.
- Keep display times in campus local time while using elapsed instants for countdowns and polling decisions.

### 5. Transit departure lookup disagrees with the running state at the final departure (P2)

Departure lookup includes a departure when `departure === now.minutes`, while interval membership treats an interval's end as exclusive. At exactly the Grocery Shuttle's final 2:45 PM departure, the status is `Not running` and the detail points to the next Saturday, but `nextDepartures` still includes a 2:45 PM departure with `inMinutes: 0`.

Relevant code: [status.ts](/C:/Users/aaron/OneDrive/Documents/GitHub/TuftsIsItOpen/src/engine/status.ts:236).

Recommended direction:

- Decide whether the service interval ends at the departure time or after the vehicle leaves.
- Use the same boundary convention for `span`, `nextDepartures`, and the displayed final run.
- Add exact-boundary tests for first and last departures, including overnight departures.

## User-experience issues

### 6. The next access transition is not the primary detail

For facilities such as Tisch, the important near-term change can be public access ending while the building remains open for ID holders. The current detail emphasizes the overall building close, so a user near 9:00 PM may miss that access changes in minutes. The engine already exposes period labels, but the rendered primary detail does not consistently prioritize the next access change.

Suggested improvement: expose and render the next meaningful access transition, for example `Public access ends in 10 min; Tufts ID required until 4:00 AM`.

### 7. Live-data degradation is not visible enough on affected cards

The footer exposes provider states, but users looking at an individual location may not know that a live closure or opening could not be checked. The static fallback can look authoritative even when a provider failed or its snapshot is stale.

Suggested improvement: show a concise card-level freshness message when relevant, such as `Using verified static hours; live update unavailable`, with the last successful check available in the expanded details.

### 8. Overnight details do not consistently identify the calendar date

Labels such as `Closes 4:00 AM` are ambiguous near midnight. Users benefit from wording such as `Closes tomorrow at 4:00 AM`, especially when an interval began the previous evening. The page should also make clear that the clock and schedules use campus time (`America/New_York`).

### 9. Refreshes are not aligned to state boundaries

The browser refreshes statuses every 30 seconds. This is simple and adequate for most cases, but it can leave a card showing the previous state for almost half a minute after opening or closing. Refreshing at the next known transition, with a small safety margin, would make state changes feel immediate while reducing unnecessary work between transitions.

## Architecture and efficiency opportunities

### 10. Status calculation would benefit from a resolved timeline model

Resolution, overnight shifting, access periods, status labels, countdowns, and departure predictions are currently derived in several separate steps. This makes it easy for the Today row, current span, next opening, and departures to disagree.

Suggested refactor: resolve a date window into a timeline that retains interval boundaries, source, confidence, access mode, labels, and service-date ownership. Derive the status, display text, next transition, and departures from that one timeline.

### 11. `changesInMinutes` does not always mean the next state change

The type documentation says this field is the number of minutes until the current state changes. While a location is in a special-access period, the implementation generally returns minutes until the overall interval closes, even if access changes sooner. A facility can therefore report hundreds of minutes when the meaningful state transition is in ten minutes.

Suggested refactor: return explicit transition fields such as `nextTransitionAt`, `accessChangesAt`, and `closesAt`, then derive a suitable human detail from them.

### 12. Repeated schedule resolution can be cached

Each status calculation resolves today, yesterday, the lookahead dates, and the seven-day overview independently. The current benchmark was about 1.4 ms for all 37 locations, so this is not an urgent CPU problem, but a cache keyed by location, date, live-snapshot version, and calendar version would simplify repeated work and make future schedule expansion cheaper.

### 13. Provider refreshes are coupled

The live refresh waits on library, dining, and shuttle providers together. The dining provider performs 28 weekly-menu requests (14 menus across two weeks), in addition to the library and shuttle requests. A slow or failing provider therefore affects the cadence and health of unrelated data.

Suggested refactor: maintain independent provider snapshots and freshness timestamps. Refresh vehicle counts more frequently than hours, and refresh only the provider whose data is stale. Preserve per-location failure information when assembling the client snapshot.

## Validation and test-environment notes

- The non-browser test suite passed: 123 tests across eight files.
- Typechecking passed.
- Two browser test files could not start locally because the `jsdom` package was missing from the installed dependencies. Browser behavior should be rerun after dependencies are restored.
- The issues above were reproduced against the code and test fixtures. Published Tufts schedules were not independently reverified during this review.

## Implementation plan

Use four implementation PRs and one optional architecture PR. Do not one-shot the entire review: the timeline semantics are foundational, and the other fixes should build on a reviewed definition of overnight ownership and DST behavior.

### PR sequence

| PR | Scope | Dependency | Primary model/session | Review session |
|---|---|---|---|---|
| 1. Timeline correctness | Overnight override ownership, midnight continuity, DST-safe countdowns, and explicit transition timestamps | First | Strongest reasoning model available, such as GPT-6 Astra or Claude Opus | Independent model, preferably from the other vendor |
| 2. Dining notice safety | Full-day, partial-day, shortened-hours, and ambiguous Nutrislice notices | Independent of PR 1; may run in parallel | GPT-5.6 Sol/Terra or Claude Sonnet | Independent review focused on false positives |
| 3. Transit boundaries | Final departure versus service-end behavior, exact-boundary tests, and overnight departures | Wait for PR 1 if both touch `status.ts` | GPT-5.6 Terra/Sol or Claude Sonnet | Lightweight independent test review |
| 4. UX and client behavior | Access-change messaging, overnight date wording, timezone label, freshness indicators, and refresh alignment | Wait for the status fields from PR 1 | GPT-5.6 Terra or Claude Sonnet | Review rendered behavior and regression coverage |
| 5. Provider architecture (optional) | Independent provider freshness, caching, and refresh lifecycles | Do after profiling production traffic | Strong coding model | Architecture review before implementation |

PR 1 should keep overnight service, DST, and transition fields together because they depend on the same timeline model. PR 2 can run in parallel with PR 1 in a separate worktree because it is mostly isolated to [live.ts](/C:/Users/aaron/OneDrive/Documents/GitHub/TuftsIsItOpen/src/worker/live.ts:245) and feed tests. PR 3 should wait if it would otherwise compete for `status.ts`; PR 4 should wait until the new status fields and transition semantics are stable.

### Session workflow for each PR

1. **Implementation session:** reproduce each issue, add failing regression tests, implement the smallest coherent change, run relevant tests, typechecking, and the build, then prepare the PR.
2. **Independent review session:** inspect the diff and tests without editing the implementation first. Ask specifically about semantic regressions, boundary cases, and contradictory output.
3. **Fix session:** send review findings back to the implementation session or use a fresh session on the same branch to address them.
4. **Merge gate:** require the full suite to pass, including browser tests after the missing `jsdom` dependency is restored.

Do not have Codex and Claude Code edit the same worktree or branch concurrently. Use separate worktrees for parallel PRs and keep one implementation owner per branch.

### Model roles

- Use Codex for repository exploration, implementation, tests, and integration with the existing codebase.
- Use Claude Code as an independent reviewer or adversarial test designer, or reverse those roles if Claude is the primary implementation environment.
- Reserve the strongest model for the initial timeline design and its review. Use faster coding models for the contained parser, transit, UX, and documentation work.
- Use a small model for documentation, test-case expansion, and mechanical cleanup.

### Prompt constraints

Each implementation session should receive a scope constraint like this:

> Implement only the issues assigned to this PR. Reproduce each issue with regression tests before changing code. Preserve existing schedule-policy behavior unless this PR explicitly changes it. Run relevant tests, the full test suite, typechecking, and the build. Do not modify unrelated providers, UX, or caching code.

PR 1 needs an additional design checkpoint before implementation:

> First propose the interval ownership and DST policy using concrete examples: an overnight interval crossing a closure, a midnight-continuous interval, spring-forward 2:30 AM, and fall-back repeated 1:30 AM. Do not implement until the policy is represented in tests.

Provider caching and broader performance work should remain separate until request-volume or latency evidence justifies it. The current engine benchmark was about 1.4 ms for all 37 locations, so caching is an architectural improvement rather than an urgent correctness fix.

## PR 1 implementation record (2026-09-07)

Implemented timeline correctness for findings 1, 3, and 4, plus the transition contract needed by PR 4. The resolved timeline is internal to `src/engine/status.ts`; timezone conversion and status contracts live in `time.ts` and `types.ts`. Provider parsing, rendering/client code, timetable boundary rules, and persistent caching are unchanged.

### Ownership and uncertainty

`resolveDay()` now returns `allowsCarryover` independently of `source`. Known regular schedules (including empty weekdays), replacement ranges, weekly/seasonal schedules, explicit `regular` overrides/periods, and note-only notices preserve published incoming overnight service. Explicit date closures (including empty single-date arrays), observed holidays, unknown coverage, and source conflicts stop carryover at midnight. A seasonal `closed` period means no new service starts; the final prior service is allowed to finish.

This policy was revised after production-shaped review cases exposed that treating every replacement date as a midnight barrier cut consecutive Commons events and LibCal's per-date Tisch schedules short. The user selected preservation of published service tails across schedule changes. A genuine next-day cutoff now adds an explanatory note to the preceding day's card and sets `isSpecial`; ordinary schedule changes do neither. Existing override priority and confidence rules remain in place.

An interval starting Monday at 9 PM and normally ending Tuesday at 4 AM is truncated at midnight if Tuesday owns its date. A Tuesday closure confirms a midnight close; Tuesday unknown ends only the known availability span. For public access at Monday 11:50 PM with Tuesday unknown:

```text
state: open
detail: Hours not published from tomorrow at 12:00 AM
closesAt: undefined
changesInMinutes: 10
nextTransitionAt: Tuesday midnight as a UTC ISO string
```

The facility becomes unknown at midnight and never enters closing-soon merely because published knowledge ends. Special access and transit keep their respective states until that boundary. A replacement Tuesday schedule of 10 AM–6 PM preserves Monday's service until 4 AM, followed by a gap until 10 AM. The final Davis Friday loop likewise finishes at 2 AM on the first Saturday of its summer suspension.

Touching intervals merge on an absolute timeline: service through midnight followed by midnight–4 AM closes at 4 AM. A finite lookahead never creates a closing timestamp or a fabricated midnight-close detail. A partial first day followed by continuous service beyond the horizon says `No closing time in the next 60 days`.

### Service-day display and PR 4 interface

The user selected service-start-day display after reviewing the initial midnight-sliced presentation. Today, today's labeled periods, and week rows retain complete overnight ranges: SafeRide is `11:00 PM – 7:00 AM`; Tisch is `7:45 AM – 4:00 AM`. While a previous service is active, a schedule note says `Overnight service from yesterday until 4:00 AM`. If no service starts today, the Today row says `No service starts today` during that carryover, avoiding a contradictory `Closed` row. Labeled periods are not duplicated by midnight slicing. Actual dated closures still clip the affected overnight range, with an explanatory note.

Confirmed closes on later dates include a qualifier, such as `Closes tomorrow at 4:00 AM` or `Closes Wed, Sep 16 at 5:00 PM`; known distant closes are not hidden behind generic 24-hour text.

All new timestamps are optional UTC ISO strings:

| Field | Contract |
|---|---|
| `nextTransitionAt` | Earliest strictly future state, access-mode, or period-label change, including applicable opening/closing-soon thresholds and transitions into/out of unknown coverage |
| `accessChangesAt` | Next access-mode change inside the current continuous service span |
| `closesAt` | Confirmed end of the current continuous service span; absent at unknown coverage or the artificial horizon |
| `changesInMinutes` | Rounded-up elapsed minutes until `nextTransitionAt`; absent when no transition is known |

Primary opening/closing details still count down to the actual service boundary. Consumers must not interpret `changesInMinutes` as time until opening or closing. The existing live Tisch test intentionally changes from 1380 to 405 minutes at 1 AM, targeting public access at 7:45 AM. A facility opening in 200 minutes reports 170 until it enters opening-soon. PR 4 can use the exact timestamps without changing this definition.

### DST and transit compatibility

`localToDate()` keeps its signature. It normalizes calendar minutes, shifts nonexistent spring times forward by the gap (2:30 AM becomes 3:30 AM), and selects the first repeated fall occurrence. Membership and status countdowns use actual instants, including the second repeated hour. Invalid or collapsed/reversed intervals are individually omitted with a neutral warning, preserving other valid periods rather than declaring the whole day unknown or attributing malformed data to DST. SafeRide countdowns at spring 1:30 AM and the two fall 1:30 AM occurrences are respectively 270, 390, and 330 elapsed minutes.

Departure provenance is evaluated independently for each service date: today's regular source permits today's timetable; yesterday's regular source and today's carryover permission permit yesterday's timetable. A new seasonal schedule therefore cannot erase yesterday's published trips. An explicit `regular` override still suppresses timetable predictions for its own service date, but not another date. Trips beyond a dated closure/unknown midnight are suppressed. Inclusive final-departure selection and departure countdown arithmetic remain for PR 3.

### Validation and implementation review

Policy regressions were run before production edits: 17 of the initial 19 tests failed against the old engine. All eight initial review regressions also failed before these follow-up fixes. Tests now cover real Commons/Tisch/Davis cases, exception ownership, unknown/confirmed boundaries, continuity, DST, transition thresholds, service-day text/carryover notes, departure eligibility, and independent absolute coverage invariants. Shared membership/threshold helpers and boundary tests keep transition timestamps aligned with displayed state and period changes.

The already-declared jsdom 30.0.1 dependency was restored in place with lifecycle scripts disabled; manifests and the lockfile were unchanged. Independent review found and prompted the lookahead-detail regression above. Follow-up review found zero differences across 38,355 fast/cached versus reference timezone conversions and 1,000 adaptive versus full-window/shared versus individual status calculations, including DST dates and synthetic overrides.

The timeline first resolves the seven-day overview plus the next date needed to check its overnight ends, extending to the existing 60-day limit only when necessary. `computeAll()` shares timezone offsets, converted instants, local projections, and calendar windows across locations for that invocation only. Ordinary dates use direct arithmetic after their offsets are checked; DST dates use the deterministic fallback. No location schedule or live snapshot is cached between invocations. Unused interval source metadata, the unused next-opening argument, and the unused week-overview wrapper were removed.

Run `node test/benchmark-timing.mjs` to reproduce engine-only measurements. After these fixes, local 100-sample medians for all 37 locations were 3.82 ms on Sep 14 and 5.83 ms on Jan 10 (p95 4.75/6.73 ms), versus the prior implementation's tens of milliseconds. Spring/fall DST medians were 3.40/3.45 ms. These are local wall-clock measurements, not production Worker CPU or end-to-end request guarantees. Persistent/provider caching remains separate.

Follow-up final checks: all 203 tests across 12 files passed, including browser tests; both TypeScript configurations, the production build, and whitespace checks passed. The new timing regression tests and benchmark are staged for inclusion in a later commit. No commit, deployment, or merge was performed.
