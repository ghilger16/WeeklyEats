import { CurrentPlannedWeek, PlannedWeekDayKey } from '../../types/weekPlan';
import { addDays, getWeekStartForDate, startOfDay, WEEK_DAY_TO_INDEX } from '../../utils/weekDays';

export const DAYS: PlannedWeekDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export type Preferences = {
  enabled: boolean; planningReminderEnabled: boolean; planningReminderDay?: number;
  planningReminderTime: string; shoppingReminderEnabled: boolean;
  shoppingReminderTime: string; missedPlanningReminderEnabled: boolean;
  explainerSeen: boolean; permissionRequested: boolean;
};
export const defaults: Preferences = {
  enabled: false, planningReminderEnabled: true, planningReminderTime: '09:00',
  shoppingReminderEnabled: true, shoppingReminderTime: '09:00',
  missedPlanningReminderEnabled: true, explainerSeen: false, permissionRequested: false,
};
export const COPY = {
  planning: { title: 'Get dinner off your mind', body: 'Plan your week now and make dinner one less thing to think about.' },
  shopping: { title: 'Your grocery list is ready', body: 'Your dinners are planned. Grab what you need for the week in one trip.' },
  missed: { title: 'Still figuring out dinner?', body: 'Plan the rest of your week in a few taps.' },
};
export type Reminder = { id: string; kind: keyof typeof COPY; date: Date; cycle: string };
const atTime = (date: Date, time: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  const result = new Date(date); result.setHours(hours, minutes, 0, 0); return result;
};
export function buildSchedule(p: Preferences, startDay: PlannedWeekDayKey, shoppingConfigured: boolean,
  plans: Record<string, CurrentPlannedWeek>, now: Date, recovered: string[] = []): Reminder[] {
  if (!p.enabled) return [];
  const result: Reminder[] = [];
  const planningDay = p.planningReminderDay ?? (WEEK_DAY_TO_INDEX[startDay] + 6) % 7;
  for (let offset = 0; offset < 5; offset++) {
    const start = addDays(getWeekStartForDate(startDay, now), offset * 7);
    const cycle = start.toISOString().slice(0, 10);
    const plan = plans[cycle];
    const planning = atTime(addDays(start, -((start.getDay() - planningDay + 7) % 7)), p.planningReminderTime);
    const remaining = (date: Date) => Array.from({ length: 7 }, (_, i) => addDays(start, i))
      .filter(day => day >= startOfDay(date));
    const unplanned = (date: Date) => remaining(date).filter(day => !plan?.[DAYS[day.getDay()]]).length;
    const add = (kind: Reminder['kind'], date: Date) => {
      if (date > now) result.push({ id: `weeklyeats.reminder.${kind}.${cycle}`, kind, date, cycle });
    };
    if (p.planningReminderEnabled && unplanned(planning) > 0) add('planning', planning);
    if (p.shoppingReminderEnabled && shoppingConfigured && plan?.weekedPlanned && DAYS.some(day => plan[day]))
      add('shopping', atTime(start, p.shoppingReminderTime));
    const recovery = atTime(addDays(planning, 1), '11:00');
    // One next-day recovery, only when at least two useful days are still unplanned.
    if (p.missedPlanningReminderEnabled && !plan?.weekedPlanned && !recovered.includes(cycle) && unplanned(recovery) >= 2)
      add('missed', recovery);
  }
  return result;
}
