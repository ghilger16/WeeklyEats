import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  LayoutAnimation,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
  findNodeHandle,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { useMeals } from "../../hooks/useMeals";
import SuggestionsContainer from "../../components/plan-week/suggestions/SuggestionsContainer";
import {
  CurrentPlannedWeek,
  PLANNED_WEEK_DISPLAY_NAMES,
  PLANNED_WEEK_LABELS,
  PLANNED_WEEK_ORDER,
  PlannedWeekDayKey,
  createEmptyCurrentPlannedWeek,
  createEmptyCurrentWeekSides,
} from "../../types/weekPlan";
import { Meal } from "../../types/meals";
import { useCurrentWeekPlan } from "../../hooks/useCurrentWeekPlan";
import {
  setCurrentWeekPlan,
  setCurrentWeekSides,
  addWeekPlanHistory,
  updateWeekPlanStreak,
} from "../../stores/weekPlanStorage";
import { useWeekStartController } from "../../providers/week-start/WeekStartController";
import { buildMealSuggestions } from "../../components/plan-week/suggestions/suggestionMatcher";
import SuggestMealModal from "../../components/plan-week/suggestions/SuggestMealModal";
import { EAT_OUT_MEAL, EAT_OUT_MEAL_ID } from "../../types/specialMeals";
import {
  addDays,
  getNextWeekStartForDate,
  getWeekStartForDate,
} from "../../utils/weekDays";
import PlanDayChoiceStep, {
  DayWizardAction,
} from "../../components/plan-week/steps/PlanDayChoiceStep";
import PlannedMealsSheet from "../../components/plan-week/planned-meals/PlannedMealsSheet";
import DayPlannedToast from "../../components/plan-week/planned-meals/DayPlannedToast";
import PlanWeekHeader from "../../components/plan-week/header/PlanWeekHeader";
import useDayPins from "../../hooks/plan-week/useDayPins";
import usePlanSides from "../../hooks/plan-week/usePlanSides";
import MealSearchModal from "../../components/meals/MealSearchModal";
import MealModalOverlay from "../../components/meals/MealModalOverlay";
import PinBoard from "../../components/plan-week/PinBoard";
import MealInspirationSection, {
  MealPool,
  MealPoolId,
} from "../../components/plan-week/MealInspirationSection";
import PinInventory, {
  InventoryPinId,
  isInventoryPinActive,
} from "../../components/plan-week/pins/PinInventory";
import CalendarEventLines from "../../components/plan-week/CalendarEventLines";
import {
  DayPinsState,
  createEmptyDayPinsMap,
  normalizeDayPinsState,
} from "../../types/dayPins";
import { getRemainingPlanningDays } from "../../utils/remainingWeekPlanning";
import {
  PlanningCalendarEvent,
  formatEventTime,
  getWeekEvents,
  groupEventsByDay,
} from "../../utils/calendar-service";

const createInitialSuggestionIndex = () =>
  PLANNED_WEEK_ORDER.reduce<Record<PlannedWeekDayKey, number>>(
    (acc, key) => {
      acc[key] = 0;
      return acc;
    },
    {} as Record<PlannedWeekDayKey, number>,
  );

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SUMMARY_MAX_TRANSLATE = SCREEN_HEIGHT;
const SHOW_MAIN_PIN_BOARD = false;

