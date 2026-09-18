jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => ({}) }));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(async () => ({ granted: true, status: 'granted' })),
  requestPermissionsAsync: jest.fn(async () => ({ granted: false, status: 'denied' })),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  scheduleNotificationAsync: jest.fn(async ({ identifier }) => identifier),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  IosAuthorizationStatus: { PROVISIONAL: 3 }, SchedulableTriggerInputTypes: { DATE: 'date', TIME_INTERVAL: 'timeInterval' },
}));
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { enableReminders, refreshScheduledNotifications, savePreferences, scheduleTestNotification } from '../service';
import { DAYS } from '../schedule';
import { createEmptyCurrentPlannedWeek } from '../../../types/weekPlan';

beforeEach(async () => {
  jest.useFakeTimers().setSystemTime(new Date(2026, 8, 17, 8));
  await AsyncStorage.clear(); jest.clearAllMocks();
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, status: 'granted' });
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([]);
  await AsyncStorage.setItem('weeklyeats.weekStartDay', 'fri');
  await savePreferences({ enabled: true });
});
afterEach(() => jest.useRealTimers());
const useScheduled = () => {
  const calls = (Notifications.scheduleNotificationAsync as jest.Mock).mock.calls.map(([request]) => ({ identifier: request.identifier }));
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue(calls);
  return calls;
};
it('repeated refreshes do not duplicate notifications', async () => {
  await refreshScheduledNotifications(); const scheduled = useScheduled();
  await refreshScheduledNotifications();
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(scheduled.length);
});
it('disabling cancels only Weekly Eats reminders', async () => {
  await refreshScheduledNotifications(); const scheduled = useScheduled();
  (Notifications.getAllScheduledNotificationsAsync as jest.Mock).mockResolvedValue([...scheduled, { identifier: 'another-feature' }]);
  await savePreferences({ enabled: false }); await refreshScheduledNotifications();
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(scheduled.length);
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('another-feature');
});
it('a saved full next week cancels its planning/recovery and schedules shopping', async () => {
  await refreshScheduledNotifications(); useScheduled();
  const cycle = new Date(2026, 8, 18).toISOString().slice(0, 10);
  const plan = createEmptyCurrentPlannedWeek({ weekedPlanned: true }); DAYS.forEach(day => plan[day] = 'meal');
  await AsyncStorage.setItem('@weeklyeats/weekPlanByWeek', JSON.stringify({ [cycle]: plan }));
  await refreshScheduledNotifications();
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(`weeklyeats.reminder.planning.${cycle}`);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(`weeklyeats.reminder.missed.${cycle}`);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({ identifier: `weeklyeats.reminder.shopping.${cycle}` }));
});
it('does not request permission on refresh or re-request after denial', async () => {
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false, status: 'denied' });
  await refreshScheduledNotifications(); expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
  await savePreferences({ permissionRequested: true }); await enableReminders();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
it('remembers a fired recovery even if the planning day moves later', async () => {
  await refreshScheduledNotifications(); useScheduled();
  jest.setSystemTime(new Date(2026, 8, 18, 12));
  await refreshScheduledNotifications();
  const cycle = new Date(2026, 8, 18).toISOString().slice(0, 10);
  expect(JSON.parse((await AsyncStorage.getItem('weeklyeats.notificationRecoveryCycles'))!)).toContain(cycle);
});

it('allows retry after a failed native permission request without treating it as denial', async () => {
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false, status: 'undetermined' });
  await savePreferences({ enabled: false, permissionRequested: true }); // Older versions could set this before a failed call.
  (Notifications.requestPermissionsAsync as jest.Mock).mockRejectedValueOnce(new Error('Native request failed'));
  await expect(enableReminders()).rejects.toThrow('Native request failed');
  (Notifications.requestPermissionsAsync as jest.Mock).mockImplementationOnce(async () => {
    (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true, status: 'granted' });
    return { granted: true, status: 'granted' };
  });
  await enableReminders();
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(2);
  expect(JSON.parse((await AsyncStorage.getItem('weeklyeats.notificationPreferences'))!).enabled).toBe(true);
});

it('schedules an isolated one-off test without changing reminder preferences', async () => {
  const before = await AsyncStorage.getItem('weeklyeats.notificationPreferences');
  expect(await scheduleTestNotification('shopping')).toBe(true);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('weeklyeats.test.shopping');
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(expect.objectContaining({
    identifier: 'weeklyeats.test.shopping',
    content: expect.objectContaining({ data: expect.objectContaining({ notificationTest: true, screen: 'grocery' }) }),
    trigger: expect.objectContaining({ seconds: 5, repeats: false }),
  }));
  expect(await AsyncStorage.getItem('weeklyeats.notificationPreferences')).toBe(before);
});
it('does not schedule a test when system permission is denied', async () => {
  (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValue({ granted: false, status: 'denied' });
  expect(await scheduleTestNotification('planning')).toBe(false);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
});
