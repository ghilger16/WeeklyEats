import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert, DeviceEventEmitter, Linking, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { buildSchedule, COPY, DAYS, defaults, Preferences } from './schedule';

export const NOTIFICATIONS_CHANGED = 'weeklyeats.notifications.changed';
export const PREFERENCES_KEY = 'weeklyeats.notificationPreferences';
const RECORDS_KEY = 'weeklyeats.notificationSchedule';
const RECOVERED_KEY = 'weeklyeats.notificationRecoveryCycles';
const PREFIX = 'weeklyeats.reminder.';
export const notifyReminderDataChanged = () => DeviceEventEmitter.emit(NOTIFICATIONS_CHANGED);
export function notificationAPI(): typeof import('expo-notifications') | null {
  if (Platform.OS === 'web' || !requireOptionalNativeModule('ExpoNotificationPermissionsModule')) return null;
  return require('expo-notifications');
}
export async function getPreferences(): Promise<Preferences> {
  const raw = await AsyncStorage.getItem(PREFERENCES_KEY);
  try { return { ...defaults, ...(raw ? JSON.parse(raw) : {}) }; } catch { return { ...defaults }; }
}
export async function savePreferences(patch: Partial<Preferences>) {
  const next = { ...await getPreferences(), ...patch };
  await AsyncStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
  notifyReminderDataChanged(); return next;
}
export async function permissionStatus() {
  const api = notificationAPI();
  if (!api) return 'unavailable';
  const p = await api.getPermissionsAsync();
  return p.granted || p.ios?.status === api.IosAuthorizationStatus.PROVISIONAL ? 'granted' : p.status;
}
export async function openNotificationSettings() {
  if (Platform.OS === 'web') return;
  try { await Linking.openSettings(); }
  catch { Alert.alert('Open device settings', 'You can turn on notifications for Weekly Eats in your device settings.'); }
}
export async function enableReminders() {
  const api = notificationAPI();
  if (!api) {
    console.warn('[Notifications] Native notification module unavailable; platform:', Platform.OS);
    Alert.alert('Notifications unavailable', 'Notifications aren’t available in this version of the app. Please update Weekly Eats and try again.');
    return;
  }
  if (Platform.OS === 'android') await api.setNotificationChannelAsync('weekly-planning', { name: 'Weekly planning', importance: api.AndroidImportance.DEFAULT });
  let status = await permissionStatus();
  if (status === 'denied') {
    Alert.alert('Notifications are disabled', 'Enable Weekly Eats notifications in your device settings.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => { void openNotificationSettings(); } },
    ]); return;
  }
  if (status !== 'granted') {
    // A failed native call is not a denial. Allow an explicit retry while
    // the OS still reports undetermined permission.
    await api.requestPermissionsAsync();
    await savePreferences({ permissionRequested: true });
    status = await permissionStatus();
  }
  await savePreferences({ enabled: status === 'granted' });
}
export async function offerRemindersAfterPlanning(test = false) {
  if (!notificationAPI()) return;
  const prefs = await getPreferences();
  if (!test && (prefs.explainerSeen || prefs.enabled)) return;
  if (!test) await savePreferences({ explainerSeen: true });
  Alert.alert('Want a reminder next week?', 'Weekly Eats can remind you when it’s time to plan and when your grocery list is ready.', [
    { text: 'Not Now', style: 'cancel' },
    { text: 'Turn On Reminders', onPress: () => { void enableReminders().catch(error => {
      console.warn('[Notifications] Permission setup failed', error);
      Alert.alert('Couldn’t turn on reminders', 'Please try again in More → Notifications.');
    }); } },
  ]);
}
type RecordEntry = { kind: string; cycle: string; timestamp: number };
let queue: Promise<void> = Promise.resolve();
export function refreshScheduledNotifications() {
  queue = queue.catch(() => {}).then(reconcile);
  return queue;
}
async function reconcile() {
  const api = notificationAPI(); if (!api) return;
  const now = new Date();
  const [prefs, day, planRaw, recordsRaw, recoveredRaw, scheduled, status] = await Promise.all([
    getPreferences(), AsyncStorage.getItem('weeklyeats.weekStartDay'),
    AsyncStorage.getItem('@weeklyeats/weekPlanByWeek'), AsyncStorage.getItem(RECORDS_KEY),
    AsyncStorage.getItem(RECOVERED_KEY), api.getAllScheduledNotificationsAsync(), permissionStatus(),
  ]);
  const records: Record<string, RecordEntry> = JSON.parse(recordsRaw ?? '{}');
  const recovered: string[] = JSON.parse(recoveredRaw ?? '[]');
  for (const entry of Object.values(records)) {
    if (entry.kind === 'missed' && entry.timestamp <= now.getTime() && !recovered.includes(entry.cycle)) recovered.push(entry.cycle);
  }
  await AsyncStorage.setItem(RECOVERED_KEY, JSON.stringify(recovered));
  const startDay = DAYS.find(value => value === day) ?? 'mon';
  const desired = buildSchedule({ ...prefs, enabled: prefs.enabled && status === 'granted' }, startDay,
    DAYS.some(value => value === day), JSON.parse(planRaw ?? '{}'), now, recovered);
  for (const existing of scheduled.filter(item => item.identifier.startsWith(PREFIX))) {
    const match = desired.find(item => item.id === existing.identifier);
    if (!match || records[existing.identifier]?.timestamp !== match.date.getTime())
      await api.cancelScheduledNotificationAsync(existing.identifier);
  }
  const next: Record<string, RecordEntry> = {};
  for (const reminder of desired) {
    const timestamp = reminder.date.getTime();
    if (!scheduled.some(item => item.identifier === reminder.id) || records[reminder.id]?.timestamp !== timestamp) {
      await api.scheduleNotificationAsync({ identifier: reminder.id,
        content: { ...COPY[reminder.kind], data: { weeklyEatsReminder: true, screen: reminder.kind === 'shopping' ? 'grocery' : 'week-dashboard' } },
        trigger: { type: api.SchedulableTriggerInputTypes.DATE, date: reminder.date, channelId: 'weekly-planning' },
      });
    }
    next[reminder.id] = { kind: reminder.kind, cycle: reminder.cycle, timestamp };
    // Persist after each scheduling operation so a later failure cannot lose the recovery ledger.
    await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify({ ...records, ...next }));
  }
  await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(next));
}

// Explicit developer tests bypass plan eligibility without changing reminder preferences.
export async function scheduleTestNotification(kind: keyof typeof COPY) {
  if (!__DEV__) return false;
  const api = notificationAPI();
  if (!api) throw new Error('Notification support is missing from this installed app. Rebuild and install Weekly Eats first.');
  if (await permissionStatus() !== 'granted') {
    Alert.alert('Turn on notifications first', 'Enable notifications in More → Notifications, then try this test again.');
    return false;
  }
  if (Platform.OS === 'android') await api.setNotificationChannelAsync('weekly-planning', { name: 'Weekly planning', importance: api.AndroidImportance.DEFAULT });
  const identifier = 'weeklyeats.test.' + kind;
  await api.cancelScheduledNotificationAsync(identifier);
  await api.scheduleNotificationAsync({
    identifier,
    content: { ...COPY[kind], data: { weeklyEatsReminder: true, notificationTest: true, screen: kind === 'shopping' ? 'grocery' : 'week-dashboard' } },
    trigger: { type: api.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, repeats: false, channelId: 'weekly-planning' },
  });
  return true;
}
