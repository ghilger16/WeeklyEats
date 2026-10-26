import type { WeekPlanDay } from '../hooks/useCurrentWeekPlan';
import type { TodayWidgetMeal, TodayWidgetPayload } from '../stores/todayWidgetStorage';
import { addDays, formatWeekdayDate, startOfDay } from './weekDays';
import { WEEK_DAY_TO_INDEX } from './weekDays';
import { localDateKey, parseLocalDate, resolvePlanWeekDate } from './widgetCalendar';
import { CurrentPlannedWeek, CurrentWeekSides, PLANNED_WEEK_ORDER, PlannedWeekDayKey } from '../types/weekPlan';
import type { Meal } from '../types/meals';
import type { ServedMealEntry } from '../stores/servedMealsStorage';
import { getSpecialMealById } from '../types/specialMeals';

export const widgetDateKey = localDateKey;

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

export type WidgetSource = {
  plans: Record<string, CurrentPlannedWeek>;
  sides: Record<string, CurrentWeekSides>;
  meals: Meal[];
  servedEntries: ServedMealEntry[];
  startDay: PlannedWeekDayKey;
};

export function buildWidgetSnapshot(source: WidgetSource, now: Date): TodayWidgetPayload {
  const days = new Map<string, WeekPlanDay>();
  const weekDates = new Map<string, string>();
  const minimumDate = localDateKey(addDays(now, -7));
  // Resolve saved weeks, not a dashboard's cached current/next-week models.
  for (const [weekId, plan] of Object.entries(source.plans).sort(([a], [b]) => a.localeCompare(b))) {
    const weekDate = resolvePlanWeekDate(weekId, source.startDay, plan.calendarWeekStartDate);
    const start = weekDate ? parseLocalDate(weekDate) : null;
    if (!start) continue;
    for (const key of PLANNED_WEEK_ORDER) {
      const date = addDays(start, (WEEK_DAY_TO_INDEX[key] - start.getDay() + 7) % 7);
      const dateKey = localDateKey(date);
      if (dateKey < minimumDate) continue;
      const mealId = plan[key];
      const meal = getSpecialMealById(mealId, plan.specialMealTitles?.[key]) ?? source.meals.find((item) => item.id === mealId);
      days.set(dateKey, { key, label: key, displayName: key, plannedDate: date,
        plannedDateISO: date.toISOString(), status: 'upcoming', mealId, meal,
        sides: source.sides[weekId]?.[key] ?? [] });
      weekDates.set(dateKey, weekDate!);
    }
  }
  const outcomesByDate: NonNullable<TodayWidgetPayload['outcomesByDate']> = {};
  for (const entry of source.servedEntries) {
    if (!['served', 'cookedAlt', 'ateOut', 'skipped'].includes(entry.outcome)) continue;
    let dateKey = entry.mealDate;
    if (!dateKey || !parseLocalDate(dateKey)) {
      const date = new Date(entry.servedAtISO);
      if (!Number.isFinite(date.getTime())) continue;
      // Legacy records lack a date-only key. Preserve their recorded weekday
      // when a timezone change shifts the stored midnight by one calendar day.
      const target = WEEK_DAY_TO_INDEX[entry.dayKey];
      const delta = (target - date.getDay() + 7) % 7;
      dateKey = localDateKey(addDays(date, delta === 6 ? -1 : delta === 1 ? 1 : 0));
    }
    if (!days.get(dateKey)?.meal) continue;
    if (!outcomesByDate[dateKey]) outcomesByDate[dateKey] = { mealId: entry.mealId, servedState: entry.outcome };
  }
  const snapshot = buildTodayWidgetPayload([...days.values()], [], now);
  snapshot.today.mealDate = snapshot.today.dateKey;
  snapshot.plannedMeals?.forEach((meal) => {
    meal.mealDate = meal.dateKey;
    meal.weekStartDate = weekDates.get(meal.dateKey!);
    const outcome = outcomesByDate[meal.dateKey!];
    if (outcome && (outcome.mealId === meal.mealId || outcome.mealId === null)) meal.servedState = outcome.servedState;
  });
  return { ...snapshot, todayOutcome: snapshot.today.servedState, schemaVersion: 2,
    snapshotGeneratedAt: now.toISOString(), snapshotDate: localDateKey(now),
    snapshotTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    snapshotUTCOffsetMinutes: now.getTimezoneOffset(), outcomesByDate };
}
