import { buildTodayWidgetPayload, widgetDateKey } from '../utils/todayWidgetPlan';
import type { WeekPlanDay } from '../hooks/useCurrentWeekPlan';
import { addDays } from '../utils/weekDays';
const now = new Date(2026, 8, 16, 12);
const day = (offset: number, title?: string): WeekPlanDay => {
  const date = addDays(now, offset); date.setHours(0, 0, 0, 0);
  return { key: 'wed', label: 'WED', displayName: 'Wednesday', status: 'upcoming',
    plannedDate: date, plannedDateISO: date.toISOString(), mealId: title ?? null,
    meal: title ? { id: title, title, emoji: '🍝' } as WeekPlanDay['meal'] : undefined,
    sides: title ? ['Green Beans'] : [] };
};
it('keeps today unplanned even when tomorrow has a meal', () => {
  const payload = buildTodayWidgetPayload([day(0), day(1, 'Alfredo')], [], now);
  expect(payload.today.title).toBe('No Plans');
  expect(payload.today.isPlanned).toBe(false);
  expect(payload.tomorrow?.title).toBe('Alfredo');
  expect(payload.plannedMeals?.map(meal => meal.title)).toEqual(['Alfredo']);
});
it('keeps a later meal in the dated snapshot, never the today or tomorrow slot', () => {
  const payload = buildTodayWidgetPayload([day(0)], [day(5, 'Pizza')], now);
  expect(payload.today.title).toBe('No Plans');
  expect(payload.tomorrow).toBeUndefined();
  expect(payload.plannedMeals?.[0].dateKey).toBe(widgetDateKey(addDays(now, 5)));
});
it('provides a deliberate no-plan state when both weeks are empty', () => {
  const payload = buildTodayWidgetPayload([], [], now);
  expect(payload.today.icon).toBe('custom:no-plans');
  expect(payload.plannedMeals).toEqual([]);
});
it('preserves today, its sides and its served outcome', () => {
  const payload = buildTodayWidgetPayload([day(0, 'Tacos'), day(1, 'Pizza')], [], now, 'served');
  expect(payload.today.title).toBe('Tacos');
  expect(payload.today.sides).toEqual(['Green Beans']);
  expect(payload.todayOutcome).toBe('served');
  expect(payload.tomorrow?.title).toBe('Pizza');
});
it('does not attach a served outcome to an unplanned today', () => {
  expect(buildTodayWidgetPayload([day(0)], [], now, 'served').todayOutcome).toBeUndefined();
});
it('resolves the same snapshot across rollover without retaining yesterday or promoting future dinners', () => {
  const days = [day(0, 'Tacos'), day(2, 'Soup')];
  expect(buildTodayWidgetPayload(days, [], addDays(now, 1)).today.title).toBe('No Plans');
  expect(buildTodayWidgetPayload(days, [], addDays(now, 2)).today.title).toBe('Soup');
  expect(buildTodayWidgetPayload(days, [], addDays(now, 3)).today.title).toBe('No Plans');
});
it('includes next-week meals at the current-week boundary and sorts them by date', () => {
  const payload = buildTodayWidgetPayload([day(0)], [day(3, 'Soup'), day(1, 'Pizza')], now);
  expect(payload.plannedMeals?.map(meal => meal.title)).toEqual(['Pizza', 'Soup']);
  expect(payload.tomorrow?.title).toBe('Pizza');
});
it('records the local calendar day independently of UTC date', () => {
  const localMidnight = new Date(2026, 8, 16, 0, 0);
  expect(widgetDateKey(localMidnight)).toBe('2026-09-16');
});
