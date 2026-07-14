import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import TabParent from "../../../components/tab-parent/TabParent";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import CurrentWeekList from "../../../components/week-dashboard/CurrentWeekList";
import TodayCard from "../../../components/week-dashboard/TodayCard";
import UnmarkedCard from "../../../components/week-dashboard/UnmarkedCard";
import DateControls from "../../../components/week-dashboard/DateControls";
import GroceryListSheet from "../../../components/week-dashboard/GroceryListSheet";
import SuggestMealModal from "../../../components/plan-week/suggestions/SuggestMealModal";
import { buildMealSuggestions } from "../../../components/plan-week/suggestions/suggestionMatcher";
import ServedList, {
  ServedWeek,
} from "../../../components/week-dashboard/ServedList";
import { useCurrentWeekPlan } from "../../../hooks/useCurrentWeekPlan";
import { useMeals } from "../../../hooks/useMeals";
import { useFeatureFlag } from "../../../hooks/useFeatureFlags";
import { useWeekStartController } from "../../../providers/week-start/WeekStartController";
import { useServedMeals } from "../../../hooks/useServedMeals";
import {
  addDays,
  formatWeekdayDate,
  getNextWeekStartForDate,
  startOfDay,
  WEEK_DAY_TO_INDEX,
} from "../../../utils/weekDays";
import {
  PLANNED_WEEK_DISPLAY_NAMES,
  PLANNED_WEEK_LABELS,
  PLANNED_WEEK_ORDER,
  CurrentPlannedWeek,
  CurrentWeekSides,
  createEmptyCurrentPlannedWeek,
  createEmptyCurrentWeekSides,
  PlannedWeekDayKey,
} from "../../../types/weekPlan";
import {
  EAT_OUT_MEAL,
  EAT_OUT_MEAL_ID,
  FLEX_NIGHT_MEAL,
} from "../../../types/specialMeals";
import {
  clearWeekPlanData,
  getWeekPlanStreak,
  setCurrentWeekPlan,
  setCurrentWeekSides,
} from "../../../stores/weekPlanStorage";
import { clearStoredDayPins } from "../../../stores/dayPinsStorage";
import {
  clearTodayWidgetPayload,
  saveTodayWidgetPayload,
} from "../../../stores/todayWidgetStorage";
import { clearServedMeals } from "../../../stores/servedMealsStorage";
import type { ServedOutcome } from "../../../components/week-dashboard/servedActions";
import { getRandomCelebrationMessage } from "../../../components/week-dashboard/celebrations";
import { FamilyRatingValue } from "../../../types/meals";
import { setFamilyRatingValue } from "../../../utils/familyRatings";
import {
  formatPlanningDayRange,
  getRemainingPlanningDays,
} from "../../../utils/remainingWeekPlanning";
import useDayPins from "../../../hooks/plan-week/useDayPins";
import { DayPinsState, normalizeDayPinsState } from "../../../types/dayPins";
import { Meal } from "../../../types/meals";

const createInitialSuggestionIndex = () =>
  PLANNED_WEEK_ORDER.reduce<Record<PlannedWeekDayKey, number>>(
    (acc, key) => {
      acc[key] = 0;
      return acc;
    },
    {} as Record<PlannedWeekDayKey, number>
  );

const getEatOutServedTitle = (title?: string | null) => {
  const trimmedTitle = title?.trim();
  if (!trimmedTitle || trimmedTitle === EAT_OUT_MEAL.title) {
    return EAT_OUT_MEAL.title;
  }
  return `${trimmedTitle} (${EAT_OUT_MEAL.title})`;
};

const getDayBefore = (day: PlannedWeekDayKey): PlannedWeekDayKey => {
  const targetIndex = (WEEK_DAY_TO_INDEX[day] + 6) % 7;
  return (
    PLANNED_WEEK_ORDER.find(
      (candidate) => WEEK_DAY_TO_INDEX[candidate] === targetIndex
    ) ?? "sun"
  );
};

