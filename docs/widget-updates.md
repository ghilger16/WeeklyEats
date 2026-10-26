# iOS widget update investigation and hardening

## Findings before changes

The dashboard built `buildTodayWidgetPayload(days, nextWeekDays, effectiveDate,
todayServedEntry?.outcome)` and wrote it from a React effect. The native
`TodayWidgetBridge` put that dictionary in App Group UserDefaults under
`todayWidgetPayload`, then requested `reloadTimelines(ofKind: "TodayMealWidget")`.
Both targets use `group.com.ghilger16.WeeklyEats`.

Swift already selected today's meal from date-keyed `plannedMeals`. Its timeline
already contained now plus 14 future local midnights, with a refresh request every
30 minutes. Missing midnight entries was therefore **not** the defect in the
checked-in implementation. The bridge already wrote before requesting reload.

Confirmed weaknesses:

- Only the dashboard wrote the shared snapshot. Updates elsewhere depended on
  the dashboard's in-memory plans, meal library, and served history catching up.
- The dashboard's `effectiveDate` was memoized on testing-date settings. It did
  not advance automatically overnight and could also publish the simulated date.
- Served state was tied to a single stored `today`, rather than a date-indexed
  history. Refreshing on a later day could not recover another day's outcome.
- Plan and side getters rewrote whole storage maps. An overlapping read could
  restore an older map over a newer save. Concurrent map setters also needed
  serialization.
- Week IDs used `toISOString().slice(0, 10)` on local midnight, which is the
  preceding civil date east of UTC. Historical served timestamps also lacked a
  stable date-only field for timezone changes.
- Snapshot writes/reloads were driven by UI effects, without cross-request or
  native persisted-content deduplication.

These are reproducible code-level failure paths. No logs or App Group snapshots
from the affected physical iPhone were available, so the exact cause of that
individual incident is not proven. A stale app-published snapshot is the most
likely application-level cause; iOS scheduling can also delay display updates.

## Updated data flow

1. Persist a plan, side, meal-library, or served-history mutation.
2. The storage layer emits `WIDGET_DATA_CHANGED` after the write succeeds.
3. Root-mounted `WidgetCoordinator` calls the single `syncWidgetState()` service.
4. The service reads saved data without invoking mutating plan getters, builds
   a snapshot using `new Date()` (never dashboard/testing dates), and writes it
   through the native bridge.
5. The bridge stores JSON Data in the App Group, synchronizes it, then requests
   the WidgetKit reload. JSON supports nullable optional bridge fields safely.

The service combines short bursts of writes, serializes native writes, discards
reads invalidated by another mutation, and compares widget-visible content while
excluding generation timestamps. The native bridge also deduplicates against the
stored payload across app launches. Failed reads/writes do not become a successful
cached fingerprint, so a later sync can retry.

Week plan/side reads no longer rewrite or clean up maps. Week-map mutations are
serialized. Unrelated ratings, UI selection, filters, and tab rendering do not
change the payload or cause a WidgetCenter reload.

The normal mutation paths cover full/individual planning, swaps, replacements,
deletions, special meals, sides, prep notes, all four outcomes, undo, and wrap-up.
Explicit storage resets also await the central sync before navigation/reload.

## Dates and timeline

- The snapshot includes saved dated plans rather than just a cached today meal.
- New plan writes preserve `calendarWeekStartDate`; new served records preserve
  `mealDate`. Widget keys use local year/month/day, not UTC date slicing.
- Legacy UTC-truncated week IDs are translated using the saved week-start
  preference. Explicit local date metadata takes precedence and survives travel
  and subsequent preference changes.
- Swift uses a Gregorian calendar in the device's current local timezone to
  interpret the Gregorian keys. User-facing date formatting can still follow
  locale preferences. Invalid date keys are rejected.
- One shared payload is read per timeline generation, avoiding mixed snapshots
  across entries. Selection is independent for every entry's local calendar date.
- Entries cover now plus 14 local midnights. A replenishment is requested at five
  minutes after the next local midnight. Existing entries carry the rollover if
  that reload request is delayed. DST days may be 23 or 25 hours.
- Missing days show No Plans, never yesterday's meal. An outcome is applied only
  to its date and matching meal (or an explicitly day-wide null-meal outcome).
- Existing UX is preserved: the small widget shows tomorrow after an outcome;
  the medium widget shows the outcome and tomorrow. The outcome does not leak
  into the next day.
- Startup/resume resyncs from storage. A foreground minute check also detects
  day/timezone changes. Neither is the primary overnight mechanism.

Metadata includes `schemaVersion`, `snapshotGeneratedAt`, `snapshotDate`,
`snapshotTimeZone`, `snapshotUTCOffsetMinutes`, `mealDate`, `mealId`,
`weekStartDate`, `servedState`, and `outcomesByDate`. Debug logs use
`[WeeklyEatsWidget]` and report snapshot generation, requested/selected dates,
meal ID, outcome, timezone, and the next refresh.

