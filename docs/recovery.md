# Backup and widget recovery

Open **More → Backup & Recovery**. A **Restore Backup** link on the first onboarding step also makes backups accessible after a fresh installation.

## Recovery on an existing TestFlight installation

1. Install the recovery build as an update to the existing app, without deleting it.
2. Export Backup and choose Save to Files. Save outside the app, for example in iCloud Drive. Dismissing the share sheet does not mean the file was saved.
3. Use Check Backup File to reopen that saved file. This checks format, completeness, and integrity without changing app data.
4. Try Repair Widget. This rebuilds the widget snapshot from saved meals/plans and forces a native write and WidgetKit reload request. iOS still controls when it displays the refresh. Remove/re-add the widget if needed.
5. Only consider deleting the app after validating the backup and testing restore on disposable data. Prefer retaining the existing installation while investigating any remaining widget failure.

## Restore behavior

Restore replaces the supported meal, planning, history, grocery, family, onboarding, and preference keys; it does not merge. It excludes passwords, purchase state, analytics IDs, debug overrides, and device-specific notification records. Backups contain readable personal data and are not encrypted.

After confirmation, the app stages the backup and restarts using Expo's release-capable reload API. Startup applies the restore before mounting data providers/screens, avoiding stale module caches. It saves a pre-restore copy, journals the old data, writes the backup, verifies every supported key, and commits. If interrupted before commit, the next startup rolls back. Failed rollback blocks normal app startup so partial data cannot be edited. The pre-restore copy can be exported from the recovery screen; it is local and is itself lost on app deletion.

The versioned JSON format stores raw values to avoid lossy migration during backup. All supported keys must be present (null means absent). A checksum detects accidental file edits/truncation; it is not a security signature. File imports/exports are limited to 20 MB. Adding persistent user data requires updating BACKUP_KEYS and the backup format/version strategy.

## Native verification before release

A new native build is required for expo-document-picker and the repairPayload bridge method. An OTA JavaScript update alone is insufficient. Install CocoaPods dependencies before a local build. Do not regenerate the existing iOS project with a clean prebuild: it contains the custom widget extension.

On a disposable installation/device:

- Update over an existing installation with meals, both planned weeks, sides, history, grocery checks, family ratings, and custom preferences. Confirm those survive the update.
- Export to Files, cancel one export, and verify that neither is reported as definitely saved. Reopen the saved JSON with Check Backup File.
- Change the disposable data, restore the original backup, and verify counts and details after restart. Export and verify the pre-restore copy too.
- Restore after a clean install using the onboarding link, without first completing onboarding. Purchases remain managed separately through Restore Purchases.
- Cancel the picker and restore confirmation. Neither should change stored data.
- Try a truncated/edited JSON file: reject it before changing data.
- Repair an unchanged widget snapshot, then change a meal and repair again. Check light/dark mode, widget removal/re-addition, and an app restart.
- Check that a missing app-group entitlement reports a repair failure rather than success.

Automated coverage includes exact key round trips, secret exclusions, absent-key replacement, integrity rejection, partial-write rollback, interrupted-restore rollback, UI confirmation/cancellation behavior, and forced refresh requests during in-flight saves.