export default function WeekDashboardScreen() {
  const router = useRouter();
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { meals, updateMeal } = useMeals();
  const { startDay, orderedDays } = useWeekStartController();
  const dateControlsEnabled = useFeatureFlag(
    "weekDashboardDateControlsEnabled"
  );
  const [overrideDate, setOverrideDate] = useState<Date | null>(null);
  const [isPreviewVisible, setPreviewVisible] = useState(false);
  const [isGroceryListVisible, setGroceryListVisible] = useState(false);
  const [isTodayPlanMealVisible, setTodayPlanMealVisible] = useState(false);
  const [todaySwapSides, setTodaySwapSides] = useState<string[]>([]);
  const [pendingResolution, setPendingResolution] = useState<{
    dayKey: PlannedWeekDayKey;
    mealId: string;
    plannedDate: Date;
    meal: Meal;
  } | null>(null);
  const [pendingResolutionSides, setPendingResolutionSides] = useState<
    string[]
  >([]);
  const [todaySuggestionIndexMap, setTodaySuggestionIndexMap] = useState(
    createInitialSuggestionIndex
  );
  const [streakCount, setStreakCount] = useState(0);
  const [isStreakModalOpen, setStreakModalOpen] = useState(false);
  const dashboardAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const scrollEnabledRef = useRef(true);

  const handleWeekListDragStateChange = useCallback((isDragging: boolean) => {
    const nextEnabled = !isDragging;
    if (scrollEnabledRef.current === nextEnabled) {
      return;
    }
    scrollEnabledRef.current = nextEnabled;
    scrollViewRef.current?.setNativeProps({ scrollEnabled: nextEnabled });
  }, []);

  useEffect(() => {
    return () => {
      if (!scrollEnabledRef.current) {
        scrollEnabledRef.current = true;
        scrollViewRef.current?.setNativeProps({ scrollEnabled: true });
      }
    };
  }, []);

  useEffect(() => {
    if (!dateControlsEnabled) {
      setOverrideDate(null);
      setPreviewVisible(false);
    } else if (!overrideDate) {
      setOverrideDate(new Date());
    }
  }, [dateControlsEnabled, overrideDate]);

  useEffect(() => {
    const openSub = DeviceEventEmitter.addListener("streakModalOpen", () =>
      setStreakModalOpen(true)
    );
    const closeSub = DeviceEventEmitter.addListener("streakModalClose", () =>
      setStreakModalOpen(false)
    );
    return () => {
      openSub.remove();
      closeSub.remove();
    };
  }, []);

  useEffect(() => {
    Animated.timing(dashboardAnim, {
      toValue: isStreakModalOpen ? 1 : 0,
      duration: 280,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [dashboardAnim, isStreakModalOpen]);

  const effectiveDate = useMemo(
    () => (dateControlsEnabled ? overrideDate ?? new Date() : new Date()),
    [dateControlsEnabled, overrideDate]
  );

  const {
    isLoading,
    days,
    today,
    plan,
    sides,
    weekStartISO,
    setPlanState,
    setSidesState,
    refresh: refreshWeekPlan,
  } = useCurrentWeekPlan({
    today: effectiveDate,
  });
  const todayPlanDay = today?.key ?? "sun";
  const { dayPinsMap, handleDayPinsChange } = useDayPins({
    activeDay: todayPlanDay,
  });
  const nextWeekStart = useMemo(
    () => getNextWeekStartForDate(startDay, startOfDay(effectiveDate)),
    [effectiveDate, startDay]
  );
  const {
    plan: nextWeekPlan,
    days: nextWeekDays,
    refresh: refreshNextWeekPlan,
  } = useCurrentWeekPlan({
    today: effectiveDate,
    weekStartOverride: nextWeekStart,
  });
  const plannedDayCount = useMemo(
    () =>
      orderedDays.reduce(
        (acc, day) => (typeof plan?.[day] === "string" ? acc + 1 : acc),
        0
      ),
    [orderedDays, plan]
  );
  const nextWeekPlannedDayCount = useMemo(
    () =>
      orderedDays.reduce(
        (acc, day) =>
          typeof nextWeekPlan?.[day] === "string" ? acc + 1 : acc,
        0
      ),
    [nextWeekPlan, orderedDays]
  );
  const plannedNextWeekDays = useMemo(
    () => nextWeekDays.filter((day) => typeof day.mealId === "string"),
    [nextWeekDays]
  );
  const {
    entries: servedEntries,
    logServedMeal,
    refresh: refreshServedMeals,
  } = useServedMeals();
  const refreshStreak = useCallback(async () => {
    const streak = await getWeekPlanStreak();
    setStreakCount(streak.count ?? 0);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshWeekPlan();
      refreshNextWeekPlan();
      refreshServedMeals();
      refreshStreak();
    }, [
      refreshNextWeekPlan,
      refreshServedMeals,
      refreshStreak,
      refreshWeekPlan,
    ])
  );

  const handleFamilyRatingChange = useCallback(
    (mealId: string, memberId: string, rating: FamilyRatingValue) => {
      const meal = meals.find((m) => m.id === mealId);
      if (!meal) {
        return;
      }
      const nextRatings = setFamilyRatingValue(
        meal.familyRatings,
        memberId,
        rating
      );
      updateMeal({
        id: mealId,
        familyRatings: nextRatings,
      });
    },
    [meals, updateMeal]
  );

  const servedWeek = useMemo<ServedWeek>(
    () =>
      servedEntries.slice(0, 7).map((entry) => ({
        id: entry.id,
        dayLabel: PLANNED_WEEK_LABELS[entry.dayKey],
        mealId: entry.mealId,
        outcome: entry.outcome,
        labelOverride: entry.servedTitle,
      })),
    [servedEntries]
  );

  const upcomingDays = useMemo(
    () => days.filter((day) => day.status === "upcoming"),
    [days]
  );

  const todayServedEntry = useMemo(() => {
    if (!today) {
      return undefined;
    }
    const todayDate = startOfDay(today.plannedDate).getTime();
    return servedEntries.find((entry) => {
      if (entry.dayKey !== today.key) {
        return false;
      }
      const entryDate = startOfDay(new Date(entry.servedAtISO)).getTime();
      return entryDate === todayDate;
    });
  }, [servedEntries, today]);
  const todayPlanPins = useMemo(
    () => normalizeDayPinsState(dayPinsMap[todayPlanDay]),
    [dayPinsMap, todayPlanDay]
  );
  const sortedMeals = useMemo(
    () =>
      [...meals].sort((a, b) =>
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
      ),
    [meals]
  );
  const currentPlannedMealIds = useMemo(
    () =>
      new Set(
        Object.values(plan ?? {}).filter(
          (mealId): mealId is Meal["id"] => typeof mealId === "string"
        )
      ),
    [plan]
  );
  const todaySuggestionPool = useMemo(
    () => buildMealSuggestions(sortedMeals, todayPlanPins, currentPlannedMealIds),
    [currentPlannedMealIds, sortedMeals, todayPlanPins]
  );
  const todaySuggestionEntry = useMemo(() => {
    if (!todaySuggestionPool.length) {
      return undefined;
    }
    const index = todaySuggestionIndexMap[todayPlanDay] ?? 0;
    const normalizedIndex =
      ((index % todaySuggestionPool.length) + todaySuggestionPool.length) %
      todaySuggestionPool.length;
    return todaySuggestionPool[normalizedIndex];
  }, [todayPlanDay, todaySuggestionIndexMap, todaySuggestionPool]);
  const pendingResolutionDay = pendingResolution?.dayKey ?? todayPlanDay;
  const pendingResolutionPins = useMemo(
    () => normalizeDayPinsState(dayPinsMap[pendingResolutionDay]),
    [dayPinsMap, pendingResolutionDay]
  );
  const getMealLastServedISO = useCallback(
    (mealId: Meal["id"]) =>
      servedEntries.find(
        (entry) => entry.mealId === mealId && entry.outcome === "served"
      )?.servedAtISO ?? null,
    [servedEntries]
  );

  const todayWidgetSidesKey = today?.sides.join("\u0001") ?? "";

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!today?.meal) {
      void clearTodayWidgetPayload();
      return;
    }

    const recipeUrl = today.meal.recipeUrl?.trim();
    void saveTodayWidgetPayload({
      title: today.meal.title,
      icon: today.meal.emoji || "🍽️",
      dateLabel: formatWeekdayDate(today.plannedDate),
      sides: today.sides,
      recipeUrl: recipeUrl || undefined,
    });
  }, [
    isLoading,
    today?.meal?.id,
    today?.meal?.title,
    today?.meal?.emoji,
    today?.meal?.recipeUrl,
    today?.plannedDateISO,
    todayWidgetSidesKey,
  ]);

  const unmarkedDays = useMemo(
    () =>
      days
        .filter(
          (day) => {
            if (
              day.status !== "past" ||
              !day.meal ||
              !day.mealId
            ) {
              return false;
            }
            const plannedDate = startOfDay(day.plannedDate).getTime();
            return !servedEntries.some((entry) => {
              if (entry.dayKey !== day.key) {
                return false;
              }
              return (
                startOfDay(new Date(entry.servedAtISO)).getTime() ===
                plannedDate
              );
            });
          }
        )
        .sort((a, b) => b.plannedDate.getTime() - a.plannedDate.getTime()),
    [days, servedEntries]
  );

  const logTodayOutcome = useCallback(
    async (outcome: ServedOutcome, celebrationMessage?: string) => {
      if (!today?.meal) {
        return;
      }
      await logServedMeal({
        dayKey: today.key,
        mealId: today.mealId,
        servedAtISO: new Date().toISOString(),
        outcome,
        celebrationMessage,
        servedTitle:
          outcome === "served" && today.mealId === EAT_OUT_MEAL_ID
            ? getEatOutServedTitle(today.meal.title)
            : undefined,
      });

      if (outcome === "served" && today.mealId) {
        const currentMeal = meals.find((item) => item.id === today.mealId);
        if (currentMeal) {
          updateMeal({
            id: currentMeal.id,
            servedCount:
              (typeof currentMeal.servedCount === "number"
                ? currentMeal.servedCount
                : 0) + 1,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    },
    [logServedMeal, meals, today, updateMeal]
  );

  const handleMarkServed = useCallback(
    async (message: string) => {
      await logTodayOutcome("served", message);
    },
    [logTodayOutcome]
  );

  const handleTodayAlternateOutcome = useCallback(
    async (outcome: ServedOutcome) => {
      await logTodayOutcome(outcome);
    },
    [logTodayOutcome]
  );

  const handleTodayChangePlans = useCallback(() => {
    if (!today?.meal) {
      return;
    }
    setTodaySwapSides([]);
    setTodayPlanMealVisible(true);
  }, [today?.meal]);

  const handleDismissTodayPlanMeal = useCallback(() => {
    setTodayPlanMealVisible(false);
    setTodaySwapSides([]);
  }, []);

  const handleSaveTodayPlanMeal = useCallback(
    async (meal: Meal, side?: string) => {
      if (!today?.key || !plan) {
        return;
      }
      const sideToAdd = side?.trim();
      const nextTodaySides = sideToAdd
        ? [...todaySwapSides, sideToAdd]
        : todaySwapSides;
      const nextSpecialMealTitles = {
        ...(plan.specialMealTitles ?? {}),
      };
      if (meal.id === EAT_OUT_MEAL_ID && meal.title !== EAT_OUT_MEAL.title) {
        nextSpecialMealTitles[today.key] = meal.title;
      } else {
        delete nextSpecialMealTitles[today.key];
      }
      const nextPlan: CurrentPlannedWeek = {
        ...plan,
        [today.key]: meal.id,
        weekStartISO,
        specialMealTitles: Object.keys(nextSpecialMealTitles).length
          ? nextSpecialMealTitles
          : undefined,
      };
      const nextSides: CurrentWeekSides = {
        ...sides,
        [today.key]: nextTodaySides,
      };
      setPlanState(nextPlan);
      setSidesState(nextSides);
      setTodayPlanMealVisible(false);
      setTodaySwapSides([]);
      await Promise.all([
        setCurrentWeekPlan(weekStartISO, nextPlan),
        setCurrentWeekSides(weekStartISO, nextSides),
      ]);
    },
    [
      plan,
      setPlanState,
      setSidesState,
      sides,
      today?.key,
      todaySwapSides,
      weekStartISO,
    ]
  );

  const handleSaveTodayEatOut = useCallback(() => {
    handleSaveTodayPlanMeal(EAT_OUT_MEAL);
  }, [handleSaveTodayPlanMeal]);

  const handleSaveTodayFlexNight = useCallback(() => {
    handleSaveTodayPlanMeal(FLEX_NIGHT_MEAL);
  }, [handleSaveTodayPlanMeal]);

  const handleSuggestAnotherTodayMeal = useCallback(() => {
    if (!todaySuggestionPool.length) {
      return;
    }
    setTodaySuggestionIndexMap((prev) => ({
      ...prev,
      [todayPlanDay]: (prev[todayPlanDay] ?? 0) + 1,
    }));
  }, [todayPlanDay, todaySuggestionPool.length]);

  const handleTodayPlanPinsChange = useCallback(
    (next: DayPinsState) => {
      handleDayPinsChange(todayPlanDay, next);
      setTodaySuggestionIndexMap((prev) => ({
        ...prev,
        [todayPlanDay]: 0,
      }));
    },
    [handleDayPinsChange, todayPlanDay]
  );

  const handleAddTodaySwapSide = useCallback((side: string) => {
    setTodaySwapSides((prev) => [...prev, side]);
  }, []);

  const handleRemoveTodaySwapSide = useCallback((index: number) => {
    setTodaySwapSides((prev) => {
      if (index < 0 || index >= prev.length) {
        return prev;
      }
      return prev.filter((_, currentIndex) => currentIndex !== index);
    });
  }, []);

  const handleOpenPendingResolution = useCallback(
    (
      dayKey: PlannedWeekDayKey,
      mealId: string,
      plannedDate: Date,
      meal: Meal
    ) => {
      setPendingResolution({
        dayKey,
        mealId,
        plannedDate,
        meal,
      });
      setPendingResolutionSides([]);
    },
    []
  );

  const handleDismissPendingResolution = useCallback(() => {
    setPendingResolution(null);
    setPendingResolutionSides([]);
  }, []);

  const handlePendingPinsChange = useCallback(
    (next: DayPinsState) => {
      handleDayPinsChange(pendingResolutionDay, next);
      setTodaySuggestionIndexMap((prev) => ({
        ...prev,
        [pendingResolutionDay]: 0,
      }));
    },
    [handleDayPinsChange, pendingResolutionDay]
  );

  const handleAddPendingSide = useCallback((side: string) => {
    setPendingResolutionSides((prev) => [...prev, side]);
  }, []);

  const handleRemovePendingSide = useCallback((index: number) => {
    setPendingResolutionSides((prev) => {
      if (index < 0 || index >= prev.length) {
        return prev;
      }
      return prev.filter((_, currentIndex) => currentIndex !== index);
    });
  }, []);

  const handleSavePendingDinner = useCallback(
    async (meal: Meal, side?: string) => {
      if (!pendingResolution || !plan) {
        return;
      }
      const { dayKey, plannedDate } = pendingResolution;
      const sideToAdd = side?.trim();
      const nextDaySides = sideToAdd
        ? [...pendingResolutionSides, sideToAdd]
        : pendingResolutionSides;
      const nextSpecialMealTitles = {
        ...(plan.specialMealTitles ?? {}),
      };
      if (meal.id === EAT_OUT_MEAL_ID && meal.title !== EAT_OUT_MEAL.title) {
        nextSpecialMealTitles[dayKey] = meal.title;
      } else {
        delete nextSpecialMealTitles[dayKey];
      }
      const nextPlan: CurrentPlannedWeek = {
        ...plan,
        [dayKey]: meal.id,
        weekStartISO,
        specialMealTitles: Object.keys(nextSpecialMealTitles).length
          ? nextSpecialMealTitles
          : undefined,
      };
      const nextSides: CurrentWeekSides = {
        ...sides,
        [dayKey]: nextDaySides,
      };
      const outcome: ServedOutcome =
        meal.id === EAT_OUT_MEAL_ID ? "ateOut" : "cookedAlt";

      setPlanState(nextPlan);
      setSidesState(nextSides);
      setPendingResolution(null);
      setPendingResolutionSides([]);
      await Promise.all([
        setCurrentWeekPlan(weekStartISO, nextPlan),
        setCurrentWeekSides(weekStartISO, nextSides),
        logServedMeal({
          dayKey,
          mealId: meal.id,
          servedAtISO: new Date(plannedDate).toISOString(),
          outcome,
          servedTitle:
            meal.id === EAT_OUT_MEAL_ID
              ? getEatOutServedTitle(meal.title)
              : undefined,
        }),
      ]);

      if (meal.id !== EAT_OUT_MEAL_ID) {
        const currentMeal = meals.find((item) => item.id === meal.id);
        if (currentMeal) {
          updateMeal({
            id: currentMeal.id,
            servedCount:
              (typeof currentMeal.servedCount === "number"
                ? currentMeal.servedCount
                : 0) + 1,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    },
    [
      logServedMeal,
      meals,
      pendingResolution,
      pendingResolutionSides,
      plan,
      setPlanState,
      setSidesState,
      sides,
      updateMeal,
      weekStartISO,
    ]
  );

  const handleSavePendingEatOut = useCallback(
    (title?: string) => {
      const eatOutMeal = title?.trim()
        ? { ...EAT_OUT_MEAL, title: title.trim() }
        : EAT_OUT_MEAL;
      handleSavePendingDinner(eatOutMeal);
    },
    [handleSavePendingDinner]
  );

  const handleSavePendingFlexNight = useCallback(() => {
    handleSavePendingDinner(FLEX_NIGHT_MEAL);
  }, [handleSavePendingDinner]);

  const handleUnmarkedOutcome = useCallback(
    async (
      dayKey: PlannedWeekDayKey,
      mealId: string,
      plannedDate: Date,
      outcome: ServedOutcome
    ) => {
      await logServedMeal({
        dayKey,
        mealId,
        servedAtISO: new Date(plannedDate).toISOString(),
        outcome,
        celebrationMessage:
          outcome === "served" ? getRandomCelebrationMessage() : undefined,
        servedTitle:
          outcome === "served" && mealId === EAT_OUT_MEAL_ID
            ? getEatOutServedTitle(
                plan.specialMealTitles?.[dayKey] ?? EAT_OUT_MEAL.title
              )
            : undefined,
      });

      if (outcome === "served") {
        const currentMeal = meals.find((item) => item.id === mealId);
        if (currentMeal) {
          updateMeal({
            id: currentMeal.id,
            servedCount:
              (typeof currentMeal.servedCount === "number"
                ? currentMeal.servedCount
                : 0) + 1,
            updatedAt: new Date().toISOString(),
          });
        }
      }
    },
    [logServedMeal, meals, plan.specialMealTitles, updateMeal]
  );

  const formattedDate = useMemo(
    () => formatWeekdayDate(effectiveDate),
    [effectiveDate]
  );

  const previewContent = useMemo(
    () =>
      JSON.stringify(
        {
          currentWeekPlan: plan,
          servedEntries,
        },
        null,
        2
      ),
    [plan, servedEntries]
  );

  const togglePreview = useCallback(() => {
    setPreviewVisible((prev) => !prev);
  }, []);

  const showWeekPlanDetails = plan?.weekedPlanned === true;

  const showPlanButton = useMemo(() => {
    const reference = startOfDay(effectiveDate);
    const diffMs = nextWeekStart.getTime() - reference.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    return diffMs <= oneDayMs * 2;
  }, [effectiveDate, nextWeekStart]);
  const remainingPlanningDays = useMemo(
    () => getRemainingPlanningDays(startDay, effectiveDate),
    [effectiveDate, startDay]
  );
  const remainingPlanningRange = useMemo(
    () => formatPlanningDayRange(remainingPlanningDays),
    [remainingPlanningDays]
  );
  const resetDayName = PLANNED_WEEK_DISPLAY_NAMES[startDay];
  const planningReminderDayName =
    PLANNED_WEEK_DISPLAY_NAMES[getDayBefore(startDay)];
  const showSetupCard =
    !isLoading && !showWeekPlanDetails && plannedDayCount === 0;
  const isPartialCurrentWeekPlan =
    showWeekPlanDetails &&
    plannedDayCount > 0 &&
    plannedDayCount < orderedDays.length;
  const shouldPromptNextWeekAfterRemainingPlan =
    showWeekPlanDetails &&
    (plan?.plannedScope === "remaining" || isPartialCurrentWeekPlan) &&
    nextWeekPlannedDayCount === 0;
  const canPlanNextWeek =
    showPlanButton &&
    nextWeekPlannedDayCount === 0 &&
    (nextWeekPlan?.weekedPlanned !== true ||
      shouldPromptNextWeekAfterRemainingPlan);
  const showTopPlanButton = canPlanNextWeek && !showSetupCard;
  const groceryDayDate = useMemo(
    () => startOfDay(new Date(`${weekStartISO}T00:00:00`)),
    [weekStartISO]
  );
  const hasPlannedMeals = plannedDayCount > 0;
  const canBuildGroceryList =
    hasPlannedMeals && startOfDay(effectiveDate).getTime() <= groceryDayDate.getTime();

  const handleGoToMeals = useCallback(() => {
    router.push("/meals?showMealStarter=1");
  }, [router]);

  const handlePlanRemainingWeek = useCallback(() => {
    router.push("/modals/plan-week?mode=remaining");
  }, [router]);

  const handlePlanNextWeek = useCallback(() => {
    router.push("/modals/plan-week");
  }, [router]);

  const handlePrevDay = useCallback(() => {
    if (!dateControlsEnabled) {
      return;
    }
    setOverrideDate((prev) => addDays(prev ?? effectiveDate, -1));
  }, [dateControlsEnabled, effectiveDate]);

  const handleNextDay = useCallback(() => {
    if (!dateControlsEnabled) {
      return;
    }
    setOverrideDate((prev) => addDays(prev ?? effectiveDate, 1));
  }, [dateControlsEnabled, effectiveDate]);

  const handleClearWeekPlan = useCallback(async () => {
    const emptyPlan = createEmptyCurrentPlannedWeek({ weekStartISO });
    const emptySides = createEmptyCurrentWeekSides();
    setPlanState(emptyPlan);
    setSidesState(emptySides);
    await Promise.all([
      clearWeekPlanData(),
      clearStoredDayPins(),
      clearTodayWidgetPayload(),
    ]);
    await Promise.all([refreshWeekPlan(), refreshNextWeekPlan()]);
  }, [
    refreshNextWeekPlan,
    refreshWeekPlan,
    setPlanState,
    setSidesState,
    weekStartISO,
  ]);

  const handleClearServedMeals = useCallback(async () => {
    await clearServedMeals();
    await refreshServedMeals();
  }, [refreshServedMeals]);

  const remainingPlannedDayCount = useMemo(
    () =>
      remainingPlanningDays.reduce(
        (acc, day) => (typeof plan?.[day] === "string" ? acc + 1 : acc),
        0
      ),
    [plan, remainingPlanningDays]
  );
  const shouldUseRemainingResumeProgress =
    (plan?.plannedScope === "remaining" || isPartialCurrentWeekPlan) &&
    remainingPlanningDays.length > 0;
  const resumePlannedCount = shouldUseRemainingResumeProgress
    ? remainingPlannedDayCount
    : plannedDayCount;
  const resumeTotalCount = shouldUseRemainingResumeProgress
    ? remainingPlanningDays.length
    : orderedDays.length;
  const handleResumePlanning = useCallback(() => {
    router.push(
      shouldUseRemainingResumeProgress
        ? "/modals/plan-week?mode=remaining"
        : "/modals/plan-week"
    );
  }, [router, shouldUseRemainingResumeProgress]);

  const renderPlanningCTA = useCallback(
    (mode: "start" | "resume", onPrimary: () => void, onSkip?: () => void) => {
      const isResume = mode === "resume";
      const primaryLabel = isResume ? "Resume planning" : "Start planning";
      const title = isResume ? "You're partway through" : "Ready when you are";
      const subtitle = isResume
        ? `You planned ${resumePlannedCount} of ${resumeTotalCount} nights. Jump back in where you left off.`
        : "Pick dinners for the week in a few minutes. You can always change them later.";
      const progress = resumeTotalCount
        ? Math.min(1, resumePlannedCount / resumeTotalCount)
        : 0;
      return (
        <View style={styles.planningCardCta}>
          <Text style={styles.planningCtaTitle}>{title}</Text>
          <Text style={styles.planningCtaSubtitle}>{subtitle}</Text>
          {isResume ? (
            <View style={styles.progressRow}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { flex: progress }]} />
                <View style={{ flex: 1 - progress }} />
              </View>
              <Text style={styles.progressLabel}>
                {resumePlannedCount}/{resumeTotalCount}
              </Text>
            </View>
          ) : (
            <Text style={styles.timeEstimate}>~3 minutes</Text>
          )}
          <View style={styles.planningButtonsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={primaryLabel}
              onPress={onPrimary}
              style={({ pressed }) => [
                styles.planningPrimaryButton,
                pressed && styles.planningPrimaryButtonPressed,
              ]}
            >
              <Text style={styles.planningPrimaryText}>{primaryLabel}</Text>
            </Pressable>
            {!isResume && onSkip ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Skip planning for now"
                onPress={onSkip}
                style={({ pressed }) => [
                  styles.skipButton,
                  pressed && styles.skipButtonPressed,
                ]}
              >
                <Text style={styles.skipText}>Skip for now</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      );
    },
    [resumePlannedCount, resumeTotalCount]
  );

  const setupCard = useMemo(() => {
    if (!showSetupCard) {
      return null;
    }

    if (meals.length === 0) {
      return (
        <View style={styles.setupCard}>
          <View style={styles.setupIconWrap}>
            <MaterialCommunityIcons
              name="silverware-fork-knife"
              size={24}
              color={theme.color.accent}
            />
          </View>
          <Text style={styles.setupTitle}>Add a few meals first</Text>
          <Text style={styles.setupSubtitle}>
            Weekly Eats plans from your meal library. Add meals manually or
            share recipe links from Safari, then come back here to build your
            week.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to meals"
            onPress={handleGoToMeals}
            style={({ pressed }) => [
              styles.setupPrimaryButton,
              pressed && styles.setupButtonPressed,
            ]}
          >
            <Text style={styles.setupPrimaryText}>Go to Meals</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.setupCard}>
        <View style={styles.setupIconWrap}>
          <MaterialCommunityIcons
            name="calendar-week"
            size={24}
            color={theme.color.accent}
          />
        </View>
        <Text style={styles.setupTitle}>Ready to plan?</Text>
        <Text style={styles.setupSubtitle}>
          Your weekly shopping day is {resetDayName}, so your planning rhythm is
          every {planningReminderDayName}. For today, choose what you want to
          set up.
        </Text>
        {remainingPlanningDays.length > 0 ? (
          <Text style={styles.setupHelper}>
            Rest of this week covers {remainingPlanningRange}.
          </Text>
        ) : null}
        <View style={styles.setupActions}>
          {remainingPlanningDays.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Plan the rest of the current week"
              onPress={handlePlanRemainingWeek}
              style={({ pressed }) => [
                styles.setupPrimaryButton,
                pressed && styles.setupButtonPressed,
              ]}
            >
              <Text style={styles.setupPrimaryText}>
                Plan rest of this week
              </Text>
            </Pressable>
          ) : null}
          {canPlanNextWeek ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Plan next week"
              onPress={handlePlanNextWeek}
              style={({ pressed }) => [
                styles.setupPrimaryButton,
                pressed && styles.setupButtonPressed,
              ]}
            >
              <Text style={styles.setupPrimaryText}>Plan next week</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }, [
    handleGoToMeals,
    handlePlanNextWeek,
    handlePlanRemainingWeek,
    canPlanNextWeek,
    meals.length,
    planningReminderDayName,
    remainingPlanningDays.length,
    remainingPlanningRange,
    resetDayName,
    showSetupCard,
    styles,
    theme.color.accent,
  ]);

  const header = useMemo(
    () => (
      <DateControls
        formattedDate={formattedDate}
        isSimulatedDate={dateControlsEnabled && Boolean(overrideDate)}
        showControls={dateControlsEnabled}
        onPrevDay={handlePrevDay}
        onNextDay={handleNextDay}
        onClearWeekPlan={handleClearWeekPlan}
        onClearServedMeals={handleClearServedMeals}
        onTogglePreview={togglePreview}
        isPreviewVisible={isPreviewVisible}
        previewContent={previewContent}
      />
    ),
    [
      dateControlsEnabled,
      formattedDate,
      isPreviewVisible,
      previewContent,
      handleClearServedMeals,
      handleClearWeekPlan,
      handleNextDay,
      handlePrevDay,
      overrideDate,
      togglePreview,
    ]
  );

  const todayCard = useMemo(() => {
    if (isLoading) {
      return (
        <View style={styles.loadingCard}>
          <ActivityIndicator color={theme.color.accent} />
        </View>
      );
    }

    if (today?.meal) {
      return (
        <TodayCard
          meal={today.meal}
          dateLabel={formatWeekdayDate(today.plannedDate)}
          servedEntry={todayServedEntry}
          sides={today.sides}
          onMarkServed={handleMarkServed}
          onSelectOutcome={handleTodayAlternateOutcome}
          onChangePlans={handleTodayChangePlans}
        />
      );
    }

    return (
      <View style={styles.emptyTodayCard}>
        <Text style={styles.emptyTodayTitle}>No meal planned</Text>
        <Text style={styles.emptyTodaySubtitle}>
          Add a meal to {formattedDate} to see it here.
        </Text>
      </View>
    );
  }, [
    formattedDate,
    handleMarkServed,
    handleTodayChangePlans,
    handleTodayAlternateOutcome,
    isLoading,
    styles,
    theme.color.accent,
    today,
    todayServedEntry,
  ]);

  const unmarkedCards = unmarkedDays.map((day) => (
    <UnmarkedCard
      key={day.key}
      meal={day.meal!}
      dateLabel={formatWeekdayDate(day.plannedDate)}
      onMarkServed={() =>
        handleUnmarkedOutcome(day.key, day.mealId!, day.plannedDate, "served")
      }
      onHadSomethingDifferent={() =>
        handleOpenPendingResolution(
          day.key,
          day.mealId!,
          day.plannedDate,
          day.meal!
        )
      }
    />
  ));

  const screenMotionStyle = useMemo(
    () => ({
      transform: [
        {
          translateY: dashboardAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 55],
          }),
        },
        {
          scale: dashboardAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.98],
          }),
        },
      ],
      opacity: dashboardAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.95],
      }),
    }),
    [dashboardAnim]
  );

  return (
    <View style={styles.screenContainer}>
      <Animated.View style={[styles.screenWrapper, screenMotionStyle]}>
        <TabParent
          title="Week Dashboard"
          header={header}
          streak={{
            count: streakCount,
            onPress: () => router.push("/modals/streaksHistoryModal"),
          }}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {showTopPlanButton ? (
              <Pressable
                style={({ pressed }) => [
                  styles.planButton,
                  pressed && styles.planButtonPressed,
                ]}
                onPress={() => router.push("/modals/plan-week")}
                accessibilityRole="button"
                accessibilityLabel="Plan upcoming week"
              >
                <View style={styles.planIconWrap}>
                  <MaterialCommunityIcons
                    name="calendar-week"
                    size={22}
                    color={theme.color.accent}
                  />
                </View>
                <View style={styles.planTextStack}>
                  <Text style={styles.planButtonTitle}>Plan Next Week</Text>
                  <Text style={styles.planButtonSubtitle}>
                    Pick dinners for the week in minutes.
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={26}
                  color={theme.color.subtleInk}
                />
              </Pressable>
            ) : null}

            {canBuildGroceryList ? (
              <Pressable
                style={({ pressed }) => [
                  styles.planButton,
                  pressed && styles.planButtonPressed,
                ]}
                onPress={() => setGroceryListVisible(true)}
                accessibilityRole="button"
                accessibilityLabel="Build grocery list"
              >
                <View style={styles.planIconWrap}>
                  <MaterialCommunityIcons
                    name="format-list-checks"
                    size={22}
                    color={theme.color.accent}
                  />
                </View>
                <View style={styles.planTextStack}>
                  <Text style={styles.planButtonTitle}>Build Grocery List</Text>
                  <Text style={styles.planButtonSubtitle}>
                    Review ingredients for this week's dinners.
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={26}
                  color={theme.color.subtleInk}
                />
              </Pressable>
            ) : null}

            {setupCard}

            <View style={styles.stack}>
              {showWeekPlanDetails ? (
                <>
                  {todayCard}
                  {unmarkedCards}
                  <CurrentWeekList
                    days={upcomingDays}
                    title="Current Week Plan"
                    onDragStateChange={handleWeekListDragStateChange}
                    onReorder={async (reordered) => {
                      if (!plan) {
                        return;
                      }
                      const nextPlan = { ...plan };
                      upcomingDays.forEach((day, index) => {
                        const nextSlot = reordered[index];
                        if (!day || !nextSlot) {
                          return;
                        }
                        nextPlan[day.key] = nextSlot.mealId ?? null;
                      });
                      setPlanState(nextPlan);
                      await Promise.all([
                        setCurrentWeekPlan(weekStartISO, nextPlan),
                        setCurrentWeekSides(weekStartISO, sides),
                      ]);
                    }}
                  />
                  {nextWeekPlannedDayCount > 0 ? (
                    <CurrentWeekList
                      days={plannedNextWeekDays}
                      title="Next Week Plan"
                    />
                  ) : null}
                </>
              ) : plannedDayCount > 0 ? (
                renderPlanningCTA("resume", handleResumePlanning)
              ) : null}
              {servedWeek.length > 0 ? (
                <ServedList
                  servedWeek={servedWeek}
                  meals={meals}
                  title="Served Meals"
                  onFamilyRatingChange={handleFamilyRatingChange}
                />
              ) : null}
            </View>
          </ScrollView>
        </TabParent>
      </Animated.View>
      <GroceryListSheet
        visible={isGroceryListVisible}
        weekId={weekStartISO}
        days={days}
        onDismiss={() => setGroceryListVisible(false)}
      />
      <SuggestMealModal
        visible={isTodayPlanMealVisible}
        dayName={PLANNED_WEEK_DISPLAY_NAMES[todayPlanDay]}
        mode="changeDinner"
        currentMeal={today?.meal ?? null}
        suggestion={todaySuggestionEntry}
        canSuggestAnother={todaySuggestionPool.length > 1}
        onDismiss={handleDismissTodayPlanMeal}
        onAddMeal={handleSaveTodayPlanMeal}
        onSuggestAnother={handleSuggestAnotherTodayMeal}
        meals={sortedMeals}
        onSelectSearchMeal={handleSaveTodayPlanMeal}
        onEatOut={handleSaveTodayEatOut}
        onFlexNight={handleSaveTodayFlexNight}
        getLastServedISO={getMealLastServedISO}
        sides={todaySwapSides}
        onAddSide={handleAddTodaySwapSide}
        onRemoveSide={handleRemoveTodaySwapSide}
        pins={todayPlanPins}
        onPinsChange={handleTodayPlanPinsChange}
      />
      <SuggestMealModal
        visible={Boolean(pendingResolution)}
        dayName={PLANNED_WEEK_DISPLAY_NAMES[pendingResolutionDay]}
        mode="recordPastDinner"
        currentMeal={pendingResolution?.meal ?? null}
        canSuggestAnother={false}
        onDismiss={handleDismissPendingResolution}
        onAddMeal={handleSavePendingDinner}
        onSuggestAnother={() => {}}
        meals={sortedMeals}
        onSelectSearchMeal={handleSavePendingDinner}
        onEatOut={handleSavePendingEatOut}
        onFlexNight={handleSavePendingFlexNight}
        getLastServedISO={getMealLastServedISO}
        sides={pendingResolutionSides}
        onAddSide={handleAddPendingSide}
        onRemoveSide={handleRemovePendingSide}
        pins={pendingResolutionPins}
        onPinsChange={handlePendingPinsChange}
      />
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space["2xl"],
      paddingBottom: theme.space["2xl"],
      gap: theme.space["2xl"],
    },
    screenContainer: {
      flex: 1,
      backgroundColor: "#000",
    },
    screenWrapper: {
      flex: 1,
      borderTopRightRadius: theme.radius.lg,
      borderTopLeftRadius: theme.radius.lg,
      overflow: "hidden",
    },
    planButton: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      paddingVertical: theme.space.lg,
      paddingHorizontal: theme.space.lg,
      gap: theme.space.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      shadowColor: "#000",
      shadowOpacity: 0.06,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    planButtonPressed: {
      opacity: 0.85,
    },
    planIconWrap: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.focus,
      alignItems: "center",
      justifyContent: "center",
    },
    planTextStack: {
      flex: 1,
      gap: 2,
    },
    planButtonTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    planButtonSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    setupCard: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.xl,
      paddingVertical: theme.space.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      gap: theme.space.md,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    setupIconWrap: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.focus,
      alignItems: "center",
      justifyContent: "center",
    },
    setupTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    setupSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      lineHeight: theme.type.size.base * 1.4,
    },
    setupHelper: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    setupActions: {
      gap: theme.space.sm,
    },
    setupPrimaryButton: {
      minHeight: theme.component.button.height,
      borderRadius: theme.component.button.radius,
      backgroundColor: theme.color.accent,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.space.lg,
    },
    setupPrimaryText: {
      color: "#FFFFFF",
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    setupSecondaryButton: {
      minHeight: theme.component.button.height,
      borderRadius: theme.component.button.radius,
      backgroundColor: theme.color.focus,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.space.lg,
      borderWidth: 1,
      borderColor: theme.color.accent,
    },
    setupSecondaryText: {
      color: theme.color.accent,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    setupButtonPressed: {
      opacity: 0.85,
    },
    stack: {
      gap: theme.space["2xl"],
    },
    planningCardCta: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.xl,
      paddingVertical: theme.space.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      gap: theme.space.md,
      shadowColor: "#000",
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    planningCtaTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    planningCtaSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
    },
    progressRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    progressBar: {
      flex: 1,
      height: 6,
      borderRadius: 999,
      backgroundColor: theme.color.border,
      flexDirection: "row",
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: "#f94f9b",
    },
    progressLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    timeEstimate: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    planningButtonsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
    },
    planningPrimaryButton: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.space.md,
      borderRadius: theme.radius.full,
      backgroundColor: "#f94f9b",
      shadowColor: "#f94f9b",
      shadowOpacity: 0.25,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    planningPrimaryButtonPressed: {
      opacity: 0.9,
    },
    planningPrimaryText: {
      color: "#fff",
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    skipButton: {
      paddingHorizontal: theme.space.sm,
      paddingVertical: theme.space.sm,
    },
    skipButtonPressed: {
      opacity: 0.8,
    },
    skipText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    loadingCard: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.lg,
      paddingVertical: theme.space.xl,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
    },
    emptyTodayCard: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.xl,
      paddingVertical: theme.space.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      gap: theme.space.sm,
    },
    emptyTodayTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    emptyTodaySubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
    },
  });