## Files

- `services/widget/{WidgetCoordinator.tsx,syncWidgetState.ts,widgetEvents.ts}`:
  lifecycle, serialization, invalidation, and deduplication.
- `stores/widgetSourceStorage.ts`, `utils/todayWidgetPlan.ts`,
  `utils/widgetCalendar.ts`: read-only snapshot input and civil-date construction.
- `stores/{weekPlanStorage,mealsStorage,servedMealsStorage,todayWidgetStorage}.ts`,
  `types/weekPlan.ts`: persisted mutation notifications, date metadata, bridge types.
- `app/_layout.tsx`, `app/(tabs)/week-dashboard/index.tsx`, reset actions in More
  and family profile, and `providers/week-start/WeekStartController.tsx`: wiring.
- `ios/WeeklyEats/TodayWidgetBridge.swift`: safe ordered writes and native dedup.
- `ios/TodayWidget/{TodayWidget,WidgetCalendarSnapshot}.swift`: one-snapshot
  timeline generation, date/outcome selection, and diagnostics. The existing
  filesystem-synchronized Xcode target automatically includes the new Swift file.

## Automated verification

Run the relevant JavaScript checks:

```sh
npx jest __tests__/widgetSync.test.ts __tests__/widgetCoordinator.test.tsx __tests__/todayWidgetPlan.test.ts __tests__/widgetRecipe.test.tsx stores/__tests__/weekPlanStorage.test.ts --runInBand
```

Run the Foundation-only native fixtures with an installed Swift toolchain:

```sh
swiftc ios/TodayWidget/WidgetCalendarSnapshot.swift scripts/test-widget-calendar.swift -o /tmp/weeklyeats-widget-calendar-test
/tmp/weeklyeats-widget-calendar-test
```

The native assertions exercise the actual Swift selection/timeline code for
Monday→Tuesday with no app execution, missing days, replacement, all outcomes,
undo, tomorrow edits, Eat Out/Flex Night, four timezones, DST, invalid dates, and
independent device payloads. JavaScript checks cover saved storage mutations,
queued/redundant/stale syncs, read/write errors, read-only getters, and app lifecycle.

This run: 31 focused JavaScript tests passed; the 18 snapshot/sync tests also
passed separately under Phoenix, New York, and Tokyo process timezones. All 76
native calendar assertions passed. The full widget source type-checked against
the iOS simulator SDK; the bridge type-checked with temporary React promise type
declarations. App Group entitlements and the Xcode project passed plist validation.
The wider run passed 332 tests in 44 suites, with one Meals-screen suite blocked
by an `expo-haptics` test-loader error. TypeScript still reports the three
pre-existing errors in DayPlannedToast, PlanDayChoiceStep, and theme types.

## Physical two-iPhone checklist

Install a rebuilt app **and widget extension** on each device; a JS refresh alone
does not install the native changes. Give each phone different Monday/Tuesday
plans and add both small and medium widgets.

1. Confirm Monday selects each phone's own Meal A. Capture debug metadata.
2. Swap Monday to another meal; confirm replacement, sides, and prep notes.
3. Mark served, undo, mark Had Something Different, Eat Out, Flex Night, and Skip.
   Confirm the existing outcome/tomorrow UX and no stale outcome on replacement.
4. Change only Tuesday: Monday must remain primary until resolved/midnight.
5. Leave the app unopened overnight, preferably using a real midnight rather
   than the app's simulated-date controls. Confirm Tuesday's prebuilt entry.
6. Open the app Tuesday morning, including directly into Meals or More. Confirm
   the new sync still selects Tuesday and does not restore Monday.
7. Change the phone timezone across a date boundary. Capture the widget provider
   logs if/when iOS reloads, then resume the app and verify immediate resync request.
8. Repeat independently on the other phone. App Group defaults are per-device
   local data, not a cross-device synchronization service.

## Remaining limits

WidgetKit controls execution/redraw timing. Reload requests are requests, not an
exact delivery guarantee; budget, low power, visibility and system scheduling can
delay them. Prebuilt midnight entries avoid requiring main-app execution, but an
immediate redraw after travel/timezone changes still depends on iOS refreshing
the timeline. App resume is the fallback. See Apple's
[Keeping a widget up to date](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date).

The widget cannot invent an unsaved future plan. An undated legacy plan is not
assigned to the current week by guesswork. A legacy week ID can be ambiguous if
the week-start preference changed before local-date metadata was introduced;
re-saving that plan with the intended week confirms its date metadata.

Physical-phone timing, signing/entitlements in an installed build, and overnight
delivery require the checklist above. Automated fixtures and Swift type checking
do not substitute for those device checks.
