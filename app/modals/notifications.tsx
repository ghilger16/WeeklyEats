import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useRef, useState } from 'react';
import { Alert, AppState, Modal, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useThemeController } from '../../providers/theme/ThemeController';
import { useWeekStartController } from '../../providers/week-start/WeekStartController';
import { PLANNED_WEEK_DISPLAY_NAMES } from '../../types/weekPlan';
import { DAYS, defaults, Preferences } from '../../services/notifications/schedule';
import { enableReminders, getPreferences, openNotificationSettings, permissionStatus, savePreferences } from '../../services/notifications/service';

type Editor = 'planning' | 'shopping';
const timeDate = (time: string) => {
  const date = new Date();
  const [hours, minutes] = time.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
};
const formatTime = (time: string) => timeDate(time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export default function NotificationSettings() {
  const { theme } = useThemeController();
  const router = useRouter();
  const { startDay } = useWeekStartController();
  const permissionChangeInProgress = useRef(false);
  const loadVersion = useRef(0);
  const [prefs, setPrefs] = useState(defaults);
  const [status, setStatus] = useState('');
  const [shoppingConfigured, setShoppingConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [showTime, setShowTime] = useState(false);
  const masterEnabled = prefs.enabled && status === 'granted';
  const disabled = busy || !masterEnabled;
  const planningDay = prefs.planningReminderDay ?? (DAYS.indexOf(startDay) + 6) % 7;
  const shoppingDay = shoppingConfigured ? PLANNED_WEEK_DISPLAY_NAMES[startDay] : 'Choose your shopping day in week settings';
  const timeField = editor === 'planning' ? 'planningReminderTime' : 'shoppingReminderTime';

  const load = useCallback(async () => {
    const version = ++loadVersion.current;
    const [stored, permission, day] = await Promise.all([
      getPreferences(), permissionStatus(), AsyncStorage.getItem('weeklyeats.weekStartDay'),
    ]);
    if (version !== loadVersion.current) return;
    setPrefs(stored);
    setStatus(permission);
    setShoppingConfigured(DAYS.some(value => value === day));
    if (!stored.enabled || permission !== 'granted') setEditor(null);
  }, []);
  useFocusEffect(useCallback(() => {
    void load().catch(error => { console.warn('[Notifications] Loading settings failed', error); setStatus('error'); });
    const listener = AppState.addEventListener('change', state => {
      if (state === 'active' && !permissionChangeInProgress.current) void load().catch(error => { console.warn('[Notifications] Loading settings failed', error); setStatus('error'); });
    });
    return () => listener.remove();
  }, [load]));

  const update = async (patch: Partial<Preferences>) => {
    setBusy(true);
    try { setPrefs(await savePreferences(patch)); }
    catch { Alert.alert('Couldn’t save reminders', 'Please try again.'); }
    finally { setBusy(false); }
  };
  const changeMaster = async (value: boolean) => {
    if (permissionChangeInProgress.current) return;
    permissionChangeInProgress.current = true;
    ++loadVersion.current;
    setBusy(true);
    try {
      if (value) await enableReminders();
      else await savePreferences({ enabled: false });
      await load();
    } catch (error) {
      console.warn('[Notifications] Updating reminder permission failed', error);
      Alert.alert('Couldn’t update reminders', 'Please try again.');
    }
    finally { permissionChangeInProgress.current = false; setBusy(false); }
  };
  const label = { color: theme.color.ink, fontSize: 17 };
  const secondary = { color: theme.color.subtleInk, fontSize: 14 };
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 12 };
  const card = { padding: 16, gap: 6, borderRadius: theme.radius.lg, backgroundColor: theme.color.surfaceAlt };
  const toggle = (title: string, field: 'planningReminderEnabled' | 'shoppingReminderEnabled' | 'missedPlanningReminderEnabled') => (
    <View style={row}>
      <Text style={[label, { flex: 1 }]}>{title}</Text>
      <Switch accessibilityLabel={title} disabled={disabled} trackColor={{ true: theme.color.accent }}
        value={masterEnabled && prefs[field]} onValueChange={value => void update({ [field]: value })} />
    </View>
  );
  const detail = (kind: Editor, text: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${kind} reminder: ${text}`} disabled={disabled}
      onPress={() => { setShowTime(false); setEditor(kind); }} style={[row, { minHeight: 32 }]}>
      <Text style={[secondary, { flex: 1 }]}>{text}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color={theme.color.subtleInk} />
    </Pressable>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 14 }}>
        <View style={row}>
          <Text style={[label, { fontSize: 28, fontWeight: '700' }]}>Notifications</Text>
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={10}><Text style={{ color: theme.color.accent }}>Done</Text></Pressable>
        </View>
        <Text style={[secondary, { marginBottom: 6 }]}>Plan once. Shop once. Let dinner be handled.</Text>
        <View style={card}>
          <View style={row}>
            <Text style={[label, { flex: 1 }]}>Allow Reminders</Text>
            <Switch accessibilityLabel="Allow Reminders" disabled={busy || !status}
              trackColor={{ true: theme.color.accent }} value={masterEnabled} onValueChange={value => void changeMaster(value)} />
          </View>
          {status === 'unavailable' ? <Text style={secondary}>Notifications aren’t available in this version of the app.</Text> : status === 'error' ? <Text style={secondary}>Couldn’t check notification access. Tap Allow Reminders to try again.</Text> : status === 'denied' ? <>
            <Text style={secondary}>Notifications are turned off for Weekly Eats.</Text>
            <Pressable accessibilityRole="button" onPress={() => void openNotificationSettings()} style={{ paddingVertical: 8 }}>
              <Text style={{ color: theme.color.accent }}>Open Settings</Text>
            </Pressable>
          </> : status !== 'granted' && <Text style={secondary}>Turn on notifications to get planning and shopping reminders.</Text>}
        </View>
        <View style={[card, { opacity: masterEnabled ? 1 : 0.45 }]}>
          {toggle('Planning Reminder', 'planningReminderEnabled')}
          {detail('planning', `${PLANNED_WEEK_DISPLAY_NAMES[DAYS[planningDay]]} · ${formatTime(prefs.planningReminderTime)}`)}
        </View>
        <View style={[card, { opacity: masterEnabled ? 1 : 0.45 }]}>
          {toggle('Shopping Reminder', 'shoppingReminderEnabled')}
          {detail('shopping', `${shoppingDay} · ${formatTime(prefs.shoppingReminderTime)}`)}
        </View>
        <View style={[card, { opacity: masterEnabled ? 1 : 0.45 }]}>
          {toggle('Missed Planning Reminder', 'missedPlanningReminderEnabled')}
          <Text style={secondary}>Remind me once if I haven’t planned yet.</Text>
        </View>
      </ScrollView>
      <Modal transparent visible={editor !== null && masterEnabled} animationType="slide" onRequestClose={() => setEditor(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close reminder settings" onPress={() => setEditor(null)} style={{ flex: 1 }} />
          <SafeAreaView edges={['bottom']} style={{ maxHeight: '85%', backgroundColor: theme.color.surface, borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl }}>
            <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
              <View style={{ alignSelf: 'center', width: 48, height: 5, borderRadius: 3, backgroundColor: theme.color.border }} />
              <View style={row}>
                <Text style={[label, { flex: 1, fontSize: 22, fontWeight: '700' }]}>{editor === 'planning' ? 'Planning Reminder' : 'Shopping Reminder'}</Text>
                <Pressable accessibilityRole="button" onPress={() => setEditor(null)} hitSlop={10}><Text style={{ color: theme.color.accent }}>Done</Text></Pressable>
              </View>
              {editor === 'planning' ? <>
                <Text style={secondary}>Planning day</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {DAYS.map((day, index) => (
                    <Pressable key={day} disabled={disabled} accessibilityRole="button" accessibilityLabel={PLANNED_WEEK_DISPLAY_NAMES[day]}
                      accessibilityState={{ selected: planningDay === index }} onPress={() => void update({ planningReminderDay: index })}
                      style={{ padding: 10, minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: planningDay === index ? theme.color.accent : theme.color.border }}>
                      <Text style={{ color: planningDay === index ? theme.color.accent : theme.color.ink }}>{day[0].toUpperCase() + day.slice(1)}</Text>
                    </Pressable>
                  ))}
                </View>
              </> : <>
                <Text style={secondary}>Shopping day</Text>
                <Text style={label}>{shoppingDay}</Text>
                <Text style={secondary}>Shopping day follows your week settings.</Text>
              </>}
              <Pressable accessibilityRole="button" accessibilityLabel="Edit reminder time" disabled={disabled} onPress={() => setShowTime(value => !value)} style={[row, { minHeight: 44 }]}>
                <Text style={label}>Time</Text><Text style={{ color: theme.color.accent }}>{formatTime(prefs[timeField])}</Text>
              </Pressable>
              {showTime && <DateTimePicker value={timeDate(prefs[timeField])} mode="time"
                onChange={(event, value) => {
                  if (Platform.OS !== 'ios') setShowTime(false);
                  if (!disabled && event.type === 'set' && value) void update({ [timeField]: `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}` });
                }} />}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
