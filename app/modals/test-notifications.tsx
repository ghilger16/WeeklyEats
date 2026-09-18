import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Redirect, useRouter } from 'expo-router';
import SettingsRow from '../../components/settings/SettingsRow';
import { useThemeController } from '../../providers/theme/ThemeController';
import { COPY } from '../../services/notifications/schedule';
import { notificationAPI, offerRemindersAfterPlanning, scheduleTestNotification } from '../../services/notifications/service';

export default function TestNotifications() {
  const router = useRouter();
  const { theme } = useThemeController();
  const [busy, setBusy] = useState(false);
  if (!__DEV__) return <Redirect href="/(tabs)/more" />;
  const run = async (kind: keyof typeof COPY | 'permission') => {
    if (busy) return;
    setBusy(true);
    try {
      if (kind === 'permission') {
        if (!notificationAPI()) throw new Error('Rebuild and install Weekly Eats to include notification support.');
        await offerRemindersAfterPlanning(true);
      } else if (await scheduleTestNotification(kind)) {
        Alert.alert('Test scheduled', 'Your notification will arrive in 5 seconds. You can return to the Home Screen to test background delivery.');
      }
    } catch (error) {
      console.warn('[Notifications] Test failed', error);
      Alert.alert('Notification test failed', error instanceof Error ? error.message : 'Please try again.');
    } finally { setBusy(false); }
  };
  return <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.bg }}>
    <ScrollView contentContainerStyle={{ padding: 24, gap: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <Text style={{ color: theme.color.ink, fontSize: 24, fontWeight: '700', flex: 1 }}>Test Notifications</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={10}><Text style={{ color: theme.color.accent }}>Done</Text></Pressable>
      </View>
      <Text style={{ color: theme.color.subtleInk }}>Send a reminder in 5 seconds, regardless of your plan or reminder schedule. Notifications must be allowed first.</Text>
      <View pointerEvents={busy ? 'none' : 'auto'} style={{ gap: 12, opacity: busy ? 0.5 : 1 }}>
        <SettingsRow icon="calendar-outline" label="Planning Reminder" onPress={() => void run('planning')} />
        <SettingsRow icon="cart-outline" label="Shopping Reminder" onPress={() => void run('shopping')} />
        <SettingsRow icon="calendar-clock" label="Missed Planning Reminder" onPress={() => void run('missed')} />
        <SettingsRow icon="bell-outline" label="Show Permission Prompt" onPress={() => void run('permission')} />
      </View>
      <Text style={{ color: theme.color.subtleInk }}>The permission test shows the in-app explainer again. Your device controls whether the system permission dialog can appear again.</Text>
    </ScrollView>
  </SafeAreaView>;
}
