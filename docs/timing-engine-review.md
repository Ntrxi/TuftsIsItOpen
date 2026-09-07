# Timing engine review: known issues

Review date: 2026-09-07  
Scope: schedule resolution, local-time conversion, live-feed interpretation, status calculation, client refresh behavior, and related architecture.

This document records the issues found during the timing-engine review. It is a review record, not a list of completed fixes. No production code was changed as part of the review.

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
