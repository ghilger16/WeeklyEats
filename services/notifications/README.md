# Weekly Eats local reminders

Preferences are stored in AsyncStorage at `weeklyeats.notificationPreferences`.
Scheduled identifiers/timestamps are stored at `weeklyeats.notificationSchedule`;
`weeklyeats.notificationRecoveryCycles` remembers recovery cycles that have fired.
The existing `weeklyeats.weekStartDay` remains the sole shopping/week-start setting.
No permission prompt occurs during initialization.

- Planning defaults to 9am the day before the week starts. An explicit day override
  and time can be set in More → Notifications. A completed week cancels its reminder.
- Shopping uses the existing shopping/week-start day at 9am (time configurable).
  It requires that setting to be persisted and a saved plan (`weekedPlanned`) with
  at least one assigned dinner for that cycle.
- Recovery is the following day at 11 AM local time. It requires at least
  two unplanned days remaining at delivery, no saved completed plan, and no previous
  recovery for that cycle. Past-only gaps do not count. Past triggers are not replayed.
- Plan saves, batches, clear/reset operations, preference changes, week-start changes,
  foregrounding, and local date/timezone changes while active reconcile schedules.
  Deterministic identifiers prevent duplicates; unrelated notifications are untouched.
- After the planning success celebration closes, a one-time explainer offers consent.
  Only “Turn On Reminders” requests permission. Denial directs users to OS settings.
- Notification taps open the Week Dashboard or Grocery List.

Scheduling is local, with the current cycle and four future cycles queued as one-shot
notifications. Eligibility is evaluated from the latest locally saved state at each
refresh. OS delivery does not execute JavaScript to recheck it. Without reopening the
app, schedules expire after that horizon; timezone changes while terminated are picked
up at the next foreground. This avoids perpetual conditional repeating notifications.
On Android, the OS may deliver reminders inexactly under power-saving restrictions.

Added SDK 54 `expo-notifications` and its Expo config plugin, then ran `pod install`.
A rebuilt native app is required. Older binaries gracefully disable reminders instead of
importing a missing native module. No push token, backend, or remote push setup is used.
