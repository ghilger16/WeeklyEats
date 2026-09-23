import { CurrentPlannedWeek, CurrentWeekSides, PlannedWeekDayKey } from "../types/weekPlan";

/** Move to an empty day, or exchange both complete dinners when the destination is occupied. */
export const swapPlannedDays = (
  plan: CurrentPlannedWeek,
  sides: CurrentWeekSides,
  source: PlannedWeekDayKey,
  target: PlannedWeekDayKey,
) => {
  if (source === target || !plan[source]) return { plan, sides };
  const titles = { ...(plan.specialMealTitles ?? {}) };
  delete titles[source];
  delete titles[target];
  if (plan[target] && plan.specialMealTitles?.[target]) titles[source] = plan.specialMealTitles[target];
  if (plan.specialMealTitles?.[source]) titles[target] = plan.specialMealTitles[source];
  return {
    plan: {
      ...plan,
      [source]: plan[target],
      [target]: plan[source],
      specialMealTitles: Object.keys(titles).length ? titles : undefined,
      weekedPlanned: false,
    },
    sides: {
      ...sides,
      [source]: plan[target] ? [...(sides[target] ?? [])] : [],
      [target]: [...(sides[source] ?? [])],
    },
  };
};
