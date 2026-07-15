import {
  ActivityIndicator,
  Animated,
  DeviceEventEmitter,
  Easing,
  Modal,
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
  getCurrentWeekPlan,
  getCurrentWeekSides,
  getWeekPlanStreak,
  setCurrentWeekPlan,
  setCurrentWeekSides,
  setWeekPlanDataBatch,
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
  const [isTodayPlanMealVisible, setTodayPlanMealVisible] = useState(false);
  const [isBrowseMealsVisible, setBrowseMealsVisible] = useState(false);
  const [pendingReplacement, setPendingReplacement] = useState<{
    meal: Meal;
    sides: string[];
  } | null>(null);
  const [displacedMealStep, setDisplacedMealStep] = useState<
    "decision" | "day" | null
  >(null);
  const [selectedSwapDay, setSelectedSwapDay] =
    useState<PlannedWeekDayKey | null>(null);
  const [isSwapSaving, setSwapSaving] = useState(false);
  const [swapMessage, setSwapMessage] = useState<string | null>(null);
  const [dashboardMessage, setDashboardMessage] = useState<string | null>(null);
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

  useEffect(() => {
    if (!dashboardMessage) {
      return;
    }
    const timeout = setTimeout(() => setDashboardMessage(null), 2600);
    return () => clearTimeout(timeout);
  }, [dashboardMessage]);

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

  const swapDinnerOptions = useMemo(
    () =>
      upcomingDays.filter((day) => {
        if (!day.meal) {
          return false;
        }
        const plannedDate = startOfDay(day.plannedDate).getTime();
        return !servedEntries.some(
          (entry) =>
            entry.outcome === "served" &&
            entry.dayKey === day.key &&
            startOfDay(new Date(entry.servedAtISO)).getTime() === plannedDate
        );
      }),
    [servedEntries, upcomingDays]
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
    setSelectedSwapDay(null);
    setSwapMessage(null);
    setTodayPlanMealVisible(true);
  }, [today?.meal]);

  const handleDismissTodayPlanMeal = useCallback(() => {
    if (isSwapSaving) {
      return;
    }
    setTodayPlanMealVisible(false);
    setSelectedSwapDay(null);
    setSwapMessage(null);
    setTodaySwapSides([]);
  }, [isSwapSaving]);

  const handleBrowseOtherMeals = useCallback(() => {
    setTodayPlanMealVisible(false);
    setSelectedSwapDay(null);
    setSwapMessage(null);
    setTodaySwapSides([]);
    setBrowseMealsVisible(true);
  }, []);

  const handleDismissBrowseMeals = useCallback(() => {
    setBrowseMealsVisible(false);
    setTodaySwapSides([]);
    setTodayPlanMealVisible(true);
  }, []);

  const handleSelectReplacementMeal = useCallback(
    (meal: Meal, side?: string) => {
      const normalizedSide = side?.trim();
      setPendingReplacement({
        meal,
        sides: normalizedSide
          ? [...todaySwapSides, normalizedSide]
          : [...todaySwapSides],
      });
      setBrowseMealsVisible(false);
    },
    [todaySwapSides]
  );

  const handleSelectReplacementEatOut = useCallback(
    (title?: string) => {
      handleSelectReplacementMeal(
        title?.trim() ? { ...EAT_OUT_MEAL, title: title.trim() } : EAT_OUT_MEAL
      );
    },
    [handleSelectReplacementMeal]
  );

  const handleCancelReplacement = useCallback(() => {
    if (isSwapSaving) {
      return;
    }
    setPendingReplacement(null);
    setDisplacedMealStep(null);
    setTodaySwapSides([]);
    setTodayPlanMealVisible(true);
  }, [isSwapSaving]);

  const commitReplacement = useCallback(async (
    destination: PlannedWeekDayKey | "next" | "remove"
  ) => {
    if (
      isSwapSaving ||
      !pendingReplacement ||
      !today?.key ||
      !today.mealId ||
      !today.meal
    ) {
      return;
    }
    setSwapSaving(true);
    const todayKey = today.key;
    const originalMealId = today.mealId;
    try {
      const [latestPlan, latestSides] = await Promise.all([
        getCurrentWeekPlan(weekStartISO),
        getCurrentWeekSides(weekStartISO),
      ]);
      const todayWasServed = servedEntries.some(
        (entry) =>
          entry.outcome === "served" &&
          entry.dayKey === todayKey &&
          startOfDay(new Date(entry.servedAtISO)).getTime() ===
            startOfDay(today.plannedDate).getTime()
      );
      const replacementStillExists =
        pendingReplacement.meal.id === EAT_OUT_MEAL_ID ||
        pendingReplacement.meal.id === FLEX_NIGHT_MEAL.id ||
        meals.some((meal) => meal.id === pendingReplacement.meal.id);
      const displacedMealStillExists =
        originalMealId === EAT_OUT_MEAL_ID ||
        originalMealId === FLEX_NIGHT_MEAL.id ||
        meals.some((meal) => meal.id === originalMealId);
      if (
        todayWasServed ||
        latestPlan[todayKey] !== originalMealId ||
        !replacementStillExists ||
        !displacedMealStillExists
      ) {
        setPendingReplacement(null);
        setSwapMessage("This plan changed. Please try again.");
        setTodayPlanMealVisible(true);
        await refreshWeekPlan();
        return;
      }

      const nextSpecialMealTitles = { ...(latestPlan.specialMealTitles ?? {}) };
      const displacedSpecialTitle = nextSpecialMealTitles[todayKey];
      const displacedSides = [...(latestSides[todayKey] ?? [])];
      if (
        pendingReplacement.meal.id === EAT_OUT_MEAL_ID &&
        pendingReplacement.meal.title !== EAT_OUT_MEAL.title
      ) {
        nextSpecialMealTitles[todayKey] = pendingReplacement.meal.title;
      } else {
        delete nextSpecialMealTitles[todayKey];
      }
      const nextPlan: CurrentPlannedWeek = {
        ...latestPlan,
        [todayKey]: pendingReplacement.meal.id,
      };
      const nextSides: CurrentWeekSides = {
        ...latestSides,
        [todayKey]: pendingReplacement.sides,
      };

      let updatedNextWeekPlan: CurrentPlannedWeek | null = null;
      let updatedNextWeekSides: CurrentWeekSides | null = null;
      if (destination !== "remove" && destination !== "next") {
        if (latestPlan[destination] !== null) {
          throw new Error("destination-changed");
        }
        nextPlan[destination] = originalMealId;
        nextSides[destination] = displacedSides;
        if (displacedSpecialTitle) {
          nextSpecialMealTitles[destination] = displacedSpecialTitle;
        } else {
          delete nextSpecialMealTitles[destination];
        }
      } else if (destination === "next") {
        const [latestNextPlan, latestNextSides] = await Promise.all([
          getCurrentWeekPlan(nextWeekStart.toISOString().slice(0, 10)),
          getCurrentWeekSides(nextWeekStart.toISOString().slice(0, 10)),
        ]);
        const isAlreadyPlannedNextWeek = orderedDays.some(
          (dayKey) => latestNextPlan[dayKey] === originalMealId
        );
        const isAlreadySuggested = [
          ...(latestNextPlan.savedIdeas ?? []),
          ...(latestNextPlan.carryOverIdeas ?? []),
        ].some((idea) => idea.mealId === originalMealId);
        updatedNextWeekPlan = {
          ...latestNextPlan,
          carryOverIdeas:
            isAlreadyPlannedNextWeek || isAlreadySuggested
              ? latestNextPlan.carryOverIdeas ?? []
              : [
                  ...(latestNextPlan.carryOverIdeas ?? []),
                  {
                    mealId: originalMealId,
                    title: today.meal.title,
                    emoji: today.meal.emoji,
                    suggestedAt: new Date().toISOString(),
                  },
                ],
        };
        updatedNextWeekSides = latestNextSides;
      }

      nextPlan.specialMealTitles = Object.keys(nextSpecialMealTitles).length
        ? nextSpecialMealTitles
        : undefined;

      setPlanState(nextPlan);
      setSidesState(nextSides);
      const planUpdates = [
        { weekStartISO, plan: nextPlan, sides: nextSides },
      ];
      if (updatedNextWeekPlan && updatedNextWeekSides) {
        const nextWeekStartISO = nextWeekStart.toISOString().slice(0, 10);
        planUpdates.push({
          weekStartISO: nextWeekStartISO,
          plan: updatedNextWeekPlan,
          sides: updatedNextWeekSides,
        });
      }
      await setWeekPlanDataBatch(planUpdates);

      setPendingReplacement(null);
      setDisplacedMealStep(null);
      setTodaySwapSides([]);
      await Promise.all([refreshWeekPlan(), refreshNextWeekPlan()]);
      if (destination === "next") {
        setDashboardMessage("Moved to next week’s suggestions");
      }
    } catch {
      setPendingReplacement(null);
      setDisplacedMealStep(null);
      setSwapMessage("This plan changed. Please try again.");
      setTodayPlanMealVisible(true);
      await Promise.all([refreshWeekPlan(), refreshNextWeekPlan()]);
    } finally {
      setSwapSaving(false);
    }
  }, [
    isSwapSaving,
    meals,
    nextWeekStart,
    orderedDays,
    pendingReplacement,
    refreshNextWeekPlan,
    refreshWeekPlan,
    servedEntries,
    setPlanState,
    setSidesState,
    today,
    weekStartISO,
  ]);

  const handleConfirmReplacement = useCallback(async () => {
    if (isSwapSaving || !pendingReplacement || !plan) {
      return;
    }
    const replacementIsPlannedThisWeek = orderedDays.some(
      (dayKey) => plan[dayKey] === pendingReplacement.meal.id
    );
    if (replacementIsPlannedThisWeek) {
      await commitReplacement("remove");
      return;
    }
    setDisplacedMealStep("decision");
  }, [commitReplacement, isSwapSaving, orderedDays, pendingReplacement, plan]);

  const unplannedRemainingDays = useMemo(
    () => upcomingDays.filter((day) => !day.mealId),
    [upcomingDays]
  );
  const handleMoveDisplacedThisWeek = useCallback(() => {
    if (unplannedRemainingDays.length === 1) {
      void commitReplacement(unplannedRemainingDays[0].key);
      return;
    }
    setDisplacedMealStep("day");
  }, [commitReplacement, unplannedRemainingDays]);

  const selectedSwapOption = useMemo(
    () => swapDinnerOptions.find((day) => day.key === selectedSwapDay) ?? null,
    [selectedSwapDay, swapDinnerOptions]
  );

  const handleConfirmDinnerSwap = useCallback(async () => {
    if (
      isSwapSaving ||
      !today?.key ||
      !today.mealId ||
      !today.meal ||
      !selectedSwapOption?.mealId ||
      !selectedSwapOption.meal
    ) {
      return;
    }
    setSwapSaving(true);
    const todayKey = today.key;
    const todayMealId = today.mealId;
    const selectedDayKey = selectedSwapOption.key;
    const selectedMealId = selectedSwapOption.mealId;
    try {
      const [latestPlan, latestSides] = await Promise.all([
        getCurrentWeekPlan(weekStartISO),
        getCurrentWeekSides(weekStartISO),
      ]);
      const todayWasServed = servedEntries.some(
        (entry) =>
          entry.outcome === "served" &&
          entry.dayKey === todayKey &&
          startOfDay(new Date(entry.servedAtISO)).getTime() ===
            startOfDay(today.plannedDate).getTime()
      );
      const mealStillExists = (mealId: string) =>
        mealId === EAT_OUT_MEAL_ID ||
        mealId === FLEX_NIGHT_MEAL.id ||
        meals.some((meal) => meal.id === mealId);
      const isStillValid =
        !todayWasServed &&
        latestPlan[todayKey] === todayMealId &&
        latestPlan[selectedDayKey] === selectedMealId &&
        mealStillExists(todayMealId) &&
        mealStillExists(selectedMealId);
      if (!isStillValid) {
        setSelectedSwapDay(null);
        setSwapMessage("This plan changed. Please try again.");
        await refreshWeekPlan();
        return;
      }

      const nextSpecialMealTitles = {
        ...(latestPlan.specialMealTitles ?? {}),
      };
      const todaySpecialTitle = nextSpecialMealTitles[todayKey];
      const selectedSpecialTitle = nextSpecialMealTitles[selectedDayKey];
      if (selectedSpecialTitle) {
        nextSpecialMealTitles[todayKey] = selectedSpecialTitle;
      } else {
        delete nextSpecialMealTitles[todayKey];
      }
      if (todaySpecialTitle) {
        nextSpecialMealTitles[selectedDayKey] = todaySpecialTitle;
      } else {
        delete nextSpecialMealTitles[selectedDayKey];
      }

      const nextPlan: CurrentPlannedWeek = {
        ...latestPlan,
        [todayKey]: selectedMealId,
        [selectedDayKey]: todayMealId,
        specialMealTitles: Object.keys(nextSpecialMealTitles).length
          ? nextSpecialMealTitles
          : undefined,
      };
      const nextSides: CurrentWeekSides = {
        ...latestSides,
        [todayKey]: [...(latestSides[selectedDayKey] ?? [])],
        [selectedDayKey]: [...(latestSides[todayKey] ?? [])],
      };

      setPlanState(nextPlan);
      setSidesState(nextSides);
      await Promise.all([
        setCurrentWeekPlan(weekStartISO, nextPlan),
        setCurrentWeekSides(weekStartISO, nextSides),
      ]);
      setSelectedSwapDay(null);
      setTodayPlanMealVisible(false);
      setSwapMessage(null);
      await refreshWeekPlan();
    } catch {
      setSelectedSwapDay(null);
      setSwapMessage("This plan changed. Please try again.");
      await refreshWeekPlan();
    } finally {
      setSwapSaving(false);
    }
  }, [
    isSwapSaving,
    meals,
    refreshWeekPlan,
    selectedSwapOption,
    servedEntries,
    setPlanState,
    setSidesState,
    today,
    weekStartISO,
  ]);

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
        : "/modals/plan-week?mode=current"
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
      {dashboardMessage ? (
        <View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={styles.dashboardMessage}
        >
          <MaterialCommunityIcons
            name="check-circle"
            size={18}
            color={theme.color.success}
          />
          <Text style={styles.dashboardMessageText}>{dashboardMessage}</Text>
        </View>
      ) : null}
      <Modal
        transparent
        animationType="slide"
        visible={isTodayPlanMealVisible}
        onRequestClose={handleDismissTodayPlanMeal}
      >
        <View style={styles.swapModalRoot}>
          <Pressable
            style={styles.swapModalBackdrop}
            onPress={handleDismissTodayPlanMeal}
            accessibilityRole="button"
            accessibilityLabel="Close Swap Dinner"
          />
          <View style={styles.swapSheet}>
            <View style={styles.swapSheetHandle} />
            <View style={styles.swapSheetHeader}>
              <Text style={styles.swapSheetTitle}>
                {selectedSwapOption ? "Swap Dinners?" : "Swap Dinner"}
              </Text>
              <Pressable
                onPress={handleDismissTodayPlanMeal}
                accessibilityRole="button"
                accessibilityLabel="Close Swap Dinner"
                style={styles.swapCloseButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={theme.color.ink}
                />
              </Pressable>
            </View>
            {selectedSwapOption && today?.meal ? (
              <>
                <View style={styles.swapConfirmationMeals}>
                  <View style={styles.swapConfirmationMeal}>
                    <Text style={styles.swapConfirmationDay}>Today</Text>
                    <Text style={styles.swapConfirmationEmoji}>
                      {today.meal.emoji}
                    </Text>
                    <Text style={styles.swapConfirmationTitle}>
                      {today.meal.title}
                    </Text>
                  </View>
                  <MaterialCommunityIcons
                    name="swap-vertical"
                    size={24}
                    color={theme.color.accent}
                    style={styles.swapConfirmationIcon}
                  />
                  <View style={styles.swapConfirmationMeal}>
                    <Text style={styles.swapConfirmationDay}>
                      {selectedSwapOption.displayName}
                    </Text>
                    <Text style={styles.swapConfirmationEmoji}>
                      {selectedSwapOption.meal?.emoji}
                    </Text>
                    <Text style={styles.swapConfirmationTitle}>
                      {selectedSwapOption.meal?.title}
                    </Text>
                  </View>
                </View>
                <View style={styles.swapConfirmationActions}>
                  <Pressable
                    disabled={isSwapSaving}
                    onPress={() => setSelectedSwapDay(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel dinner swap"
                    style={({ pressed }) => [
                      styles.swapConfirmationCancel,
                      pressed && styles.swapRowPressed,
                    ]}
                  >
                    <Text style={styles.swapConfirmationCancelText}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={isSwapSaving}
                    onPress={handleConfirmDinnerSwap}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm dinner swap"
                    style={({ pressed }) => [
                      styles.swapConfirmationButton,
                      isSwapSaving && styles.swapButtonDisabled,
                      pressed && !isSwapSaving && styles.swapRowPressed,
                    ]}
                  >
                    {isSwapSaving ? (
                      <ActivityIndicator color={theme.color.ink} />
                    ) : (
                      <Text style={styles.swapConfirmationButtonText}>
                        Swap
                      </Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                {swapMessage ? (
                  <Text style={styles.swapErrorText}>{swapMessage}</Text>
                ) : null}
                <Text style={styles.swapSectionLabel}>Planned This Week</Text>
                {swapDinnerOptions.length > 0 ? (
                  <View style={styles.swapMealList}>
                    {swapDinnerOptions.map((day) => (
                      <Pressable
                        key={`${day.key}-${day.mealId}`}
                        onPress={() => {
                          setSwapMessage(null);
                          setSelectedSwapDay(day.key);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={`${day.label}, ${day.meal?.title}`}
                        style={({ pressed }) => [
                          styles.swapMealRow,
                          pressed && styles.swapRowPressed,
                        ]}
                      >
                        <Text style={styles.swapDayLabel}>{day.label}</Text>
                        <Text style={styles.swapMealEmoji}>
                          {day.meal?.emoji}
                        </Text>
                        <Text style={styles.swapMealTitle} numberOfLines={1}>
                          {day.meal?.title}
                        </Text>
                        <MaterialCommunityIcons
                          name="chevron-right"
                          size={22}
                          color={theme.color.subtleInk}
                        />
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.swapEmptyText}>
                    No other meals are planned this week.
                  </Text>
                )}
                <Pressable
                  onPress={handleBrowseOtherMeals}
                  accessibilityRole="button"
                  accessibilityLabel="Browse other meals"
                  style={({ pressed }) => [
                    styles.swapBrowseButton,
                    pressed && styles.swapRowPressed,
                  ]}
                >
                  <Text style={styles.swapBrowseText}>Browse Other Meals</Text>
                  <MaterialCommunityIcons
                    name="arrow-right"
                    size={18}
                    color={theme.color.accent}
                  />
                </Pressable>
                <Pressable
                  onPress={handleDismissTodayPlanMeal}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel Swap Dinner"
                  style={({ pressed }) => [
                    styles.swapCancelButton,
                    pressed && styles.swapRowPressed,
                  ]}
                >
                  <Text style={styles.swapCancelText}>Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
      <SuggestMealModal
        visible={isBrowseMealsVisible}
        dayName={PLANNED_WEEK_DISPLAY_NAMES[todayPlanDay]}
        mode="changeDinner"
        currentMeal={today?.meal ?? null}
        suggestion={todaySuggestionEntry}
        canSuggestAnother={todaySuggestionPool.length > 1}
        onDismiss={handleDismissBrowseMeals}
        onAddMeal={handleSelectReplacementMeal}
        onSuggestAnother={handleSuggestAnotherTodayMeal}
        meals={sortedMeals}
        onSelectSearchMeal={handleSelectReplacementMeal}
        onEatOut={handleSelectReplacementEatOut}
        onFlexNight={() => handleSelectReplacementMeal(FLEX_NIGHT_MEAL)}
        getLastServedISO={getMealLastServedISO}
        sides={todaySwapSides}
        onAddSide={handleAddTodaySwapSide}
        onRemoveSide={handleRemoveTodaySwapSide}
        pins={todayPlanPins}
        onPinsChange={handleTodayPlanPinsChange}
      />
      <Modal
        transparent
        animationType="slide"
        visible={Boolean(pendingReplacement && !displacedMealStep)}
        onRequestClose={handleCancelReplacement}
      >
        <View style={styles.swapModalRoot}>
          <Pressable
            style={styles.swapModalBackdrop}
            onPress={handleCancelReplacement}
            accessibilityRole="button"
            accessibilityLabel="Cancel dinner replacement"
          />
          <View style={styles.swapSheet}>
            <View style={styles.swapSheetHandle} />
            <View style={styles.swapSheetHeader}>
              <Text style={styles.swapSheetTitle}>Replace Today's Dinner?</Text>
              <Pressable
                onPress={handleCancelReplacement}
                accessibilityRole="button"
                accessibilityLabel="Cancel dinner replacement"
                style={styles.swapCloseButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={theme.color.ink}
                />
              </Pressable>
            </View>
            {pendingReplacement && today?.meal ? (
              <>
                <View style={styles.swapConfirmationMeals}>
                  <View>
                    <Text style={styles.swapReplaceSectionLabel}>Today</Text>
                    <View style={styles.swapConfirmationMeal}>
                      <Text style={styles.swapConfirmationEmoji}>
                        {today.meal.emoji}
                      </Text>
                      <Text style={styles.swapConfirmationTitle}>
                        {today.meal.title}
                      </Text>
                    </View>
                  </View>
                  <View>
                    <Text style={styles.swapReplaceSectionLabel}>
                      Replace With
                    </Text>
                    <View style={styles.swapConfirmationMeal}>
                      <Text style={styles.swapConfirmationEmoji}>
                        {pendingReplacement.meal.emoji}
                      </Text>
                      <Text style={styles.swapConfirmationTitle}>
                        {pendingReplacement.meal.title}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.swapConfirmationActions}>
                  <Pressable
                    disabled={isSwapSaving}
                    onPress={handleCancelReplacement}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel dinner replacement"
                    style={({ pressed }) => [
                      styles.swapConfirmationCancel,
                      pressed && styles.swapRowPressed,
                    ]}
                  >
                    <Text style={styles.swapConfirmationCancelText}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={isSwapSaving}
                    onPress={handleConfirmReplacement}
                    accessibilityRole="button"
                    accessibilityLabel="Confirm dinner replacement"
                    style={({ pressed }) => [
                      styles.swapConfirmationButton,
                      isSwapSaving && styles.swapButtonDisabled,
                      pressed && !isSwapSaving && styles.swapRowPressed,
                    ]}
                  >
                    {isSwapSaving ? (
                      <ActivityIndicator color={theme.color.ink} />
                    ) : (
                      <Text style={styles.swapConfirmationButtonText}>
                        Replace
                      </Text>
                    )}
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
      <Modal
        transparent
        animationType="slide"
        visible={Boolean(pendingReplacement && displacedMealStep)}
        onRequestClose={handleCancelReplacement}
      >
        <View style={styles.swapModalRoot}>
          <Pressable
            style={styles.swapModalBackdrop}
            onPress={handleCancelReplacement}
            accessibilityRole="button"
            accessibilityLabel="Cancel displaced meal choice"
          />
          <View style={styles.swapSheet}>
            <View style={styles.swapSheetHandle} />
            <View style={styles.swapSheetHeader}>
              <Text style={styles.swapSheetTitle}>
                {displacedMealStep === "day" ? "Move To" : "What should happen to:"}
              </Text>
              <Pressable
                disabled={isSwapSaving}
                onPress={handleCancelReplacement}
                accessibilityRole="button"
                accessibilityLabel="Cancel displaced meal choice"
                style={styles.swapCloseButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={20}
                  color={theme.color.ink}
                />
              </Pressable>
            </View>
            {today?.meal && displacedMealStep === "decision" ? (
              <>
                <View style={styles.displacedMealSummary}>
                  <Text style={styles.swapConfirmationEmoji}>
                    {today.meal.emoji}
                  </Text>
                  <Text style={styles.swapConfirmationTitle}>
                    {today.meal.title}
                  </Text>
                </View>
                <View style={styles.displacedIntro}>
                  <Text style={styles.displacedIntroTitle}>
                    You've already planned this meal.
                  </Text>
                  <Text style={styles.displacedIntroText}>
                    Choose what you'd like to do with it.
                  </Text>
                </View>
                <View style={styles.displacedActionList}>
                  {unplannedRemainingDays.length > 0 ? (
                    <Pressable
                      disabled={isSwapSaving}
                      onPress={handleMoveDisplacedThisWeek}
                      accessibilityRole="button"
                      accessibilityLabel="Move to another day"
                      style={({ pressed }) => [
                        styles.displacedActionRow,
                        pressed && styles.swapRowPressed,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="calendar-arrow-right"
                        size={22}
                        color={theme.color.accent}
                      />
                      <View style={styles.displacedActionCopy}>
                        <Text style={styles.displacedActionTitle}>
                          Move to Another Day
                        </Text>
                        <Text style={styles.displacedActionSubtitle}>
                          Move this meal to another unplanned day this week.
                        </Text>
                      </View>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={22}
                        color={theme.color.subtleInk}
                      />
                    </Pressable>
                  ) : null}
                  <Pressable
                    disabled={isSwapSaving}
                    onPress={() => void commitReplacement("next")}
                    accessibilityRole="button"
                    accessibilityLabel="Move to next week suggestions"
                    style={({ pressed }) => [
                      styles.displacedActionRow,
                      pressed && styles.swapRowPressed,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="calendar-week-begin"
                      size={22}
                      color={theme.color.accent}
                    />
                    <View style={styles.displacedActionCopy}>
                      <Text style={styles.displacedActionTitle}>
                        Move to Next Week
                      </Text>
                      <Text style={styles.displacedActionSubtitle}>
                        Add this meal to next week's Suggested by You.
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={22}
                      color={theme.color.subtleInk}
                    />
                  </Pressable>
                  <Pressable
                    disabled={isSwapSaving}
                    onPress={() => void commitReplacement("remove")}
                    accessibilityRole="button"
                    accessibilityLabel="Remove from this week"
                    style={({ pressed }) => [
                      styles.displacedActionRow,
                      pressed && styles.swapRowPressed,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name="calendar-remove-outline"
                      size={22}
                      color={theme.color.accent}
                    />
                    <View style={styles.displacedActionCopy}>
                      <Text style={styles.displacedActionTitle}>
                        Remove from This Week
                      </Text>
                      <Text style={styles.displacedActionSubtitle}>
                        Remove the assignment. The meal stays in your library.
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={22}
                      color={theme.color.subtleInk}
                    />
                  </Pressable>
                </View>
                {isSwapSaving ? (
                  <ActivityIndicator color={theme.color.accent} />
                ) : null}
                <Pressable
                  disabled={isSwapSaving}
                  onPress={handleCancelReplacement}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel dinner replacement"
                  style={styles.swapCancelButton}
                >
                  <Text style={styles.swapCancelText}>Cancel</Text>
                </Pressable>
              </>
            ) : null}
            {displacedMealStep === "day" ? (
              <View style={styles.swapMealList}>
                {unplannedRemainingDays.map((day) => (
                  <Pressable
                    key={day.key}
                    disabled={isSwapSaving}
                    onPress={() => void commitReplacement(day.key)}
                    accessibilityRole="button"
                    accessibilityLabel={`Move meal to ${day.displayName}`}
                    style={({ pressed }) => [
                      styles.swapMealRow,
                      pressed && styles.swapRowPressed,
                    ]}
                  >
                    <Text style={styles.moveDayTitle}>{day.displayName}</Text>
                    {isSwapSaving ? (
                      <ActivityIndicator color={theme.color.accent} />
                    ) : (
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={22}
                        color={theme.color.subtleInk}
                      />
                    )}
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
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
    dashboardMessage: {
      position: "absolute",
      left: theme.space.xl,
      right: theme.space.xl,
      bottom: 96,
      zIndex: 20,
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.sm,
      paddingHorizontal: theme.space.lg,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
    },
    dashboardMessageText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
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
    swapModalRoot: {
      flex: 1,
      justifyContent: "flex-end",
    },
    swapModalBackdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.56)",
    },
    swapSheet: {
      gap: theme.space.md,
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space.sm,
      paddingBottom: theme.space["2xl"],
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    swapSheetHandle: {
      width: 38,
      height: 4,
      alignSelf: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.subtleInk,
      opacity: 0.45,
    },
    swapSheetHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.space.md,
    },
    swapSheetTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
    },
    swapCloseButton: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
    },
    swapSectionLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      textTransform: "uppercase",
    },
    swapMealList: {
      overflow: "hidden",
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    swapMealRow: {
      minHeight: 52,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      paddingHorizontal: theme.space.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border,
    },
    swapDayLabel: {
      width: 42,
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    swapMealEmoji: {
      width: 26,
      textAlign: "center",
      fontSize: 20,
    },
    swapMealTitle: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    swapRowPressed: {
      opacity: 0.72,
    },
    swapEmptyText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      paddingVertical: theme.space.md,
    },
    swapBrowseButton: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.xs,
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
    },
    swapBrowseText: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    swapCancelButton: {
      minHeight: 42,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
    },
    swapCancelText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    swapErrorText: {
      color: theme.color.danger,
      fontSize: theme.type.size.sm,
      padding: theme.space.md,
      borderRadius: theme.radius.md,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(239, 68, 68, 0.10)"
          : "rgba(239, 68, 68, 0.06)",
    },
    swapConfirmationMeals: {
      gap: theme.space.sm,
      paddingVertical: theme.space.sm,
    },
    swapConfirmationMeal: {
      minHeight: 66,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
      paddingHorizontal: theme.space.lg,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    swapConfirmationDay: {
      width: 72,
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    swapReplaceSectionLabel: {
      marginBottom: theme.space.xs,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    displacedMealSummary: {
      minHeight: 62,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
      paddingHorizontal: theme.space.lg,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    displacedIntro: {
      gap: theme.space.xs,
    },
    displacedIntroTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    displacedIntroText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    displacedActionList: {
      overflow: "hidden",
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    displacedActionRow: {
      minHeight: 68,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border,
    },
    displacedActionCopy: {
      flex: 1,
      gap: 2,
    },
    displacedActionTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    displacedActionSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      lineHeight: 17,
    },
    moveDayTitle: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    swapConfirmationEmoji: {
      width: 30,
      textAlign: "center",
      fontSize: 24,
    },
    swapConfirmationTitle: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    swapConfirmationIcon: {
      alignSelf: "center",
    },
    swapConfirmationActions: {
      flexDirection: "row",
      gap: theme.space.md,
    },
    swapConfirmationCancel: {
      flex: 1,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    swapConfirmationCancelText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    swapConfirmationButton: {
      flex: 1,
      minHeight: 48,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.accent,
    },
    swapConfirmationButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    swapButtonDisabled: {
      opacity: 0.55,
    },
  });
