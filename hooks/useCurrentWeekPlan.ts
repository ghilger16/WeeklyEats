import { useCallback, useEffect, useMemo, useState } from "react";
import { Meal } from "../types/meals";
import { useWeekStartController } from "../providers/week-start/WeekStartController";
import {
  CurrentPlannedWeek,
  PLANNED_WEEK_DISPLAY_NAMES,
  PLANNED_WEEK_LABELS,
  PlannedWeekDayKey,
  createEmptyCurrentPlannedWeek,
} from "../types/weekPlan";
import { getCurrentWeekPlan } from "../stores/weekPlanStorage";
import { useMeals } from "./useMeals";
import {
  addDays,
  getWeekStartForDate,
  startOfDay,
} from "../utils/weekDays";

const isSameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

const matchMeal = (meals: Meal[], mealId: string | null | undefined) =>
  mealId ? meals.find((meal) => meal.id === mealId) : undefined;

export type WeekPlanDay = {
  key: PlannedWeekDayKey;
  label: string;
  displayName: string;
  plannedDate: Date;
  plannedDateISO: string;
  status: "past" | "today" | "upcoming";
  mealId: string | null;
  meal?: Meal;
};

export type UseCurrentWeekPlanResult = {
  isLoading: boolean;
  plan: CurrentPlannedWeek;
  days: WeekPlanDay[];
  today?: WeekPlanDay;
  upcoming: WeekPlanDay[];
  setPlanState: (nextPlan: CurrentPlannedWeek) => void;
  refresh: () => Promise<void>;
};

type UseCurrentWeekPlanOptions = {
  today?: Date;
};

export const useCurrentWeekPlan = (
  options: UseCurrentWeekPlanOptions = {}
): UseCurrentWeekPlanResult => {
  const { meals } = useMeals();
  const { startDay, orderedDays } = useWeekStartController();
  const [plan, setPlan] = useState<CurrentPlannedWeek>(createEmptyCurrentPlannedWeek());
  const [isLoading, setLoading] = useState(true);
  const effectiveToday = options.today ?? new Date();
  const effectiveTodayTime = effectiveToday.getTime();

  const hydrate = useCallback(async () => {
    setLoading(true);
    const stored = await getCurrentWeekPlan();
    if (stored) {
      setPlan(stored);
    }
    setLoading(false);
  }, []);

  const setPlanState = useCallback((nextPlan: CurrentPlannedWeek) => {
    setPlan(nextPlan);
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const days = useMemo<WeekPlanDay[]>(() => {
    const referenceDate = new Date(effectiveTodayTime);
    const weekStart = getWeekStartForDate(startDay, referenceDate);
    const todayStart = startOfDay(new Date(effectiveTodayTime));

    return orderedDays.map((dayKey, index) => {
      const plannedDate = addDays(weekStart, index);
      let status: WeekPlanDay["status"] = "upcoming";
      if (isSameDay(plannedDate, todayStart)) {
        status = "today";
      } else if (plannedDate.getTime() < todayStart.getTime()) {
        status = "past";
      }

      const mealId = plan[dayKey];

      return {
        key: dayKey,
        label: PLANNED_WEEK_LABELS[dayKey],
        displayName: PLANNED_WEEK_DISPLAY_NAMES[dayKey],
        plannedDate,
        plannedDateISO: plannedDate.toISOString(),
        status,
        mealId,
        meal: matchMeal(meals, mealId),
      };
    });
  }, [effectiveTodayTime, meals, orderedDays, plan, startDay]);

  const today = useMemo(
    () => days.find((day) => day.status === "today"),
    [days]
  );

  const upcoming = useMemo(
    () => days.filter((day) => day.status === "upcoming"),
    [days]
  );

  return {
    isLoading,
    plan,
    days,
    today,
    upcoming,
    setPlanState,
    refresh: hydrate,
  };
};