const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatWeekRangeLabel = (start: Date, end: Date) => {
  const startLabel = start.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const sameMonth = start.getMonth() === end.getMonth();
  const endLabel = end.toLocaleDateString(undefined, {
    month: sameMonth ? undefined : "short",
    day: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
};

const hasFreezerInventory = (meal: Meal) =>
  Boolean(
    meal.isFavorite ||
      meal.freezerAmount?.trim() ||
      meal.freezerQuantity?.trim() ||
      meal.freezerAddedAt,
  );

const isFamilyStarMeal = (meal: Meal) => {
  const familyRatings = Object.values(meal.familyRatings ?? {}).filter(
    (value) => value > 0,
  );
  if (familyRatings.length > 0) {
    return familyRatings.every((value) => value === 3);
  }
  return (meal.rating ?? 0) >= 4.5;
};

export default function PlanWeekModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string }>();
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { meals, updateMeal } = useMeals();
  const { orderedDays, startDay } = useWeekStartController();
  const isRemainingMode = params.mode === "remaining";
  const sessionDays = useMemo(() => {
    if (!isRemainingMode) {
      return orderedDays;
    }
    const remainingDays = getRemainingPlanningDays(startDay);
    return remainingDays.length ? remainingDays : orderedDays;
  }, [isRemainingMode, orderedDays, startDay]);
  const planningWeekStart = useMemo(
    () =>
      isRemainingMode
        ? getWeekStartForDate(startDay)
        : getNextWeekStartForDate(startDay),
    [isRemainingMode, startDay],
  );
  const planningWeekStartISO = useMemo(
    () => planningWeekStart.toISOString().slice(0, 10),
    [planningWeekStart],
  );
  const {
    plan,
    sides: storedSides,
    isLoading,
  } = useCurrentWeekPlan({
    weekStartOverride: planningWeekStart,
  });
  const initializedRef = useRef(false);

  const [plannedWeek, setPlannedWeek] = useState<CurrentPlannedWeek>(() =>
    createEmptyCurrentPlannedWeek({ weekStartISO: planningWeekStartISO }),
  );
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [suggestionIndexMap, setSuggestionIndexMap] = useState(
    createInitialSuggestionIndex,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSummaryVisible, setIsSummaryVisible] = useState(false);
  const summaryTranslateY = useRef(
    new Animated.Value(SUMMARY_MAX_TRANSLATE),
  ).current;
  const drawerProgress = useRef(new Animated.Value(0)).current;
  const summaryClosingRef = useRef(false);
  const [plannerSelection, setPlannerSelection] = useState<{
    day: PlannedWeekDayKey | null;
    meal: Meal | null;
  }>({ day: null, meal: null });
  const [isPlannerSaving, setPlannerSaving] = useState(false);
  const dayRowRefs = useRef<Record<PlannedWeekDayKey, View | null>>(
    {} as Record<PlannedWeekDayKey, View | null>,
  );
  const [savedIndicatorDay, setSavedIndicatorDay] =
    useState<PlannedWeekDayKey | null>(null);
  const [toastDay, setToastDay] = useState<PlannedWeekDayKey | null>(null);
  const [toastSeenDays, setToastSeenDays] = useState<Set<PlannedWeekDayKey>>(
    new Set(),
  );
  const [pendingPlannedDay, setPendingPlannedDay] =
    useState<PlannedWeekDayKey | null>(null);
  const [plannedCardPreviewDay, setPlannedCardPreviewDay] =
    useState<PlannedWeekDayKey | null>(null);
  const [resumePromptVisible, setResumePromptVisible] = useState(false);
  const [activeWizardAction, setActiveWizardAction] =
    useState<DayWizardAction | null>(null);
  const [isCelebratingSave, setIsCelebratingSave] = useState(false);
  const [celebratedDayIndex, setCelebratedDayIndex] = useState<number | null>(
    null,
  );
  const [saveToastPayload, setSaveToastPayload] = useState<{
    title: string;
    subtitle?: string;
    onComplete?: () => void;
  } | null>(null);
  const [isSearchModalVisible, setSearchModalVisible] = useState(false);
  const [searchTargetDay, setSearchTargetDay] =
    useState<PlannedWeekDayKey | null>(null);
  const [isSuggestModalVisible, setSuggestModalVisible] = useState(false);
  const [suggestTargetDay, setSuggestTargetDay] =
    useState<PlannedWeekDayKey | null>(null);
  const [expandedDrawerDay, setExpandedDrawerDay] =
    useState<PlannedWeekDayKey | null>(null);
  const [isPinInventoryVisible, setPinInventoryVisible] = useState(false);
  const [inventoryPulseTrigger, setInventoryPulseTrigger] = useState<{
    id: string;
    nonce: number;
  } | null>(null);
  const [viewingMealId, setViewingMealId] = useState<Meal["id"] | null>(null);
  const [selectedSavedIdeaMealId, setSelectedSavedIdeaMealId] = useState<
    Meal["id"] | null
  >(null);
  const [selectedMealPoolId, setSelectedMealPoolId] =
    useState<MealPoolId | null>(null);
  const [isCalendarContextVisible, setCalendarContextVisible] =
    useState(false);
  const [planningCalendarEvents, setPlanningCalendarEvents] = useState<
    PlanningCalendarEvent[]
  >([]);
  const [loadedCalendarWeekKey, setLoadedCalendarWeekKey] = useState<
    string | null
  >(null);
  const rowCelebrationScales = useMemo(
    () => sessionDays.map(() => new Animated.Value(1)),
    [sessionDays],
  );
  const fallbackRowCelebrationScale = useRef(new Animated.Value(1)).current;

  const animateSummaryTo = useCallback(
    (toValue: number, duration: number, easing: (value: number) => number) =>
      new Promise<void>((resolve) => {
        Animated.timing(summaryTranslateY, {
          toValue,
          duration,
          easing,
          useNativeDriver: true,
        }).start(() => {
          resolve();
        });
      }),
    [summaryTranslateY],
  );

  const handleOpenSummary = useCallback(() => {
    if (summaryClosingRef.current) {
      return;
    }
    setIsSummaryVisible(true);
  }, []);

  const handleToggleCalendarContext = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    setCalendarContextVisible((current) => !current);
  }, []);

  const handleCloseSummary = useCallback(async () => {
    if (summaryClosingRef.current || !isSummaryVisible) {
      return;
    }
    summaryClosingRef.current = true;
    await animateSummaryTo(
      SUMMARY_MAX_TRANSLATE,
      theme.motion.duration.normal,
      Easing.bezier(0.4, 0, 1, 1),
    );
    summaryClosingRef.current = false;
    setIsSummaryVisible(false);
    setPlannerSelection({ day: null, meal: null });
    setPendingPlannedDay(null);
  }, [animateSummaryTo, isSummaryVisible, theme.motion.duration.normal]);

  const activeDay =
    sessionDays[activeDayIndex] ?? sessionDays[0] ?? PLANNED_WEEK_ORDER[0];
  const {
    dayPinsMap,
    activeDayPins,
    handleDayPinsChange,
    replaceDayPins,
  } = useDayPins({
    activeDay,
  });
  const {
    daySidesMap,
    activeDaySides,
    handleAddSide,
    handleRemoveSide,
    resetSides,
  } = usePlanSides({ activeDay });
  const planningRangeStart = useMemo(() => {
    if (!isRemainingMode || !sessionDays.length) {
      return planningWeekStart;
    }
    const firstDay = sessionDays[0];
    const dayOffset = orderedDays.indexOf(firstDay);
    return addDays(planningWeekStart, Math.max(dayOffset, 0));
  }, [isRemainingMode, orderedDays, planningWeekStart, sessionDays]);
  const planningWeekEnd = useMemo(
    () => {
      if (!isRemainingMode || !sessionDays.length) {
        return addDays(planningWeekStart, 6);
      }
      const activeEndDay = sessionDays[sessionDays.length - 1];
      const dayOffset = orderedDays.indexOf(activeEndDay);
      return addDays(planningWeekStart, Math.max(dayOffset, 0));
    },
    [isRemainingMode, orderedDays, planningWeekStart, sessionDays],
  );
  const planningWeekLabel = useMemo(
    () => formatWeekRangeLabel(planningRangeStart, planningWeekEnd),
    [planningRangeStart, planningWeekEnd],
  );
  const dayDateMap = useMemo(
    () =>
      PLANNED_WEEK_ORDER.reduce<Record<PlannedWeekDayKey, string>>(
        (acc, day) => {
          const dayOffset = orderedDays.indexOf(day);
          acc[day] = formatDateKey(
            addDays(planningWeekStart, Math.max(dayOffset, 0)),
          );
          return acc;
        },
        {} as Record<PlannedWeekDayKey, string>,
      ),
    [orderedDays, planningWeekStart],
  );
  const calendarWeekKey = useMemo(
    () =>
      `${formatDateKey(planningRangeStart)}:${formatDateKey(planningWeekEnd)}`,
    [planningRangeStart, planningWeekEnd],
  );
  const groupedCalendarEvents = useMemo(
    () => groupEventsByDay(planningCalendarEvents),
    [planningCalendarEvents],
  );

  const handleResumeContinue = useCallback(() => {
    setResumePromptVisible(false);
  }, []);

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  const handleResumeRestart = useCallback(async () => {
    const emptyPlan = createEmptyCurrentPlannedWeek({
      weekStartISO: planningWeekStartISO,
    });
    const emptySides = createEmptyCurrentWeekSides();
    setPlannedWeek(emptyPlan);
    resetSides(emptySides);
    replaceDayPins(createEmptyDayPinsMap());
    setResumePromptVisible(false);
    setActiveDayIndex(0);
    setToastSeenDays(new Set());
    setToastDay(null);
    setPendingPlannedDay(null);
    setPlannedCardPreviewDay(null);
    setActiveWizardAction(null);
    setSavedIndicatorDay(null);
    await Promise.all([
      setCurrentWeekPlan(planningWeekStartISO, emptyPlan),
      setCurrentWeekSides(planningWeekStartISO, emptySides),
    ]);
  }, [planningWeekStartISO, replaceDayPins, resetSides]);
  const isWeekComplete = useMemo(
    () => sessionDays.every((day) => Boolean(plannedWeek[day])),
    [sessionDays, plannedWeek],
  );
  const isDayPlanningStep = Boolean(activeWizardAction);

  useEffect(() => {
    setActiveDayIndex(0);
  }, [sessionDays]);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!initializedRef.current) {
      initializedRef.current = true;
      setPlannedWeek(plan);
    }
  }, [isLoading, plan]);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    resetSides(storedSides);
  }, [isLoading, resetSides, storedSides]);

  useEffect(() => {
    if (isLoading) {
      return;
    }
    const hasMeals = PLANNED_WEEK_ORDER.some(
      (dayKey) => typeof plan[dayKey] === "string",
    );
    const isTargetWeek =
      plan.weekStartISO === planningWeekStartISO || !plan.weekStartISO;
    const shouldPromptResume = isTargetWeek && !plan.weekedPlanned && hasMeals;
    setResumePromptVisible(shouldPromptResume);
  }, [isLoading, plan, planningWeekStartISO]);

  useEffect(() => {
    setActiveWizardAction(null);
    setPlannedCardPreviewDay(null);
    setPinInventoryVisible(false);
  }, [activeDay]);

  useEffect(() => {
    if (!isSummaryVisible) {
      return;
    }
    summaryClosingRef.current = false;
    summaryTranslateY.setValue(SUMMARY_MAX_TRANSLATE);
    animateSummaryTo(
      0,
      theme.motion.duration.slow,
      Easing.bezier(0, 0, 0.2, 1),
    ).then(() => {
      if (plannerSelection.day) {
        const targetNode = dayRowRefs.current[plannerSelection.day];
        const handle = targetNode ? findNodeHandle(targetNode) : null;
        if (handle) {
          AccessibilityInfo.setAccessibilityFocus(handle);
        }
      }
    });
  }, [
    animateSummaryTo,
    isSummaryVisible,
    plannerSelection.day,
    summaryTranslateY,
    theme.motion.duration.slow,
  ]);

  useEffect(() => {
    if (!expandedDrawerDay) {
      return;
    }
    drawerProgress.setValue(0);
    Animated.timing(drawerProgress, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [drawerProgress, expandedDrawerDay]);

  useEffect(() => {
    if (celebratedDayIndex === null) {
      rowCelebrationScales.forEach((entry) => entry.setValue(1));
      return;
    }

    const target = rowCelebrationScales[celebratedDayIndex];
    if (!target) {
      return;
    }

    Animated.sequence([
      Animated.spring(target, {
        toValue: 1.025,
        useNativeDriver: true,
        bounciness: 5,
      }),
      Animated.spring(target, {
        toValue: 1,
        useNativeDriver: true,
        bounciness: 4,
      }),
    ]).start();
  }, [celebratedDayIndex, rowCelebrationScales]);

  useEffect(() => {
    if (!inventoryPulseTrigger) {
      return;
    }
    const timeout = setTimeout(() => setInventoryPulseTrigger(null), 0);
    return () => clearTimeout(timeout);
  }, [inventoryPulseTrigger]);

  useEffect(() => {
    if (!isCalendarContextVisible || loadedCalendarWeekKey === calendarWeekKey) {
      return;
    }

    let isCancelled = false;
    getWeekEvents(planningRangeStart, planningWeekEnd)
      .then((events) => {
        if (isCancelled) {
          return;
        }
        setPlanningCalendarEvents(events);
        setLoadedCalendarWeekKey(calendarWeekKey);
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }
        setPlanningCalendarEvents([]);
        setLoadedCalendarWeekKey(calendarWeekKey);
        setCalendarContextVisible(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [
    calendarWeekKey,
    isCalendarContextVisible,
    loadedCalendarWeekKey,
    planningRangeStart,
    planningWeekEnd,
  ]);

  const filteredMeals = useMemo(
    () =>
      [...meals].sort((a, b) =>
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
      ),
    [meals],
  );

  const mealPools = useMemo<MealPool[]>(() => {
    const savedIdeaMeals = (plannedWeek.savedIdeas ?? [])
      .map((idea) => meals.find((meal) => meal.id === idea.mealId))
      .filter(Boolean) as Meal[];
    return [
      {
        id: "suggestedByYou",
        title: "Suggested by You",
        subtitle: "Meals you saved for this week.",
        nextIcon: "❄️",
        emptyText: "Meals you save for planning will appear here.",
        meals: savedIdeaMeals,
      },
      {
        id: "freezerMeals",
        title: "Freezer Meals",
        subtitle: "Meals ready from your freezer.",
        nextIcon: "⭐",
        chipIcon: "❄️",
        emptyText: "Freezer-ready meals will appear here.",
        meals: meals.filter(hasFreezerInventory),
      },
      {
        id: "familyStars",
        title: "Family Stars",
        subtitle: "Your highest-rated meals.",
        nextIcon: "💡",
        chipIcon: "⭐",
        emptyText: "Top-rated family meals will appear here.",
        meals: meals.filter(isFamilyStarMeal),
      },
    ];
  }, [meals, plannedWeek.savedIdeas]);

  const plannedMealIds = useMemo(
    () =>
      new Set(
        Object.values(plannedWeek).filter(
          (mealId): mealId is Meal["id"] => typeof mealId === "string",
        ),
      ),
    [plannedWeek],
  );

  const suggestionPool = useMemo(
    () => buildMealSuggestions(filteredMeals, activeDayPins, plannedMealIds),
    [activeDayPins, filteredMeals, plannedMealIds],
  );

  const activeSuggestionEntry = useMemo(() => {
    if (!suggestionPool.length) {
      return undefined;
    }
    const index = suggestionIndexMap[activeDay] ?? 0;
    const normalizedIndex =
      ((index % suggestionPool.length) + suggestionPool.length) %
      suggestionPool.length;
    return suggestionPool[normalizedIndex];
  }, [activeDay, suggestionIndexMap, suggestionPool]);

  const activeSuggestion = activeSuggestionEntry?.meal;
  const activeSuggestionContext = activeSuggestionEntry?.context;
  const suggestModalDay = suggestTargetDay ?? activeDay;
  const searchModalTitleDay = searchTargetDay ?? activeDay;
  const suggestModalPins = useMemo(
    () => normalizeDayPinsState(dayPinsMap[suggestModalDay]),
    [dayPinsMap, suggestModalDay],
  );
  const searchModalPins = useMemo(
    () => normalizeDayPinsState(dayPinsMap[searchModalTitleDay]),
    [dayPinsMap, searchModalTitleDay],
  );
  const suggestModalPool = useMemo(
    () => buildMealSuggestions(filteredMeals, suggestModalPins, plannedMealIds),
    [filteredMeals, plannedMealIds, suggestModalPins],
  );
  const suggestModalEntry = useMemo(() => {
    if (!suggestModalPool.length) {
      return undefined;
    }
    const index = suggestionIndexMap[suggestModalDay] ?? 0;
    const normalizedIndex =
      ((index % suggestModalPool.length) + suggestModalPool.length) %
      suggestModalPool.length;
    return suggestModalPool[normalizedIndex];
  }, [suggestModalDay, suggestModalPool, suggestionIndexMap]);

  const plannedMealForActiveDay = useMemo<Meal | undefined>(() => {
    const mealId = plannedWeek[activeDay];
    if (!mealId) {
      return undefined;
    }
    if (mealId === EAT_OUT_MEAL_ID) {
      return EAT_OUT_MEAL;
    }
    return meals.find((candidate) => candidate.id === mealId);
  }, [activeDay, meals, plannedWeek]);

  const getPlannedMealForDay = useCallback(
    (day: PlannedWeekDayKey): Meal | undefined => {
      const mealId = plannedWeek[day];
      if (!mealId) {
        return undefined;
      }
      if (mealId === EAT_OUT_MEAL_ID) {
        return EAT_OUT_MEAL;
      }
      return meals.find((candidate) => candidate.id === mealId);
    },
    [meals, plannedWeek],
  );

  const handleSelectPlannerDay = useCallback((day: PlannedWeekDayKey) => {
    setPlannerSelection((prev) => {
      if (!prev.meal) {
        return prev;
      }
      if (prev.day === day) {
        return prev;
      }
      return {
        day,
        meal: prev.meal,
      };
    });
  }, []);

  const saveMealToDay = useCallback(
    async (
      day: PlannedWeekDayKey,
      meal: Meal,
      options: { removeSavedIdea?: boolean } = {},
    ) => {
      if (isPlannerSaving) {
        return;
      }
      setPlannerSaving(true);
      savedIndicatorDay && setSavedIndicatorDay(null);
      const nextPlan: CurrentPlannedWeek = {
        ...plannedWeek,
        [day]: meal.id,
        weekedPlanned: false,
        weekStartISO: planningWeekStartISO,
        plannedScope: isRemainingMode ? "remaining" : "full",
        savedIdeas: options.removeSavedIdea
          ? (plannedWeek.savedIdeas ?? []).filter(
              (idea) => idea.mealId !== meal.id,
            )
          : plannedWeek.savedIdeas ?? [],
      };
      setPlannedWeek(nextPlan);
      setSelectedSavedIdeaMealId(null);
      setSelectedMealPoolId(null);
      setPendingPlannedDay(day);
      try {
        await Promise.all([
          setCurrentWeekPlan(planningWeekStartISO, nextPlan),
          setCurrentWeekSides(planningWeekStartISO, daySidesMap),
        ]);
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success,
        ).catch(() => {});
        setSavedIndicatorDay(day);
        setTimeout(() => {
          setSavedIndicatorDay(null);
          setExpandedDrawerDay(null);
          setToastDay(day);
          setPendingPlannedDay(null);
          setActiveWizardAction(null);
          setPlannedCardPreviewDay(null);
        }, 240);
      } finally {
        setPlannerSaving(false);
      }
    },
    [
      daySidesMap,
      isPlannerSaving,
      plannedWeek,
      planningWeekStartISO,
      savedIndicatorDay,
      isRemainingMode,
    ],
  );

  const handleSelectMealPoolMeal = useCallback(
    (meal: Meal, poolId: MealPoolId) => {
      if (expandedDrawerDay) {
        saveMealToDay(expandedDrawerDay, meal, {
          removeSavedIdea: poolId === "suggestedByYou",
        });
        return;
      }
      Haptics.selectionAsync().catch(() => {});
      const shouldClear =
        selectedSavedIdeaMealId === meal.id && selectedMealPoolId === poolId;
      setSelectedSavedIdeaMealId(shouldClear ? null : meal.id);
      setSelectedMealPoolId(shouldClear ? null : poolId);
    },
    [
      expandedDrawerDay,
      saveMealToDay,
      selectedMealPoolId,
      selectedSavedIdeaMealId,
    ],
  );

  const handlePlanMealPoolMealForDay = useCallback(
    (day: PlannedWeekDayKey) => {
      const meal = meals.find(
        (candidate) => candidate.id === selectedSavedIdeaMealId,
      );
      if (!meal) {
        return;
      }
      saveMealToDay(day, meal, {
        removeSavedIdea: selectedMealPoolId === "suggestedByYou",
      });
    },
    [meals, saveMealToDay, selectedMealPoolId, selectedSavedIdeaMealId],
  );

  const handleRemoveSavedIdea = useCallback(
    async (mealId: Meal["id"]) => {
      const nextPlan: CurrentPlannedWeek = {
        ...plannedWeek,
        weekStartISO: planningWeekStartISO,
        savedIdeas: (plannedWeek.savedIdeas ?? []).filter(
          (idea) => idea.mealId !== mealId,
        ),
      };
      setPlannedWeek(nextPlan);
      if (selectedSavedIdeaMealId === mealId) {
        setSelectedSavedIdeaMealId(null);
        setSelectedMealPoolId(null);
      }
      await setCurrentWeekPlan(planningWeekStartISO, nextPlan);
    },
    [plannedWeek, planningWeekStartISO, selectedSavedIdeaMealId],
  );

  const handleAddMeal = useCallback(() => {
    if (!activeSuggestion) {
      return;
    }
    saveMealToDay(activeDay, activeSuggestion);
  }, [activeDay, activeSuggestion, saveMealToDay]);

  const handleSelectSearchMeal = useCallback(
    (meal: Meal) => {
      const targetDay = searchTargetDay ?? activeDay;
      setSearchModalVisible(false);
      setSearchTargetDay(null);
      saveMealToDay(targetDay, meal);
    },
    [activeDay, saveMealToDay, searchTargetDay],
  );

  const handleDismissSearchModal = useCallback(() => {
    setSearchModalVisible(false);
    setSearchTargetDay(null);
  }, []);

  const handleTogglePinInventory = useCallback(() => {
    setPinInventoryVisible((prev) => !prev);
  }, []);

  const handleAddInventoryPin = useCallback(
    (pin: InventoryPinId) => {
      if (isInventoryPinActive(pin, activeDayPins)) {
        setPinInventoryVisible(false);
        return;
      }
      Haptics.selectionAsync().catch(() => {});
      const next = normalizeDayPinsState(activeDayPins);
      let pulseId: string | null = null;
      switch (pin) {
        case "difficulty":
          next.effort = "easy";
          pulseId = "effort";
          break;
        case "expense":
          next.expense = "$";
          pulseId = "expense";
          break;
        case "reuse":
          next.reuseWeeks = 1;
          pulseId = "reuse";
          break;
        case "family":
          next.familyStar = "include";
          pulseId = "family-star";
          break;
        case "freezer":
          next.freezerNight = true;
          pulseId = "freezer";
          break;
        default:
          break;
      }
      handleDayPinsChange(activeDay, next);
      if (pulseId) {
        setInventoryPulseTrigger({ id: pulseId, nonce: Date.now() });
      }
      setPinInventoryVisible(false);
    },
    [activeDay, activeDayPins, handleDayPinsChange],
  );

  const handleSelectEatOut = useCallback(() => {
    saveMealToDay(activeDay, EAT_OUT_MEAL);
  }, [activeDay, saveMealToDay]);

  const handleEatOutDrawerDay = useCallback(
    (day: PlannedWeekDayKey) => {
      setExpandedDrawerDay(null);
      saveMealToDay(day, EAT_OUT_MEAL);
    },
    [saveMealToDay],
  );

  const handleSearchDrawerDay = useCallback((day: PlannedWeekDayKey) => {
    setSearchTargetDay(day);
    setSearchModalVisible(true);
  }, []);

  const handleSuggestDrawerDay = useCallback(
    (day: PlannedWeekDayKey) => {
      const targetIndex = sessionDays.indexOf(day);
      if (targetIndex !== -1) {
        setActiveDayIndex(targetIndex);
      }
      setSuggestTargetDay(day);
      setSuggestModalVisible(true);
    },
    [sessionDays],
  );

  const handleDismissSuggestModal = useCallback(() => {
    setSuggestModalVisible(false);
    setSuggestTargetDay(null);
  }, []);

  const handleAddSuggestedMeal = useCallback(
    (meal: Meal) => {
      const targetDay = suggestTargetDay ?? activeDay;
      setSuggestModalVisible(false);
      setSuggestTargetDay(null);
      saveMealToDay(targetDay, meal);
    },
    [activeDay, saveMealToDay, suggestTargetDay],
  );

  const handleSuggestAnother = useCallback(() => {
    if (!suggestModalPool.length) {
      return;
    }
    Haptics.selectionAsync().catch(() => {});
    setSuggestionIndexMap((prev) => ({
      ...prev,
      [suggestModalDay]: (prev[suggestModalDay] ?? 0) + 1,
    }));
  }, [suggestModalDay, suggestModalPool.length]);

  const handleSuggestModalPinsChange = useCallback(
    (next: DayPinsState) => {
      handleDayPinsChange(suggestModalDay, next);
      setSuggestionIndexMap((prev) => ({
        ...prev,
        [suggestModalDay]: 0,
      }));
    },
    [handleDayPinsChange, suggestModalDay],
  );

  const handleSearchModalPinsChange = useCallback(
    (next: DayPinsState) => {
      handleDayPinsChange(searchModalTitleDay, next);
    },
    [handleDayPinsChange, searchModalTitleDay],
  );

  const handleSelectWizardOption = useCallback(
    (action: DayWizardAction) => {
      if (action === "search") {
        setSearchTargetDay(activeDay);
        setSearchModalVisible(true);
        setPlannedCardPreviewDay(null);
        setActiveWizardAction(null);
        return;
      }
      setActiveWizardAction(action);
      if (action === "suggest" && plannedWeek[activeDay]) {
        setPlannedCardPreviewDay(activeDay);
      } else {
        setPlannedCardPreviewDay(null);
      }
    },
    [activeDay, plannedWeek],
  );

  const handleBackToWizardOptions = useCallback(() => {
    setPlannedCardPreviewDay(null);
    setActiveWizardAction(null);
  }, []);

  const stepSuggestion = useCallback(
    (delta: number) => {
      if (!filteredMeals.length) {
        return;
      }
      setSuggestionIndexMap((prev) => ({
        ...prev,
        [activeDay]: (prev[activeDay] ?? 0) + delta,
      }));
    },
    [activeDay, filteredMeals.length],
  );

  const runSavePlanCelebration = useCallback(async () => {
    if (!sessionDays.length) {
      return;
    }
    setIsCelebratingSave(true);
    setCelebratedDayIndex(null);
    const streak = isRemainingMode
      ? { count: 0, lastCompletedWeekStartIso: null }
      : await updateWeekPlanStreak(planningWeekStart);
    const delay = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));
    for (let i = 0; i < sessionDays.length; i += 1) {
      setCelebratedDayIndex(i);
      await Haptics.selectionAsync().catch(() => {});
      await delay(160);
    }
    const baseMessage = `Plan saved for ${planningWeekLabel}`;
    const streakLine = streak.count > 0 ? `🔥 ${streak.count}-week streak` : "";
    const toastSubtitle = streakLine || undefined;
    await new Promise<void>((resolve) => {
      setSaveToastPayload({
        title: baseMessage,
        subtitle: toastSubtitle,
        onComplete: resolve,
      });
    });
    setCelebratedDayIndex(null);
    setIsCelebratingSave(false);
  }, [isRemainingMode, sessionDays, planningWeekLabel, planningWeekStart]);

  const handleSavePlan = useCallback(async () => {
    if (isSaving || isCelebratingSave) {
      return;
    }
    setIsSaving(true);
    try {
      const completedPlan: CurrentPlannedWeek = {
        ...plannedWeek,
        weekedPlanned: true,
        weekStartISO: planningWeekStartISO,
        plannedScope: isRemainingMode ? "remaining" : "full",
      };
      setPlannedWeek(completedPlan);
      const saveTasks: Promise<unknown>[] = [
        setCurrentWeekPlan(planningWeekStartISO, completedPlan),
        setCurrentWeekSides(planningWeekStartISO, daySidesMap),
      ];
      if (!isRemainingMode) {
        saveTasks.push(addWeekPlanHistory(completedPlan));
      }
      await Promise.all(saveTasks);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      await runSavePlanCelebration();
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [
    isCelebratingSave,
    isSaving,
    plannedWeek,
    router,
    runSavePlanCelebration,
    isRemainingMode,
    planningWeekStartISO,
    daySidesMap,
  ]);

  const handleToastComplete = useCallback(() => {
    if (!toastDay) {
      return;
    }
    setToastSeenDays((prev) => {
      const next = new Set(prev);
      next.add(toastDay);
      return next;
    });
    const currentIndex = sessionDays.indexOf(toastDay);
    if (currentIndex !== -1 && sessionDays.length > 0) {
      const nextIndex = Math.min(
        currentIndex + 1,
        Math.max(sessionDays.length - 1, 0),
      );
      setActiveDayIndex(nextIndex);
    }
    setActiveWizardAction(null);
    setPlannedCardPreviewDay(null);
    setExpandedDrawerDay(null);
    setToastDay(null);
    setPendingPlannedDay(null);
  }, [sessionDays, toastDay]);

  const handleSwapPlannedMeal = useCallback(
    async (day: PlannedWeekDayKey) => {
      const nextPlan: CurrentPlannedWeek = { ...plannedWeek, [day]: null };
      nextPlan.weekStartISO = planningWeekStartISO;
      nextPlan.weekedPlanned = false;
      nextPlan.plannedScope = isRemainingMode ? "remaining" : "full";
      setPlannedWeek(nextPlan);
      setPlannedCardPreviewDay(null);
      setPendingPlannedDay(null);
      setActiveWizardAction(null);
      await Promise.all([
        setCurrentWeekPlan(planningWeekStartISO, nextPlan),
        setCurrentWeekSides(planningWeekStartISO, daySidesMap),
      ]);
    },
    [daySidesMap, plannedWeek, planningWeekStartISO, isRemainingMode],
  );

  const handleViewPlannedMeal = useCallback((meal: Meal) => {
    if (meal.id === EAT_OUT_MEAL_ID) {
      return;
    }
    setViewingMealId(meal.id);
  }, []);

  const handleSwapDrawerDay = useCallback((day: PlannedWeekDayKey) => {
    setSearchTargetDay(day);
    setSearchModalVisible(true);
    setExpandedDrawerDay(null);
  }, []);

  const handleRemoveDrawerDay = useCallback(
    (day: PlannedWeekDayKey) => {
      setExpandedDrawerDay(null);
      handleSwapPlannedMeal(day);
    },
    [handleSwapPlannedMeal],
  );

  const handleUpdateViewedMeal = useCallback(
    (meal: Meal) => {
      updateMeal(meal);
    },
    [updateMeal],
  );

  const handleCreateViewedMeal = useCallback(() => {}, []);

  const handlePlannerSave = useCallback(async () => {
    if (!plannerSelection.meal) {
      return;
    }
    setPlannerSaving(true);
    const targetDay = plannerSelection.day ?? pendingPlannedDay ?? activeDay;
    const nextPlan: CurrentPlannedWeek = {
      ...plannedWeek,
      [targetDay]: plannerSelection.meal.id,
      weekedPlanned: false,
      weekStartISO: planningWeekStartISO,
      plannedScope: isRemainingMode ? "remaining" : "full",
    };
    setPlannedWeek(nextPlan);
    try {
      await Promise.all([
        setCurrentWeekPlan(planningWeekStartISO, nextPlan),
        setCurrentWeekSides(planningWeekStartISO, daySidesMap),
      ]);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
      setSavedIndicatorDay(targetDay);
      setTimeout(() => {
        setSavedIndicatorDay(null);
        handleCloseSummary().then(() => {
          setToastDay(targetDay);
          setPendingPlannedDay(null);
          setActiveWizardAction(null);
          setPlannedCardPreviewDay(null);
        });
      }, 320);
    } finally {
      setPlannerSaving(false);
    }
  }, [
    activeDay,
    handleCloseSummary,
    plannerSelection,
    plannedWeek,
    pendingPlannedDay,
    planningWeekStartISO,
    daySidesMap,
    isRemainingMode,
  ]);

  const summaryPanResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 10 && Math.abs(gesture.dx) < 20,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) {
            summaryTranslateY.setValue(Math.max(0, gesture.dy));
          }
        },
        onPanResponderRelease: async (_, gesture) => {
          const shouldDismiss =
            gesture.dy > SCREEN_HEIGHT * 0.18 || gesture.vy > 1.2;
          if (shouldDismiss) {
            await handleCloseSummary();
          } else {
            animateSummaryTo(
              0,
              theme.motion.duration.normal,
              Easing.bezier(0, 0, 0.2, 1),
            );
          }
        },
        onPanResponderTerminate: () => {
          animateSummaryTo(
            0,
            theme.motion.duration.normal,
            Easing.bezier(0, 0, 0.2, 1),
          );
        },
      }),
    [
      animateSummaryTo,
      handleCloseSummary,
      summaryTranslateY,
      theme.motion.duration.normal,
    ],
  );

  const viewingMeal = useMemo(
    () => meals.find((meal) => meal.id === viewingMealId) ?? null,
    [meals, viewingMealId],
  );

  if (resumePromptVisible) {
    return (
      <SafeAreaView
        style={styles.plannerStepsSafeArea}
        edges={["top", "left", "right", "bottom"]}
      >
        <View style={styles.resumeCard}>
          <Text style={styles.resumeTitle}>Resume planning?</Text>
          <Text style={styles.resumeSubtitle}>
            You already saved some meals for this week. Continue where you left
            off or start over.
          </Text>
          <View style={styles.resumeActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue planning where you left off"
              onPress={handleResumeContinue}
              style={({ pressed }) => [
                styles.resumeButtonPrimary,
                pressed && styles.resumeButtonPrimaryPressed,
              ]}
            >
              <Text style={styles.resumeButtonPrimaryText}>Continue</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Start planning this week over"
              onPress={handleResumeRestart}
              style={({ pressed }) => [
                styles.resumeButtonSecondary,
                pressed && styles.resumeButtonSecondaryPressed,
              ]}
            >
              <Text style={styles.resumeButtonSecondaryText}>Start over</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (toastDay) {
    return (
      <View style={styles.toastScreen}>
        <DayPlannedToast
          dayName={PLANNED_WEEK_DISPLAY_NAMES[toastDay]}
          title={`Added to ${PLANNED_WEEK_DISPLAY_NAMES[toastDay]}`}
          onComplete={handleToastComplete}
        />
      </View>
    );
  }

  if (saveToastPayload) {
    return (
      <View style={styles.toastScreen}>
        <DayPlannedToast
          title={saveToastPayload.title}
          subtitle={saveToastPayload.subtitle}
          onComplete={() => {
            saveToastPayload.onComplete?.();
            setSaveToastPayload(null);
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.swipeContainer}>
      <SafeAreaView
        style={styles.safe}
        edges={["top", "left", "right", "bottom"]}
      >
        <PlanWeekHeader
          isSummaryVisible={isSummaryVisible}
          onClose={
            isDayPlanningStep ? handleBackToWizardOptions : () => router.back()
          }
          onOpenSummary={handleOpenSummary}
          onToggleCalendar={
            !isDayPlanningStep ? handleToggleCalendarContext : undefined
          }
          isCalendarEnabled={isCalendarContextVisible}
          isDayPlanningStep={isDayPlanningStep}
          orderedDays={sessionDays}
          plannedWeek={plannedWeek}
          activeDay={activeDay}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!activeWizardAction ? (
            <View style={styles.weekRowsSection}>
              <View style={styles.compactWeekSelector}>
                <Text style={styles.compactWeekLabel}>{planningWeekLabel}</Text>
              </View>

              {SHOW_MAIN_PIN_BOARD ? (
                <View style={styles.mainPinBoardSection}>
                  <PinBoard
                    value={activeDayPins}
                    onChange={(next) => handleDayPinsChange(activeDay, next)}
                    dayKey={activeDay}
                    onRequestInventory={handleTogglePinInventory}
                    pulseChipTrigger={inventoryPulseTrigger}
                    isInventoryOpen={isPinInventoryVisible}
                  />
                  {isPinInventoryVisible ? (
                    <PinInventory
                      value={activeDayPins}
                      onAdd={handleAddInventoryPin}
                    />
                  ) : null}
                </View>
              ) : null}

              <MealInspirationSection
                pools={mealPools}
                orderedDays={sessionDays}
                selectedMealId={selectedSavedIdeaMealId}
                onSelectMeal={handleSelectMealPoolMeal}
                onSelectDay={handlePlanMealPoolMealForDay}
                onRemoveSuggestedMeal={handleRemoveSavedIdea}
              />

              <View style={styles.weekRowsList}>
                {sessionDays.map((day, index) => {
                  const plannedMeal = getPlannedMealForDay(day);
                  const sides = daySidesMap[day] ?? [];
                  const plannedMealLabel = plannedMeal
                    ? [plannedMeal.title, ...sides].join(" • ")
                    : "Unplanned";
                  const dayEvents = isCalendarContextVisible
                    ? (groupedCalendarEvents[dayDateMap[day]] ?? []).map(
                        (event) => ({
                          id: event.id,
                          title: event.title,
                          timeLabel: formatEventTime(event),
                        }),
                      )
                    : [];
                  const isActive = day === activeDay;
                  const isExpanded = expandedDrawerDay === day;
                  const isCelebrated =
                    celebratedDayIndex !== null && index <= celebratedDayIndex;
                  const rowScale =
                    rowCelebrationScales[index] ?? fallbackRowCelebrationScale;
                  return (
                    <Animated.View
                      key={day}
                      style={[
                        styles.weekDrawer,
                        isExpanded && styles.weekDrawerExpanded,
                        isActive && styles.weekRowActive,
                        isCelebrated && styles.weekDrawerCelebrated,
                        { transform: [{ scale: rowScale }] },
                      ]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${PLANNED_WEEK_DISPLAY_NAMES[day]}`}
                        onPress={() => {
                          LayoutAnimation.configureNext(
                            LayoutAnimation.create(
                              200,
                              LayoutAnimation.Types.easeInEaseOut,
                              LayoutAnimation.Properties.opacity,
                            ),
                          );
                          setActiveDayIndex(index);
                          setExpandedDrawerDay((current) =>
                            current === day ? null : day,
                          );
                        }}
                        style={({ pressed }) => [
                          styles.weekRowPressable,
                          pressed && styles.weekRowPressed,
                        ]}
                      >
                        <View style={styles.weekRow}>
                          <View style={styles.weekRowDaySlot}>
                            {isCelebrated ? (
                              <View style={styles.weekRowDayCheck}>
                                <MaterialCommunityIcons
                                  name="check"
                                  size={16}
                                  color={theme.color.ink}
                                />
                              </View>
                            ) : (
                              <Text style={styles.weekRowDay}>
                                {PLANNED_WEEK_LABELS[day]}
                              </Text>
                            )}
                          </View>
                          <View style={styles.weekRowMeal}>
                            {plannedMeal ? (
                              <Text style={styles.weekRowEmoji}>
                                {plannedMeal.emoji}
                              </Text>
                            ) : null}
                            <Text
                              style={[
                                styles.weekRowTitle,
                                !plannedMeal && styles.weekRowTitleMuted,
                              ]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {plannedMealLabel}
                            </Text>
                          </View>
                          <MaterialCommunityIcons
                            name={isExpanded ? "chevron-up" : "chevron-right"}
                            size={28}
                            color={
                              isExpanded
                                ? theme.color.accent
                                : theme.color.subtleInk
                            }
                          />
                        </View>
                      </Pressable>
                      <CalendarEventLines events={dayEvents} />
                      {isExpanded ? (
                        <Animated.View
                          style={[
                            styles.weekDrawerActions,
                            {
                              opacity: drawerProgress,
                              transform: [
                                {
                                  translateY: drawerProgress.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [-6, 0],
                                  }),
                                },
                              ],
                            },
                          ]}
                        >
                          {plannedMeal ? (
                            <>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`View ${plannedMeal.title}`}
                                disabled={plannedMeal.id === EAT_OUT_MEAL_ID}
                                onPress={() => handleViewPlannedMeal(plannedMeal)}
                                style={({ pressed }) => [
                                  styles.weekDrawerAction,
                                  plannedMeal.id === EAT_OUT_MEAL_ID &&
                                    styles.weekDrawerActionDisabled,
                                  pressed && styles.weekDrawerActionPressed,
                                ]}
                              >
                                <Text style={styles.weekDrawerActionEmoji}>
                                  👁️
                                </Text>
                                <Text style={styles.weekDrawerActionText}>
                                  View
                                </Text>
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Swap meal for ${PLANNED_WEEK_DISPLAY_NAMES[day]}`}
                                onPress={() => handleSwapDrawerDay(day)}
                                style={({ pressed }) => [
                                  styles.weekDrawerAction,
                                  pressed && styles.weekDrawerActionPressed,
                                ]}
                              >
                                <Text style={styles.weekDrawerActionEmoji}>
                                  🔁
                                </Text>
                                <Text style={styles.weekDrawerActionText}>
                                  Swap
                                </Text>
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Remove meal from ${PLANNED_WEEK_DISPLAY_NAMES[day]}`}
                                onPress={() => handleRemoveDrawerDay(day)}
                                style={({ pressed }) => [
                                  styles.weekDrawerAction,
                                  pressed && styles.weekDrawerActionPressed,
                                ]}
                              >
                                <Text style={styles.weekDrawerActionEmoji}>
                                  <Text style={styles.weekDrawerActionAccent}>
                                    ✕
                                  </Text>
                                </Text>
                                <Text style={styles.weekDrawerActionText}>
                                  Remove
                                </Text>
                              </Pressable>
                            </>
                          ) : (
                            <>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Suggest a meal for ${PLANNED_WEEK_DISPLAY_NAMES[day]}`}
                                onPress={() => handleSuggestDrawerDay(day)}
                                style={({ pressed }) => [
                                  styles.weekDrawerAction,
                                  pressed && styles.weekDrawerActionPressed,
                                ]}
                              >
                                <Text style={styles.weekDrawerActionEmoji}>
                                  🔮
                                </Text>
                                <Text style={styles.weekDrawerActionText}>
                                  Suggest
                                </Text>
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Search meals for ${PLANNED_WEEK_DISPLAY_NAMES[day]}`}
                                onPress={() => handleSearchDrawerDay(day)}
                                style={({ pressed }) => [
                                  styles.weekDrawerAction,
                                  pressed && styles.weekDrawerActionPressed,
                                ]}
                              >
                                <Text style={styles.weekDrawerActionEmoji}>
                                  🔍
                                </Text>
                                <Text style={styles.weekDrawerActionText}>
                                  Search
                                </Text>
                              </Pressable>
                              <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={`Plan eat out night for ${PLANNED_WEEK_DISPLAY_NAMES[day]}`}
                                onPress={() => handleEatOutDrawerDay(day)}
                                style={({ pressed }) => [
                                  styles.weekDrawerAction,
                                  pressed && styles.weekDrawerActionPressed,
                                ]}
                              >
                                <Text style={styles.weekDrawerActionEmoji}>
                                  🍽️
                                </Text>
                                <Text style={styles.weekDrawerActionText}>
                                  Eat Out
                                </Text>
                              </Pressable>
                            </>
                          )}
                        </Animated.View>
                      ) : null}
                    </Animated.View>
                  );
                })}
              </View>

              <Pressable
                onPress={handleSavePlan}
                disabled={!isWeekComplete || isSaving || isCelebratingSave}
                accessibilityRole="button"
                accessibilityLabel="Save planned week"
                style={({ pressed }) => [
                  styles.saveButton,
                  styles.inlineSaveButton,
                  !isWeekComplete && styles.saveButtonDisabled,
                  pressed && isWeekComplete && styles.saveButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.saveButtonText,
                    !isWeekComplete && styles.saveButtonTextDisabled,
                  ]}
                >
                  Save Plan
                </Text>
              </Pressable>
            </View>
          ) : null}

          {/*
            CLEANUP: Old first-step planner UI is intentionally disconnected
            while we build the new week-row planner step by step. Delete this
            block once the row-based flow fully replaces it.

            <PlanDayChoiceStep
              dayKey={activeDay}
              orderedDays={sessionDays}
              plannedWeek={plannedWeek}
              weekLabel={planningWeekLabel}
              hasSeenPlannedToast={toastSeenDays.has(activeDay)}
              onSelectOption={handleSelectWizardOption}
              onSelectEatOut={handleSelectEatOut}
              onSelectDay={(day) => {
                const targetIndex = sessionDays.indexOf(day);
                if (targetIndex !== -1) {
                  setActiveDayIndex(targetIndex);
                }
              }}
              onSearchForMeal={() => {
                setSearchTargetDay(activeDay);
                setSearchModalVisible(true);
              }}
              plannedMeal={plannedMealForActiveDay}
              sides={daySidesMap[activeDay] ?? []}
              onSwapPlannedMeal={handleSwapPlannedMeal}
            />
          */}

          {activeWizardAction ? (
            <View style={styles.plannerSection}>
              {isLoading && !initializedRef.current ? (
                <ActivityIndicator color={theme.color.accent} />
              ) : (
                <SuggestionsContainer
                  dayKey={activeDay}
                  meal={activeSuggestion}
                  suggestionContext={activeSuggestionContext}
                  plannedMeal={plannedMealForActiveDay}
                  onAdd={handleAddMeal}
                  onShuffle={() => stepSuggestion(1)}
                  pins={activeDayPins}
                  onPinsChange={(next) => handleDayPinsChange(activeDay, next)}
                  showPinBoard={false}
                  hideContent={
                    isSummaryVisible ||
                    toastDay === activeDay ||
                    pendingPlannedDay === activeDay
                  }
                  sides={activeDaySides}
                  onAddSide={(side) => handleAddSide(activeDay, side)}
                  onRemoveSide={(index) => handleRemoveSide(activeDay, index)}
                />
              )}
            </View>
          ) : null}

        </ScrollView>

        <View style={styles.footer}>
          {isWeekComplete &&
            !isSummaryVisible &&
            activeWizardAction && (
              <Pressable
                onPress={handleSavePlan}
                disabled={isSaving || isCelebratingSave}
                style={({ pressed }) => [
                  styles.saveButton,
                  pressed && styles.saveButtonPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Save planned week"
              >
                {isSaving ? (
                  <ActivityIndicator color={theme.color.ink} />
                ) : (
                  <Text style={styles.saveButtonText}>Save Plan</Text>
                )}
              </Pressable>
            )}
        </View>
      </SafeAreaView>
      {isSummaryVisible && (
        <View style={styles.summaryBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Close planned meals summary"
            onPress={handleCloseSummary}
          />
          <PlannedMealsSheet
            orderedDays={sessionDays}
            plannedWeek={plannedWeek}
            meals={meals}
            daySidesMap={daySidesMap}
            plannerSelection={plannerSelection}
            savedIndicatorDay={savedIndicatorDay}
            summaryTranslateY={summaryTranslateY}
            summaryPanHandlers={summaryPanResponder.panHandlers}
            onSelectPlannerDay={handleSelectPlannerDay}
            onSaveSelection={handlePlannerSave}
            isPlannerSaving={isPlannerSaving}
            registerRowRef={(day, ref) => {
              dayRowRefs.current[day] = ref;
            }}
          />
        </View>
      )}
      <SuggestMealModal
        visible={isSuggestModalVisible}
        dayName={PLANNED_WEEK_DISPLAY_NAMES[suggestModalDay]}
        suggestion={suggestModalEntry}
        canSuggestAnother={suggestModalPool.length > 1}
        onDismiss={handleDismissSuggestModal}
        onAddMeal={handleAddSuggestedMeal}
        onSuggestAnother={handleSuggestAnother}
        sides={daySidesMap[suggestModalDay] ?? []}
        onAddSide={(side) => handleAddSide(suggestModalDay, side)}
        onRemoveSide={(index) => handleRemoveSide(suggestModalDay, index)}
        pins={suggestModalPins}
        onPinsChange={handleSuggestModalPinsChange}
      />
      <MealSearchModal
        visible={isSearchModalVisible}
        meals={meals}
        onDismiss={handleDismissSearchModal}
        onSelectMeal={handleSelectSearchMeal}
        title={`Search meals for ${PLANNED_WEEK_DISPLAY_NAMES[searchModalTitleDay]}`}
        subtitle="Pick a meal to plan for this day."
        sides={daySidesMap[searchModalTitleDay] ?? []}
        onAddSide={(side) => handleAddSide(searchModalTitleDay, side)}
        onRemoveSide={(index) => handleRemoveSide(searchModalTitleDay, index)}
        pins={searchModalPins}
        onPinsChange={handleSearchModalPinsChange}
      />
      <MealModalOverlay
        visible={Boolean(viewingMeal)}
        mode="edit"
        meal={viewingMeal}
        onDismiss={() => setViewingMealId(null)}
        onCreateMeal={handleCreateViewedMeal}
        onUpdateMeal={handleUpdateViewedMeal}
      />
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    plannerStepsSafeArea: {
      flex: 1,
      backgroundColor: theme.color.bg,
    },
    resumeCard: {
      flex: 1,
      justifyContent: "center",
      paddingHorizontal: theme.space.xl,
      paddingVertical: theme.space["2xl"],
      gap: theme.space.lg,
    },
    resumeTitle: {
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
      color: theme.color.ink,
    },
    resumeSubtitle: {
      fontSize: theme.type.size.base,
      color: theme.color.subtleInk,
    },
    resumeActions: {
      flexDirection: "column",
      gap: theme.space.sm,
    },
    resumeButtonPrimary: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.space.md,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.accent,
    },
    resumeButtonPrimaryPressed: {
      opacity: 0.9,
    },
    resumeButtonPrimaryText: {
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
      color: theme.color.ink,
    },
    resumeButtonSecondary: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.space.md,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
    },
    resumeButtonSecondaryPressed: {
      opacity: 0.9,
    },
    resumeButtonSecondaryText: {
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
      color: theme.color.ink,
    },
    swipeContainer: {
      flex: 1,
    },
    safe: {
      flex: 1,
      backgroundColor: theme.color.bg,
    },
    content: {
      paddingHorizontal: theme.space.lg,
      paddingBottom: theme.space["2xl"] * 3,
      gap: theme.space["2xl"],
    },
    plannerSection: {
      gap: theme.space.md,
    },
    weekRowsSection: {
      gap: theme.space.lg,
    },
    compactWeekSelector: {
      alignItems: "center",
      gap: theme.space.md,
    },
    compactWeekLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    compactWeekDays: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.xs,
    },
    compactWeekDayButton: {
      width: 38,
      height: 38,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    compactWeekDayButtonPlanned: {
      borderColor: theme.color.accent,
    },
    compactWeekDayButtonActive: {
      backgroundColor: theme.color.accent,
      borderColor: theme.color.accent,
    },
    compactWeekDayButtonPressed: {
      opacity: 0.85,
    },
    compactWeekDayText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    compactWeekDayTextActive: {
      color: theme.color.ink,
    },
    mainPinBoardSection: {
      gap: theme.space.md,
    },
    planHeroCard: {
      paddingHorizontal: theme.space.xl,
      paddingVertical: theme.space.xl,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      alignItems: "center",
      gap: theme.space.md,
    },
    planHeroSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.medium,
    },
    planHeroDays: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.xs,
      marginTop: theme.space.sm,
    },
    planHeroDayButton: {
      width: 38,
      height: 38,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    planHeroDayButtonPlanned: {
      borderColor: theme.color.accent,
    },
    planHeroDayButtonActive: {
      backgroundColor: theme.color.accent,
      borderColor: theme.color.accent,
    },
    planHeroDayButtonPressed: {
      opacity: 0.85,
    },
    planHeroDayText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    planHeroDayTextActive: {
      color: theme.color.ink,
    },
    weekRowsTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
    },
    weekRowsSubtitle: {
      marginTop: theme.space.xs,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
    },
    weekRowsList: {
      gap: theme.space.xs + 2,
    },
    weekDrawer: {
      minHeight: 54,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      gap: theme.space.sm,
    },
    weekDrawerExpanded: {
      minHeight: 122,
      paddingTop: theme.space.sm,
      paddingBottom: theme.space.md,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255, 75, 145, 0.10)"
          : "rgba(255, 75, 145, 0.06)",
      borderWidth: 1,
      borderColor: theme.color.accent,
      shadowColor: theme.color.accent,
      shadowOpacity: 0.14,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    weekDrawerCelebrated: {
      borderColor: theme.color.accent,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255, 75, 145, 0.08)"
          : "rgba(255, 75, 145, 0.05)",
    },
    weekRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
    },
    weekRowPressable: {
      flex: 1,
    },
    weekRowActive: {
      borderColor: theme.color.cardOutline,
    },
    weekRowPressed: {
      opacity: 0.9,
    },
    weekRowDaySlot: {
      width: 52,
      alignItems: "flex-start",
      justifyContent: "center",
    },
    weekRowDay: {
      color: theme.color.accent,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
      letterSpacing: 0,
    },
    weekRowDayCheck: {
      width: 26,
      height: 26,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.accent,
    },
    weekRowMeal: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    weekRowEmoji: {
      width: 34,
      textAlign: "center",
      fontSize: 24,
    },
    weekRowTitle: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    weekRowTitleMuted: {
      color: theme.color.subtleInk,
      fontWeight: theme.type.weight.medium,
    },
    weekDrawerActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.space.md,
    },
    weekDrawerAction: {
      flex: 1,
      minHeight: 44,
      paddingHorizontal: theme.space.sm,
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.xs,
    },
    weekDrawerActionPressed: {
      opacity: 0.82,
    },
    weekDrawerActionDisabled: {
      opacity: 0.45,
    },
    weekDrawerActionEmoji: {
      fontSize: 18,
    },
    weekDrawerActionAccent: {
      color: theme.color.accent,
    },
    weekDrawerActionText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    saveButtonDisabled: {
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    inlineSaveButton: {
      marginBottom: theme.space.xl,
    },
    saveButtonTextDisabled: {
      color: theme.color.subtleInk,
    },
    outlineSaveButton: {
      minHeight: theme.component.button.height,
      marginTop: theme.space.md,
      paddingHorizontal: theme.space.lg,
      borderRadius: theme.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.accent,
      backgroundColor: theme.color.bg,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.sm,
    },
    outlineSaveButtonDisabled: {
      borderColor: theme.color.border,
      opacity: 0.7,
    },
    outlineSaveButtonPressed: {
      opacity: 0.85,
    },
    outlineSaveButtonText: {
      color: theme.color.accent,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    outlineSaveButtonTextDisabled: {
      color: theme.color.subtleInk,
    },
    summaryBackdrop: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    toastScreen: {
      flex: 1,
      backgroundColor: theme.color.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    footer: {
      paddingHorizontal: theme.space.xl,
      paddingVertical: theme.space.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border,
      backgroundColor: theme.color.bg,
    },
    saveButton: {
      height: theme.component.button.height,
      borderRadius: theme.component.button.radius,
      backgroundColor: theme.color.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    saveButtonPressed: {
      opacity: 0.85,
    },
    saveButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
  });
