import { buildSchedule, defaults, DAYS } from '../schedule';
import { createEmptyCurrentPlannedWeek } from '../../../types/weekPlan';
const p = { ...defaults, enabled: true };
const now = new Date(2026, 8, 17, 8); // Thursday, before Friday shopping cycle.
const cycle = new Date(2026, 8, 18).toISOString().slice(0, 10);
const current = (plans = {}, prefs = p, date = now, recovered: string[] = []) =>
  buildSchedule(prefs, 'fri', true, plans, date, recovered).filter(r => r.cycle === cycle);
it('derives planning day from shopping day and defaults to 9am local', () => {
  const reminder = current().find(r => r.kind === 'planning')!;
  expect(reminder.date.getDay()).toBe(4); expect(reminder.date.getHours()).toBe(9);
});
it('does not send shopping without saved plan', () => expect(current().map(r => r.kind)).toEqual(['planning', 'missed']));
it('cancels planning and recovery for a completed week, sends shopping', () => {
  const plan = createEmptyCurrentPlannedWeek({ weekedPlanned: true }); DAYS.forEach(day => plan[day] = 'meal');
  expect(current({ [cycle]: plan }).map(r => r.kind)).toEqual(['shopping']);
});
it('requires configured shopping day', () => {
  const plan = { ...createEmptyCurrentPlannedWeek({ weekedPlanned: true }), fri: 'meal' };
  expect(buildSchedule(p, 'fri', false, { [cycle]: plan }, now).some(r => r.kind === 'shopping')).toBe(false);
});
it('respects category and master toggles', () => {
  expect(current({}, { ...p, enabled: false })).toEqual([]);
  expect(current({}, { ...p, planningReminderEnabled: false, missedPlanningReminderEnabled: false })).toEqual([]);
});
it('never repeats recovery for a recorded cycle even after day changes', () => {
  expect(current({}, { ...p, planningReminderDay: 4 }, now, [cycle]).some(r => r.kind === 'missed')).toBe(false);
});
it('preserves partial first week completion without nagging about past days', () => {
  const plan = { ...createEmptyCurrentPlannedWeek({ weekedPlanned: true, plannedScope: 'remaining' }), mon: 'meal' };
  expect(current({ [cycle]: plan }).some(r => r.kind === 'missed')).toBe(false);
});
it('requires at least two unplanned useful days for recovery', () => {
  const plan = createEmptyCurrentPlannedWeek(); DAYS.forEach(day => plan[day] = 'meal'); plan.thu = null;
  expect(current({ [cycle]: plan }).some(r => r.kind === 'missed')).toBe(false);
});
it('does not enqueue reminders in the past and keeps identifiers stable', () => {
  const later = new Date(2026, 8, 19, 10);
  expect(current({}, p, later)).toEqual([]);
  expect(current().map(r => r.id)).toEqual(current().map(r => r.id));
});
it('uses the requested time and weekday', () => {
  const reminder = current({}, { ...p, planningReminderDay: 5, planningReminderTime: '16:45' }).find(r => r.kind === 'planning')!;
  expect(reminder.date.getDay()).toBe(5); expect(reminder.date.getHours()).toBe(16); expect(reminder.date.getMinutes()).toBe(45);
});

it('recovery uses 11am the following day independently of planning time', () => {
  const result = current({}, { ...p, planningReminderTime: '18:45' });
  const planning = result.find(r => r.kind === 'planning')!;
  const recovery = result.find(r => r.kind === 'missed')!;
  expect(recovery.date.getDate()).toBe(planning.date.getDate() + 1);
  expect(recovery.date.getHours()).toBe(11);
  expect(recovery.date.getMinutes()).toBe(0);
});
