import { useRef, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { reloadAppAsync } from "expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import SettingsRow from "../../components/settings/SettingsRow";
import { useThemeController } from "../../providers/theme/ThemeController";
import { backupMealCount, captureBackup, parseBackup, PREVIOUS_BACKUP_KEY, stageRestore } from "../../services/recovery/backup";
import { exportBackupFile, pickBackupFile } from "../../services/recovery/backupFiles";
import { repairWidget } from "../../services/widget/syncWidgetState";

function confirmRestore(date: string, count: number): Promise<boolean> {
  return new Promise(resolve => Alert.alert("Replace saved data?",
    `Backup from ${new Date(date).toLocaleString()} with ${count} meals. This replaces your meals, plans, history, family details, and preferences. A copy of your current data will be kept. WeeklyEats will restart.`,
    [{ text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Restore & Restart", style: "destructive", onPress: () => resolve(true) }],
    { cancelable: false }));
}
export default function RecoveryScreen() {
  const { theme } = useThemeController();
  const router = useRouter();
  const lock = useRef(false);
  const [busy, setBusy] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [restartFailed, setRestartFailed] = useState(false);
  const run = async (action: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await action(); }
    catch (error) { Alert.alert("Recovery action couldn’t finish", error instanceof Error ? error.message : "Please try again."); }
    finally { lock.current = false; setBusy(false); }
  };
  const restart = async () => {
    setRestartFailed(false);
    try { await reloadAppAsync("Restore WeeklyEats backup"); }
    catch { setRestartFailed(true); }
  };
  const exportCurrent = () => run(async () => {
    await exportBackupFile(await captureBackup());
    Alert.alert("Check your saved backup", "If you saved the file, confirm it appears in Files—preferably iCloud Drive or another location outside WeeklyEats. You can use Check Backup File below before deleting anything. Closing the share sheet does not save a backup.");
  });
  const restore = () => run(async () => {
    const backup = await pickBackupFile();
    if (!backup || !await confirmRestore(backup.createdAt, backupMealCount(backup))) return;
    await stageRestore(backup);
    setRestarting(true);
    await restart();
  });
  const muted = { color: theme.color.subtleInk, fontSize: 15, lineHeight: 22 };
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.bg }}>
    <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }}>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => router.back()}><Text style={{ color: theme.color.accent, fontSize: 17 }}>Done</Text></Pressable>
      <Text accessibilityRole="header" style={{ color: theme.color.ink, fontSize: 28, fontWeight: "700" }}>Backup & Recovery</Text>
      <Text style={muted}>Save a backup before reinstalling. Backups contain your meals, plans, history, family details, and preferences. Keep them private; they are not encrypted. Passwords and purchases are not included.</Text>
      <SettingsRow icon="export-variant" label="Export Backup" subtitle="Choose Save to Files in the share sheet" onPress={busy ? undefined : exportCurrent} />
      <SettingsRow icon="file-check-outline" label="Check Backup File" subtitle="Verify a saved file without changing your data" onPress={busy ? undefined : () => void run(async () => {
        const backup = await pickBackupFile();
        if (backup) Alert.alert("Backup verified", `${backupMealCount(backup)} meals • ${new Date(backup.createdAt).toLocaleString()}\n\nThe file is complete and its integrity check passed. Your app data was not changed.`);
      })} />
      <SettingsRow icon="backup-restore" label="Restore Backup" subtitle="Replace saved data from a backup file" onPress={busy ? undefined : restore} />
      <SettingsRow icon="history" label="Export Pre-Restore Backup" subtitle="Save the copy kept before your last restore" onPress={busy ? undefined : () => void run(async () => {
        const previous = await AsyncStorage.getItem(PREVIOUS_BACKUP_KEY);
        if (!previous) { Alert.alert("No previous restore", "A recovery copy is created when you restore a backup."); return; }
        await exportBackupFile(parseBackup(previous));
      })} />
      {Platform.OS === "ios" ? <SettingsRow icon="widgets-outline" label="Repair Widget" subtitle="Rebuild widget data and request a refresh" onPress={busy ? undefined : () => void run(async () => {
        await repairWidget();
        Alert.alert("Widget refresh requested", "Your widget data was rebuilt. iOS controls when the widget updates. If it stays frozen, remove the widget from your Home Screen and add it again. Your meals and plans were not changed.");
      })} /> : null}
      {busy ? <Text accessibilityLiveRegion="polite" style={muted}>Working…</Text> : null}
    </ScrollView>
    <Modal visible={restarting} animationType="fade" onRequestClose={() => {}}>
      <SafeAreaView style={{ flex: 1, justifyContent: "center", padding: 32, gap: 24, backgroundColor: theme.color.bg }}>
        <Text style={{ color: theme.color.ink, fontSize: 22 }}>Restart to finish restoring</Text>
        <Text style={muted}>{restartFailed ? "Automatic restart failed. Close WeeklyEats from the app switcher, then reopen it. Your backup will be restored before the app opens." : "WeeklyEats is restarting. If this screen remains, close the app from the app switcher and reopen it to finish."}</Text>
        <Pressable accessibilityRole="button" onPress={() => void restart()}><Text style={{ color: theme.color.accent, fontSize: 18 }}>Restart WeeklyEats</Text></Pressable>
      </SafeAreaView>
    </Modal>
  </SafeAreaView>;
}
