# Schedule audit — September 5, 2026

| Location | Official source reviewed | Outcome |
| --- | --- | --- |
| TTS walk-up | [August announcement](https://access.tufts.edu/tts-walk-help-desk-returns-tisch-library-beginning-august-10), [IT locations](https://it.tufts.edu/walk-support-locations) | Hours disagree. Preserve both descriptions and show unknown with a conflict explanation. |
| Nolop | [Hours](https://nolop.org/hours/), [announcements](https://nolop.org/) | Hours page still describes summer; no complete fall week. Removed the unsupported daily 9–11 schedule. |
| Hamilton Pool | [Athletics hours](https://gotuftsjumbos.com/sports/2022/5/6/facilities-Reservation.aspx) | Fall dates confirmed through January 19; Mon–Thu morning entry says 7 PM–8:15 AM. Keep unconfirmed, flag the ambiguity, and bound validity. |
| Pop-up Pub | [Dining](https://dining.tufts.edu/pub) | Thursday 6–10 pattern exists, but no dated fall event list. Keep unconfirmed; an unannounced first event does not prove closure. |
| Campus Store | [Store](https://tufts.bncollege.com/) | Page could not be retrieved. Keep medium confidence; regular hours now resolve to unknown. |
| Bray shop / 3D printing | [Shop](https://sites.tufts.edu/bray/), [3D lab](https://sites.tufts.edu/bray/3dprintinglab/) | Pages could not be retrieved. Keep existing unknown hours and prior verification dates. |
| Crafts Center | [Official organization listing](https://tufts.presence.io/organization/crafts-center) | No readable semester schedule. Keep low confidence; do not assert the old pattern is current. |

The [library exceptions page](https://tischlibrary.tufts.edu/about-library/visit/hours) supplies Lilly-specific Thanksgiving and winter dates, replacing the estimated pattern copied from other libraries. Other explicitly estimated Thanksgiving schedules now carry low confidence.

The actual LibCal grid uses a `locations` array with numeric `lid`, not `loc_<id>` keys. Tisch building hours (20832) and public hours (20834) are separate calendars. The parser uses both dates across midnight, and reports unconfirmed access when public hours are absent. Nutrislice and Passio response shapes were also checked against live responses; Passio's `outdated` flag excludes obsolete vehicles.
