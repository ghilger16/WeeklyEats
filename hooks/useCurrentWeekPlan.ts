import { useCallback, useEffect, useMemo, useState } from "react";
import { Meal } from "../types/meals";
import { EAT_OUT_MEAL, EAT_OUT_MEAL_ID } from "../types/specialMeals";
import { useWeekStartController } from "../providers/week-start/WeekStartController";
import {
  CurrentPlannedWeek,
  CurrentWeekSides,
  PLANNED_WEEK_DISPLAY_NAMES,
  PLANNED_WEEK_LABELS,
  PlannedWeekDayKey,
  createEmptyCurrentPlannedWeek,
  createEmptyCurrentWeekSides,
} from "../types/weekPlan";
import {
  getCurrentWeekPlan,
  getCurrentWeekSides,
} from "../stores/weekPlanStorage";
import { useMeals } from "./useMeals";
import {
  addDays,
  getWeekStartForDate,
  startOfDay,
} from "../utils/weekDays";

const isSameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

const matchMeal = (meals: Meal[], mealId: string | null | undefined) => {
  if (!mealId) {
    return undefined;
  }
  if (mealId === EAT_OUT_MEAL_ID) {
    return EAT_OUT_MEAL;
  }
  return meals.find((meal) => meal.id === mealId);
};

export type WeekPlanDay = {
  key: PlannedWeekDayKey;
  label: string;
  displayName: string;
  plannedDate: Date;
  plannedDateISO: string;
  status: "past" | "today" | "upcoming";
  mealId: string | null;
  meal?: Meal;
  sides: string[];
};

export type UseCurrentWeekPlanResult = {
  isLoading: boolean;
  plan: CurrentPlannedWeek;
  sides: CurrentWeekSides;
  days: WeekPlanDay[];
  today?: WeekPlanDay;
  upcoming: WeekPlanDay[];
  setPlanState: (nextPlan: CurrentPlannedWeek) => void;
  setSidesState: (nextSides: CurrentWeekSides) => void;
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
  const [sides, setSides] = useState<CurrentWeekSides>(createEmptyCurrentWeekSides());
  const [isLoading, setLoading] = useState(true);
  const effectiveToday = options.today ?? new Date();
  const effectiveTodayTime = effectiveToday.getTime();

  const hydrate = useCallback(async () => {
    setLoading(true);
    const [storedPlan, storedSides] = await Promise.all([
      getCurrentWeekPlan(),
      getCurrentWeekSides(),
    ]);
    if (storedPlan) {
      setPlan(storedPlan);
    }
    setSides(storedSides);
    setLoading(false);
  }, []);

  const setPlanState = useCallback((nextPlan: CurrentPlannedWeek) => {
    setPlan(nextPlan);
  }, []);

  const setSidesState = useCallback((nextSides: CurrentWeekSides) => {
    setSides(nextSides);
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

      const sidesForDay = sides[dayKey] ?? [];
      return {
        key: dayKey,
        label: PLANNED_WEEK_LABELS[dayKey],
        displayName: PLANNED_WEEK_DISPLAY_NAMES[dayKey],
        plannedDate,
        plannedDateISO: plannedDate.toISOString(),
        status,
        mealId,
        meal: matchMeal(meals, mealId),
        sides: sidesForDay,
      };
    });
  }, [effectiveTodayTime, meals, orderedDays, plan, sides, startDay]);

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
    sides,
    days,
    today,
    upcoming,
    setPlanState,
    setSidesState,
    refresh: hydrate,
  };
};
