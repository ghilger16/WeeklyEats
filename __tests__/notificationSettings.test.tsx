import '@testing-library/jest-native/extend-expect';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import NotificationSettings from '../app/modals/notifications';
import { defaults } from '../services/notifications/schedule';
import { getPreferences, permissionStatus, savePreferences, openNotificationSettings } from '../services/notifications/service';
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn(async () => 'fri') }));
jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'Icon' }));
jest.mock('@react-native-community/datetimepicker', () => 'TimePicker');
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: require('react-native').View }));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn() }), useFocusEffect: (callback: () => void) => require('react').useEffect(callback, [callback]) }));
jest.mock('../providers/theme/ThemeController', () => ({ useThemeController: () => ({ theme: { color: { bg: 'white', ink: 'black', surfaceAlt: 'gray', accent: 'pink', border: 'gray' }, radius: { lg: 16, xl: 24 } } }) }));
jest.mock('../providers/week-start/WeekStartController', () => ({ useWeekStartController: () => ({ startDay: 'fri' }) }));
jest.mock('../services/notifications/service', () => ({ getPreferences: jest.fn(), permissionStatus: jest.fn(), savePreferences: jest.fn(), openNotificationSettings: jest.fn(), enableReminders: jest.fn() }));
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getPreferences).mockResolvedValue({ ...defaults, enabled: true });
  jest.mocked(permissionStatus).mockResolvedValue('granted');
  jest.mocked(savePreferences).mockImplementation(async patch => ({ ...defaults, enabled: true, ...patch }));
});
it('keeps day controls in the planning sheet and persists edits', async () => {
  const screen = render(<NotificationSettings />);
  const detail = await screen.findByLabelText(/Edit planning reminder: Thursday/);
  await waitFor(() => expect(screen.getByLabelText('Allow Reminders').props.value).toBe(true));
  expect(screen.queryByText('Planning day')).toBeNull();
  fireEvent.press(detail);
  expect(screen.getByText('Planning day')).toBeTruthy();
  fireEvent.press(screen.getByLabelText('Wednesday'));
  await waitFor(() => expect(savePreferences).toHaveBeenCalledWith({ planningReminderDay: 3 }));
});
it('shopping sheet shows the shared day without weekday editing', async () => {
  const screen = render(<NotificationSettings />);
  await waitFor(() => expect(screen.getByLabelText('Allow Reminders').props.value).toBe(true));
  fireEvent.press(screen.getByLabelText(/Edit shopping reminder: Friday/));
  expect(screen.getByText('Shopping day follows your week settings.')).toBeTruthy();
  expect(screen.queryByLabelText('Wednesday')).toBeNull();
});
it('master off disables child switches and detail rows without deleting preferences', async () => {
  jest.mocked(getPreferences).mockResolvedValue(defaults);
  const screen = render(<NotificationSettings />);
  await screen.findByLabelText(/Edit planning reminder: Thursday/);
  for (const title of ['Planning Reminder', 'Shopping Reminder', 'Missed Planning Reminder']) {
    expect(screen.getByLabelText(title)).toBeDisabled();
    expect(screen.getByLabelText(title).props.value).toBe(false);
  }
  fireEvent.press(screen.getByLabelText(/Edit planning reminder:/));
  expect(screen.queryByText('Planning day')).toBeNull();
  expect(savePreferences).not.toHaveBeenCalled();
});
it('denied permission disables children and offers system settings', async () => {
  jest.mocked(permissionStatus).mockResolvedValue('denied' as Awaited<ReturnType<typeof permissionStatus>>);
  const screen = render(<NotificationSettings />);
  await screen.findByText('Notifications are turned off for Weekly Eats.');
  expect(screen.getByLabelText('Planning Reminder')).toBeDisabled();
  fireEvent.press(screen.getByText('Open Settings'));
  expect(openNotificationSettings).toHaveBeenCalled();
});

it('explains unavailable notifications instead of silently disabling the master switch', async () => {
  jest.mocked(permissionStatus).mockResolvedValue('unavailable');
  const screen = render(<NotificationSettings />);
  await screen.findByText('Notifications aren’t available in this version of the app.');
  expect(screen.getByLabelText('Allow Reminders')).not.toBeDisabled();
  expect(screen.getByLabelText('Allow Reminders').props.value).toBe(false);
  expect(screen.getByLabelText('Planning Reminder')).toBeDisabled();
});
