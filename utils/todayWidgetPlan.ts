import type { WeekPlanDay } from '../hooks/useCurrentWeekPlan';
import type { TodayWidgetMeal, TodayWidgetPayload } from '../stores/todayWidgetStorage';
import { addDays, formatWeekdayDate, startOfDay } from './weekDays';

export const widgetDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export function buildTodayWidgetPayload(
  days: WeekPlanDay[], nextWeekDays: WeekPlanDay[], now: Date,
  outcome?: TodayWidgetPayload['todayOutcome'],
): TodayWidgetPayload {
  const plannedMeals: TodayWidgetMeal[] = [...days, ...nextWeekDays]
    .filter(day => Boolean(day.mealId && day.meal))
    .map(day => ({
      mealId: day.mealId!, isPlanned: true,
      dateISO: day.plannedDateISO, dateKey: widgetDateKey(day.plannedDate),
      title: day.meal!.title, icon: day.meal!.emoji || '🍽️',
      dateLabel: formatWeekdayDate(day.plannedDate), sides: day.sides,
      prepNote: day.meal!.prepNotes?.trim() || undefined,
      recipeUrl: day.meal!.recipeUrl?.trim() || undefined,
    }))
    .sort((a, b) => a.dateKey!.localeCompare(b.dateKey!));
  const todayKey = widgetDateKey(now);
  const today = plannedMeals.find(meal => meal.dateKey === todayKey);
  return {
    generatedAtISO: now.toISOString(), plannedMeals,
    today: today ?? {
      dateISO: startOfDay(now).toISOString(), dateKey: todayKey,
      title: 'No Plans', icon: 'custom:no-plans', dateLabel: formatWeekdayDate(now),
      sides: [], isPlanned: false,
    },
    tomorrow: plannedMeals.find(meal => meal.dateKey === widgetDateKey(addDays(now, 1))),
    todayOutcome: today ? outcome : undefined,
  };
}
