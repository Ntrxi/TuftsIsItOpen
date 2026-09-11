# Maintenance status

This page contains only current source-verification decisions and unresolved timing concerns. Git history preserves completed audits and implementation records.

## Source verification

The following locations were rechecked against first-party sources on September 11, 2026 (America/New_York). Missing, conflicting, or ambiguous information remains non-definitive.

| Location | Current source conclusion | Current handling |
| --- | --- | --- |
| TTS Walk-Up Help Desk | [IT locations](https://it.tufts.edu/walk-support-locations) publishes regular Tisch hours but says holiday and special hours may vary; an [August announcement](https://access.tufts.edu/tts-walk-help-desk-returns-tisch-library-beginning-august-10) confirms the return to Tisch with different hours. | Regular hours use the locations page. University holidays and breaks remain unknown. |
| Hotung Pop-Up Pub | The [pub page](https://dining.tufts.edu/pub), [regular hours](https://dining.tufts.edu/hours/regular-hours-operation), and [Fall dates](https://dining.tufts.edu/hours/pop-pub-hours) establish Thursday 6–10 PM events through December 10. | Published dates are known; unlisted Thursdays are closed. Spring dates remain unknown. |
| Hamilton Pool | [Athletics](https://gotuftsjumbos.com/sports/2022/5/6/facilities-Reservation.aspx) prints a contradictory Monday–Thursday morning interval, `7pm-8:15am`, alongside a later evening session. | Other published sessions are known. The Monday–Thursday 7–8:15 AM interval remains unconfirmed. |
| Campus Store | The [official storefront](https://tufts.bncollege.com/customer-service) blocks non-browser requests, exposes no machine-readable opening hours, and displayed undated hours changed between September 7 and 11. | Stored hours remain medium-confidence and resolve to unknown. No live provider is used. |
| Nolop FAST Facility | [Nolop's hours page](https://nolop.org/hours/) still gives only expired summer hours and incomplete fall prose without opening or Saturday times. | Hours remain unknown until a complete schedule is published. |
| Bray Machine Shop | The [Bray page](https://sites.tufts.edu/bray/) embeds public Open Hours and In-Shop Labs calendars with recurring hours, edits, removals, and closures. | The live calendar provider supplies open-shop overrides. Hours remain unknown when the feed fails or does not cover a date. |
| Halligan Electronics Labs | [Engineering computing](https://engineering.tufts.edu/computing/other-facilities) says hours vary and eligible ECE/CS students have access outside scheduled labs. | Display as `Access varies`; never infer open or closed. |
| Tufts Crafts Center | [JumboLife](https://tufts.presence.io/organization/crafts-center), the [Maker Network](https://tufts.makernetwork.org/spaces/crafts-center), and the [mailing-list page](https://elist.tufts.edu/sympa/info/crafts.center) provide undated, conflicting schedules. | Hours remain unknown until a dated first-party semester schedule is available. |

Thanksgiving, winter break, and Spring 2027 schedules remain unknown wherever no consulted source published them. Bray's live calendar may still provide explicit closures within its covered range.

## Open timing concerns

1. **Ambiguous dining notices:** `src/worker/live.ts` can treat broad closure wording with no menu entries as a full-day closure, while shortened-hours text with food may remain only a note. Require explicit full-day evidence; otherwise scope the result to the affected meal or mark it unknown.
2. **Final transit departure boundary:** `src/engine/status.ts` includes a departure exactly at the current minute while service intervals end exclusively. Define one boundary rule and apply it to running state, displayed service span, and departure lookup.
3. **Live-feed degradation visibility:** affected cards do not prominently identify unavailable or stale live data. Surface a concise card-level fallback message without implying that static hours were freshly confirmed.
4. **Boundary-aligned refreshes:** the browser recomputes status every 30 seconds rather than scheduling the next known transition. Use `nextTransitionAt` with a small safety margin while retaining a fallback tick.
5. **Provider refresh coupling:** library, dining, Bray, and shuttle data share a refresh lifecycle and snapshot timestamp. If production evidence justifies the work, separate provider freshness so a slow source does not govern unrelated data.
