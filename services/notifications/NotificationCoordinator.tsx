import { useEffect } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import { useRouter } from 'expo-router';
import { notificationAPI, NOTIFICATIONS_CHANGED, refreshScheduledNotifications } from './service';

export default function NotificationCoordinator() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => { void refreshScheduledNotifications().catch(error => console.warn('[Notifications]', error)); };
    refresh();
    const changed = DeviceEventEmitter.addListener(NOTIFICATIONS_CHANGED, refresh);
    const active = AppState.addEventListener('change', state => { if (state === 'active') refresh(); });
    let dayAndZone = '';
    const timer = setInterval(() => {
      const now = new Date(); const key = `${now.toDateString()}/${now.getTimezoneOffset()}`;
      if (AppState.currentState === 'active' && key !== dayAndZone) { dayAndZone = key; refresh(); }
    }, 60_000);
    const api = notificationAPI();
    api?.setNotificationHandler({
      handleNotification: async notification => {
        const showTest = __DEV__ && notification.request.content.data.notificationTest === true;
        return { shouldShowBanner: showTest, shouldShowList: showTest, shouldPlaySound: false, shouldSetBadge: false };
      },
    });
    let lastResponse: string | undefined;
    const navigate = (response: import('expo-notifications').NotificationResponse | null) => {
      const request = response?.notification.request;
      if (!request?.content.data.weeklyEatsReminder || lastResponse === request.identifier) return;
      lastResponse = request.identifier;
      router.push(request.content.data.screen === 'grocery' ? '/(tabs)/grocery-list' : '/(tabs)/week-dashboard');
      void api?.clearLastNotificationResponseAsync();
    };
    const tapped = api?.addNotificationResponseReceivedListener(navigate);
    void api?.getLastNotificationResponseAsync().then(navigate).catch(console.warn);
    return () => { changed.remove(); active.remove(); tapped?.remove(); clearInterval(timer); };
  }, [router]);
  return null;
}
