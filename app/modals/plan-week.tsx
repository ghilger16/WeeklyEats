import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Keyboard,
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
import { useServedMeals } from "../../hooks/useServedMeals";
import SuggestionsContainer from "../../components/plan-week/suggestions/SuggestionsContainer";
import {
  CurrentPlannedWeek,
  CurrentWeekSides,
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
import {
  EAT_OUT_MEAL,
  EAT_OUT_MEAL_ID,
  FLEX_NIGHT_MEAL,
  getSpecialMealById,
} from "../../types/specialMeals";
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
import PlannedDayEditModal from "../../components/plan-week/PlannedDayEditModal";
import useDayPins from "../../hooks/plan-week/useDayPins";
import usePlanSides from "../../hooks/plan-week/usePlanSides";
import MealSearchModal from "../../components/meals/MealSearchModal";
import MealModalOverlay from "../../components/meals/MealModalOverlay";
import PinBoard from "../../components/plan-week/PinBoard";
import MealInspirationSection, {
  MealPool,
  MealPoolId,
} from "../../components/plan-week/MealInspirationSection";
import { buildAutoPlan } from "../../components/plan-week/autoPlan";
import CarryOverSection from "../../components/plan-week/CarryOverSection";
import {
  getBeenAwhileMeals,
  getFamilyStarMeals,
  getFreezerMeals,
  getRecentlyAddedUnservedMeals,
} from "../../components/plan-week/inspirationSelectors";
import PinInventory, {
  InventoryPinId,
  isInventoryPinActive,
} from "../../components/plan-week/pins/PinInventory";
import CalendarEventLines from "../../components/plan-week/CalendarEventLines";
import InlineDaySearch from "../../components/plan-week/inline/InlineDaySearch";
import InlineSideEditor from "../../components/plan-week/inline/InlineSideEditor";
import CompactSidesSummary from "../../components/plan-week/inline/CompactSidesSummary";
import InlineEatOutEditor from "../../components/plan-week/inline/InlineEatOutEditor";
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

const isPlannedWeekDayKey = (value: unknown): value is PlannedWeekDayKey =>
  typeof value === "string" &&
  PLANNED_WEEK_ORDER.includes(value as PlannedWeekDayKey);

type AutoPlanSession = {
  mode: "fill" | "alternate";
  ownedDays: Partial<
    Record<
      PlannedWeekDayKey,
      { mealId: Meal["id"]; originalSides: string[] }
    >
  >;
  previousGeneratedMealIds: Meal["id"][];
  manualChanges: number;
};

type AlternateWeekSnapshot = {
  plannedWeek: CurrentPlannedWeek;
  sides: CurrentWeekSides;
};

type AutoPlanAnimationPhase =
  | "idle"
  | "thinking"
  | "cascading"
  | "result"
  | "retrying";

export default function PlanWeekModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: string; editDay?: string }>();
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { meals, updateMeal } = useMeals();
  const { orderedDays, startDay } = useWeekStartController();
  const isRemainingMode = params.mode === "remaining";
  const isCurrentWeekMode = params.mode === "current";
  const requestedEditDay = isPlannedWeekDayKey(params.editDay)
    ? params.editDay
    : null;
  const sessionDays = useMemo(() => {
    if (!isRemainingMode) {
      return orderedDays;
    }
    const remainingDays = getRemainingPlanningDays(startDay);
    return remainingDays.length ? remainingDays : orderedDays;
  }, [isRemainingMode, orderedDays, startDay]);
  const planningWeekStart = useMemo(
    () =>
      isRemainingMode || isCurrentWeekMode
        ? getWeekStartForDate(startDay)
        : getNextWeekStartForDate(startDay),
    [isCurrentWeekMode, isRemainingMode, startDay],
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
  const { entries: servedEntries } = useServedMeals();
  const initializedRef = useRef(false);
  const didOpenRequestedEditDayRef = useRef(false);
  const plannerScrollRef = useRef<ScrollView>(null);
  const plannerDayOffsetsRef = useRef<Partial<Record<PlannedWeekDayKey, number>>>(
    {},
  );
  const plannerRowsOffsetRef = useRef(0);

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
  const previousExpandedDrawerDayRef = useRef<PlannedWeekDayKey | null>(null);
  const [pendingInlineMeal, setPendingInlineMeal] = useState<{
    day: PlannedWeekDayKey;
    meal: Meal;
    sides: string[];
  } | null>(null);
  const [pendingEatOutDay, setPendingEatOutDay] =
    useState<PlannedWeekDayKey | null>(null);
  const [inspirationTargetDay, setInspirationTargetDay] =
    useState<PlannedWeekDayKey | null>(null);
  const [plannedEditDay, setPlannedEditDay] =
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
  const [selectedCarryOverMealId, setSelectedCarryOverMealId] = useState<
    Meal["id"] | null
  >(null);
  const [activeInspirationPoolId, setActiveInspirationPoolId] =
    useState<MealPoolId | null>(null);
  const [autoPlanSession, setAutoPlanSession] =
    useState<AutoPlanSession | null>(null);
  const [isCompleteWeekPromptVisible, setCompleteWeekPromptVisible] =
    useState(false);
  const [alternateWeekSnapshot, setAlternateWeekSnapshot] =
    useState<AlternateWeekSnapshot | null>(null);
  const [autoPlanMessage, setAutoPlanMessage] = useState<string | null>(null);
  const [autoPlanAnimationPhase, setAutoPlanAnimationPhase] =
    useState<AutoPlanAnimationPhase>("idle");
  const [autoPlanThinkingIcons, setAutoPlanThinkingIcons] = useState<string[]>(
    [],
  );
  const [isReduceMotionEnabled, setReduceMotionEnabled] = useState(false);
  const autoPlanTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const autoPlanRowAnimationsRef = useRef(
    PLANNED_WEEK_ORDER.reduce<Record<PlannedWeekDayKey, Animated.Value>>(
      (values, day) => {
        values[day] = new Animated.Value(1);
        return values;
      },
      {} as Record<PlannedWeekDayKey, Animated.Value>,
    ),
  );
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

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotionEnabled(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotionEnabled,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(
    () => () => {
      autoPlanTimersRef.current.forEach(clearTimeout);
      autoPlanTimersRef.current = [];
    },
    [],
  );

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
    if (isLoading || requestedEditDay) {
      return;
    }
    if (!initializedRef.current) {
      initializedRef.current = true;
      setPlannedWeek(plan);
    }
  }, [isLoading, plan]);

  useEffect(() => {
    if (
      isLoading ||
      !initializedRef.current ||
      didOpenRequestedEditDayRef.current ||
      !requestedEditDay ||
      typeof plannedWeek[requestedEditDay] !== "string"
    ) {
      return;
    }
    const targetIndex = sessionDays.indexOf(requestedEditDay);
    if (targetIndex !== -1) {
      setActiveDayIndex(targetIndex);
    }
    setPlannedEditDay(requestedEditDay);
    didOpenRequestedEditDayRef.current = true;
  }, [isLoading, plannedWeek, requestedEditDay, sessionDays]);

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
  }, [isLoading, plan, planningWeekStartISO, requestedEditDay]);

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
    if (
      (!isCalendarContextVisible && !pendingEatOutDay) ||
      loadedCalendarWeekKey === calendarWeekKey
    ) {
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
    pendingEatOutDay,
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

  const plannedMealIds = useMemo(
    () =>
      new Set(
        Object.values(plannedWeek).filter(
          (mealId): mealId is Meal["id"] => typeof mealId === "string",
        ),
      ),
    [plannedWeek],
  );

  const hasServedMealData = useMemo(() => {
    const mealIds = new Set(meals.map((meal) => meal.id));
    return servedEntries.some(
      (entry) =>
        entry.outcome === "served" &&
        Boolean(entry.mealId) &&
        mealIds.has(entry.mealId as string) &&
        Number.isFinite(new Date(entry.servedAtISO).getTime()),
    );
  }, [meals, servedEntries]);

  const mealPools = useMemo<MealPool[]>(() => {
    const availableMeals = meals.filter((meal) => !plannedMealIds.has(meal.id));
    const pools: MealPool[] = [
      ...(hasServedMealData
        ? [
            {
              id: "beenAwhile" as const,
              title: "Been Awhile",
              subtitle: "Meals you haven’t served lately.",
              nextIcon: "⭐",
              emptyText: "No meal history yet.",
              meals: getBeenAwhileMeals(availableMeals, servedEntries),
            },
          ]
        : []),
      {
        id: "recentlyAdded",
        title: "Recently Added",
        subtitle: "New meals you haven’t served yet.",
        nextIcon: "⭐",
        emptyText: "No unserved meals added recently.",
        meals: getRecentlyAddedUnservedMeals(
          availableMeals,
          servedEntries,
        ),
      },
      {
        id: "familyStars",
        title: "Family Star",
        subtitle: "Your highest-rated meals.",
        nextIcon: "❄️",
        chipIcon: "⭐",
        emptyText: "Meals loved by everyone will appear here.",
        meals: getFamilyStarMeals(availableMeals, isFamilyStarMeal),
      },
      {
        id: "freezerMeals",
        title: "Freezer",
        subtitle: "Meals ready from your freezer.",
        nextIcon: "⚡",
        chipIcon: "❄️",
        emptyText: "Your freezer is empty.",
        meals: getFreezerMeals(availableMeals, hasFreezerInventory),
      },
      {
        id: "easy",
        title: "Easy",
        subtitle: "Low-effort meals.",
        nextIcon: "💰",
        emptyText: "No easy meals yet.",
        meals: availableMeals.filter(
          (meal) => typeof meal.difficulty === "number",
        ),
        cycle: "difficulty",
      },
      {
        id: "budget",
        title: "Expense",
        subtitle: "Meals grouped by expense.",
        nextIcon: "🕒",
        emptyText: "No budget meals yet.",
        meals: availableMeals,
        cycle: "expense",
      },
    ];
    return pools.filter((pool) => pool.meals.length > 0);
  }, [hasServedMealData, meals, plannedMealIds, servedEntries]);

  const resolvedActiveInspirationPoolId =
    activeInspirationPoolId &&
    mealPools.some((pool) => pool.id === activeInspirationPoolId)
      ? activeInspirationPoolId
      : null;

  useEffect(() => {
    if (resolvedActiveInspirationPoolId !== activeInspirationPoolId) {
      setActiveInspirationPoolId(resolvedActiveInspirationPoolId);
    }
  }, [activeInspirationPoolId, resolvedActiveInspirationPoolId]);

  const runAutoPlanReveal = useCallback(
    (days: PlannedWeekDayKey[], isRetry = false) => {
      autoPlanTimersRef.current.forEach(clearTimeout);
      autoPlanTimersRef.current = [];
      const thinkingDuration = isReduceMotionEnabled ? 120 : 3000;
      const stagger = isReduceMotionEnabled ? 0 : isRetry ? 135 : 360;
      const rowDuration = isReduceMotionEnabled ? 140 : isRetry ? 510 : 600;
      setAutoPlanAnimationPhase(isRetry ? "retrying" : "thinking");

      const revealTimer = setTimeout(() => {
        setAutoPlanAnimationPhase("cascading");
        const animations = days.map((day) =>
          Animated.timing(autoPlanRowAnimationsRef.current[day], {
            toValue: 1,
            duration: rowDuration,
            useNativeDriver: true,
          }),
        );
        if (isReduceMotionEnabled) {
          Animated.parallel(animations).start();
        } else {
          Animated.stagger(stagger, animations).start();
        }
      }, thinkingDuration);

      const finishDelay =
        thinkingDuration + Math.max(0, days.length - 1) * stagger + rowDuration + 30;
      const finishTimer = setTimeout(() => {
        days.forEach((day) =>
          autoPlanRowAnimationsRef.current[day].setValue(1),
        );
        setAutoPlanAnimationPhase("result");
      }, finishDelay);
      const hapticDays = isReduceMotionEnabled ? days.slice(0, 1) : days;
      const hapticTimers = hapticDays.map((_, index) =>
        setTimeout(() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
        }, thinkingDuration + index * stagger),
      );
      autoPlanTimersRef.current = [
        revealTimer,
        finishTimer,
        ...hapticTimers,
      ];
    },
    [isReduceMotionEnabled],
  );

  const handlePlanItForMe = useCallback(() => {
    if (
      autoPlanAnimationPhase === "thinking" ||
      autoPlanAnimationPhase === "cascading" ||
      autoPlanAnimationPhase === "retrying"
    ) {
      return;
    }
    if (isWeekComplete) {
      setCompleteWeekPromptVisible(true);
      setAutoPlanAnimationPhase("result");
      setAutoPlanMessage(null);
      setActiveInspirationPoolId(null);
      Haptics.selectionAsync().catch(() => {});
      return;
    }
    const assignments = buildAutoPlan({
      days: sessionDays,
      meals,
      plannedWeek,
      dayPinsMap,
      servedEntries,
    });
    if (!assignments.length) {
      setAutoPlanMessage(
        sessionDays.every((day) => Boolean(plannedWeek[day]))
          ? "Your week is already planned."
          : "Add a few meals first so we can build your week.",
      );
      return;
    }

    const ownedDays: AutoPlanSession["ownedDays"] = {};
    const nextPlan = { ...plannedWeek };
    assignments.forEach(({ day, meal }) => {
      autoPlanRowAnimationsRef.current[day].setValue(0);
      nextPlan[day] = meal.id;
      ownedDays[day] = {
        mealId: meal.id,
        originalSides: [...(daySidesMap[day] ?? [])],
      };
    });
    nextPlan.weekedPlanned = false;
    setPlannedWeek(nextPlan);
    setAutoPlanSession({
      mode: "fill",
      ownedDays,
      previousGeneratedMealIds: assignments.map(({ meal }) => meal.id),
      manualChanges: 0,
    });
    setAutoPlanMessage(null);
    setAutoPlanThinkingIcons(
      assignments.slice(0, 4).map(({ meal }) => meal.emoji || "🍽️"),
    );
    setActiveInspirationPoolId(null);
    runAutoPlanReveal(
      assignments.map(({ day }) => day),
      false,
    );
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
  }, [autoPlanAnimationPhase, dayPinsMap, daySidesMap, isWeekComplete, meals, plannedWeek, runAutoPlanReveal, servedEntries, sessionDays]);

  const handleTryAnotherAutoPlan = useCallback(() => {
    if (autoPlanAnimationPhase !== "result") return;
    if (isCompleteWeekPromptVisible || autoPlanSession?.mode === "alternate") {
      const snapshot =
        alternateWeekSnapshot ?? {
          plannedWeek: {
            ...plannedWeek,
            specialMealTitles: plannedWeek.specialMealTitles
              ? { ...plannedWeek.specialMealTitles }
              : undefined,
            savedIdeas: [...(plannedWeek.savedIdeas ?? [])],
            carryOverIdeas: [...(plannedWeek.carryOverIdeas ?? [])],
          },
          sides: PLANNED_WEEK_ORDER.reduce<CurrentWeekSides>((copy, day) => {
            copy[day] = [...(daySidesMap[day] ?? [])];
            return copy;
          }, {} as CurrentWeekSides),
        };
      if (!alternateWeekSnapshot) setAlternateWeekSnapshot(snapshot);

      const basePlan: CurrentPlannedWeek = { ...plannedWeek };
      sessionDays.forEach((day) => {
        basePlan[day] = null;
      });
      const previousMealIds = new Set<string>([
        ...sessionDays
          .map((day) => plannedWeek[day])
          .filter((mealId): mealId is string => Boolean(mealId)),
        ...(autoPlanSession?.previousGeneratedMealIds ?? []),
      ]);
      const assignments = buildAutoPlan({
        days: sessionDays,
        meals,
        plannedWeek: basePlan,
        dayPinsMap,
        servedEntries,
        previousGeneratedMealIds: previousMealIds,
      });
      if (!assignments.length) return;

      const nextPlan: CurrentPlannedWeek = {
        ...plannedWeek,
        weekedPlanned: false,
      };
      const nextSpecialMealTitles = { ...(plannedWeek.specialMealTitles ?? {}) };
      const nextSides = PLANNED_WEEK_ORDER.reduce<CurrentWeekSides>(
        (copy, day) => {
          copy[day] = [...(daySidesMap[day] ?? [])];
          return copy;
        },
        {} as CurrentWeekSides,
      );
      const nextOwnedDays: AutoPlanSession["ownedDays"] = {};
      assignments.forEach(({ day, meal }) => {
        autoPlanRowAnimationsRef.current[day].setValue(0);
        nextPlan[day] = meal.id;
        delete nextSpecialMealTitles[day];
        nextSides[day] = [];
        nextOwnedDays[day] = {
          mealId: meal.id,
          originalSides: [...snapshot.sides[day]],
        };
      });
      nextPlan.specialMealTitles = Object.keys(nextSpecialMealTitles).length
        ? nextSpecialMealTitles
        : undefined;
      setPlannedWeek(nextPlan);
      resetSides(nextSides);
      setCompleteWeekPromptVisible(false);
      setAutoPlanSession({
        mode: "alternate",
        ownedDays: nextOwnedDays,
        previousGeneratedMealIds: [...new Set([
          ...(autoPlanSession?.previousGeneratedMealIds ?? []),
          ...assignments.map(({ meal }) => meal.id),
        ])],
        manualChanges: autoPlanSession?.manualChanges ?? 0,
      });
      setAutoPlanThinkingIcons(
        assignments.slice(0, 4).map(({ meal }) => meal.emoji || "🍽️"),
      );
      runAutoPlanReveal(
        assignments.map(({ day }) => day),
        Boolean(autoPlanSession),
      );
      Haptics.selectionAsync().catch(() => {});
      return;
    }
    if (!autoPlanSession) return;
    const ownedEntries = Object.entries(autoPlanSession.ownedDays).filter(
      ([day, ownership]) =>
        ownership &&
        plannedWeek[day as PlannedWeekDayKey] === ownership.mealId,
    ) as [PlannedWeekDayKey, NonNullable<AutoPlanSession["ownedDays"][PlannedWeekDayKey]>][];
    if (!ownedEntries.length) return;

    const basePlan = { ...plannedWeek };
    ownedEntries.forEach(([day]) => {
      basePlan[day] = null;
    });
    const assignments = buildAutoPlan({
      days: ownedEntries.map(([day]) => day),
      meals,
      plannedWeek: basePlan,
      dayPinsMap,
      servedEntries,
      previousGeneratedMealIds: new Set(
        autoPlanSession.previousGeneratedMealIds,
      ),
    });
    if (!assignments.length) return;

    const nextPlan = { ...basePlan, weekedPlanned: false };
    const nextOwnedDays: AutoPlanSession["ownedDays"] = {};
    assignments.forEach(({ day, meal }) => {
      autoPlanRowAnimationsRef.current[day].setValue(0);
      nextPlan[day] = meal.id;
      nextOwnedDays[day] = {
        mealId: meal.id,
        originalSides:
          autoPlanSession.ownedDays[day]?.originalSides ?? [],
      };
    });
    const nextSides = { ...daySidesMap };
    ownedEntries.forEach(([day, ownership]) => {
      nextSides[day] = [...ownership.originalSides];
    });
    setPlannedWeek(nextPlan);
    setAutoPlanThinkingIcons(
      assignments.slice(0, 4).map(({ meal }) => meal.emoji || "🍽️"),
    );
    resetSides(nextSides);
    setAutoPlanSession((current) =>
      current
        ? {
            ...current,
            ownedDays: nextOwnedDays,
            previousGeneratedMealIds: [
              ...new Set([
                ...current.previousGeneratedMealIds,
                ...assignments.map(({ meal }) => meal.id),
              ]),
            ],
          }
        : current,
    );
    runAutoPlanReveal(
      assignments.map(({ day }) => day),
      true,
    );
    Haptics.selectionAsync().catch(() => {});
  }, [alternateWeekSnapshot, autoPlanAnimationPhase, autoPlanSession, dayPinsMap, daySidesMap, isCompleteWeekPromptVisible, meals, plannedWeek, resetSides, runAutoPlanReveal, servedEntries, sessionDays]);

  const handleClearAutoPlan = useCallback(() => {
    if (!autoPlanSession) return;
    const nextPlan = { ...plannedWeek };
    const nextSides = { ...daySidesMap };
    const nextSpecialMealTitles = { ...(plannedWeek.specialMealTitles ?? {}) };
    if (autoPlanSession.mode === "alternate") {
      sessionDays.forEach((day) => {
        nextPlan[day] = null;
        nextSides[day] = [];
        delete nextSpecialMealTitles[day];
      });
    } else {
      Object.entries(autoPlanSession.ownedDays).forEach(([dayKey, ownership]) => {
        if (!ownership) return;
        const day = dayKey as PlannedWeekDayKey;
        if (nextPlan[day] !== ownership.mealId) return;
        nextPlan[day] = null;
        nextSides[day] = [...ownership.originalSides];
        delete nextSpecialMealTitles[day];
      });
    }
    nextPlan.specialMealTitles = Object.keys(nextSpecialMealTitles).length
      ? nextSpecialMealTitles
      : undefined;
    nextPlan.weekedPlanned = false;
    setPlannedWeek(nextPlan);
    resetSides(nextSides);
    autoPlanTimersRef.current.forEach(clearTimeout);
    autoPlanTimersRef.current = [];
    Object.keys(autoPlanSession.ownedDays).forEach((day) =>
      autoPlanRowAnimationsRef.current[day as PlannedWeekDayKey].setValue(1),
    );
    setAutoPlanSession(null);
    setAlternateWeekSnapshot(null);
    setCompleteWeekPromptVisible(false);
    setAutoPlanAnimationPhase("idle");
    setAutoPlanMessage(null);
    setActiveInspirationPoolId(null);
    Haptics.selectionAsync().catch(() => {});
  }, [autoPlanSession, daySidesMap, plannedWeek, resetSides, sessionDays]);

  const handleAcceptAutoPlan = useCallback(() => {
    if (!autoPlanSession) return;
    autoPlanTimersRef.current.forEach(clearTimeout);
    autoPlanTimersRef.current = [];
    Object.keys(autoPlanSession.ownedDays).forEach((day) =>
      autoPlanRowAnimationsRef.current[day as PlannedWeekDayKey].setValue(1),
    );
    setAutoPlanSession(null);
    setAlternateWeekSnapshot(null);
    setCompleteWeekPromptVisible(false);
    setAutoPlanAnimationPhase("idle");
    setAutoPlanMessage(null);
    setActiveInspirationPoolId(null);
    Haptics.selectionAsync().catch(() => {});
  }, [autoPlanSession]);

  const handleKeepCurrentWeek = useCallback(() => {
    setCompleteWeekPromptVisible(false);
    setAutoPlanAnimationPhase("idle");
    setAutoPlanMessage(null);
    setActiveInspirationPoolId(null);
    Haptics.selectionAsync().catch(() => {});
  }, []);

  const handleRestorePreviousWeek = useCallback(() => {
    if (!alternateWeekSnapshot) return;
    autoPlanTimersRef.current.forEach(clearTimeout);
    autoPlanTimersRef.current = [];
    setPlannedWeek({
      ...alternateWeekSnapshot.plannedWeek,
      specialMealTitles: alternateWeekSnapshot.plannedWeek.specialMealTitles
        ? { ...alternateWeekSnapshot.plannedWeek.specialMealTitles }
        : undefined,
      savedIdeas: [...(alternateWeekSnapshot.plannedWeek.savedIdeas ?? [])],
      carryOverIdeas: [
        ...(alternateWeekSnapshot.plannedWeek.carryOverIdeas ?? []),
      ],
    });
    resetSides(
      PLANNED_WEEK_ORDER.reduce<CurrentWeekSides>((copy, day) => {
        copy[day] = [...(alternateWeekSnapshot.sides[day] ?? [])];
        return copy;
      }, {} as CurrentWeekSides),
    );
    PLANNED_WEEK_ORDER.forEach((day) =>
      autoPlanRowAnimationsRef.current[day].setValue(1),
    );
    setAlternateWeekSnapshot(null);
    setAutoPlanSession(null);
    setCompleteWeekPromptVisible(false);
    setAutoPlanAnimationPhase("idle");
    setAutoPlanMessage(null);
    setActiveInspirationPoolId(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
  }, [alternateWeekSnapshot, resetSides]);

  useEffect(() => {
    if (!autoPlanSession) return;
    if (autoPlanSession.mode === "alternate") return;
    const nextOwnedDays = { ...autoPlanSession.ownedDays };
    let releasedCount = 0;
    Object.entries(autoPlanSession.ownedDays).forEach(([dayKey, ownership]) => {
      if (!ownership) return;
      const day = dayKey as PlannedWeekDayKey;
      if (plannedWeek[day] === ownership.mealId) return;
      delete nextOwnedDays[day];
      releasedCount += 1;
    });
    if (!releasedCount) return;
    if (!Object.keys(nextOwnedDays).length) {
      setAutoPlanSession(null);
      setAutoPlanAnimationPhase("idle");
      return;
    }
    setAutoPlanSession({
      ...autoPlanSession,
      ownedDays: nextOwnedDays,
      manualChanges: autoPlanSession.manualChanges + releasedCount,
    });
  }, [autoPlanSession, plannedWeek]);

  const carryOverMeals = useMemo(
    () =>
      (plannedWeek.carryOverIdeas ?? [])
        .map(
          (idea) =>
            meals.find((meal) => meal.id === idea.mealId) ??
            getSpecialMealById(idea.mealId, idea.title),
        )
        .filter((meal): meal is Meal => Boolean(meal))
        .filter((meal) => !plannedMealIds.has(meal.id)),
    [meals, plannedMealIds, plannedWeek.carryOverIdeas],
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
    return (
      getSpecialMealById(mealId, plannedWeek.specialMealTitles?.[activeDay]) ??
      meals.find((candidate) => candidate.id === mealId)
    );
  }, [activeDay, meals, plannedWeek]);
  const selectedInspirationMeal = useMemo(
    () =>
      selectedSavedIdeaMealId
        ? meals.find((meal) => meal.id === selectedSavedIdeaMealId) ?? null
        : null,
    [meals, selectedSavedIdeaMealId],
  );

  const getPlannedMealForDay = useCallback(
    (day: PlannedWeekDayKey): Meal | undefined => {
      const mealId = plannedWeek[day];
      if (!mealId) {
        return undefined;
      }
      return (
        getSpecialMealById(mealId, plannedWeek.specialMealTitles?.[day]) ??
        meals.find((candidate) => candidate.id === mealId)
      );
    },
    [meals, plannedWeek],
  );
  const plannedEditMeal = plannedEditDay
    ? getPlannedMealForDay(plannedEditDay)
    : undefined;
  const plannedEditLastServedISO = useMemo(() => {
    if (!plannedEditMeal) {
      return null;
    }
    return (
      servedEntries.find(
        (entry) =>
          entry.mealId === plannedEditMeal.id && entry.outcome === "served",
      )?.servedAtISO ?? null
    );
  }, [plannedEditMeal, servedEntries]);
  const getMealLastServedISO = useCallback(
    (mealId: Meal["id"]) =>
      servedEntries.find(
        (entry) => entry.mealId === mealId && entry.outcome === "served",
      )?.servedAtISO ?? null,
    [servedEntries],
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
      options: {
        removeSavedIdea?: boolean;
        removeCarryOverIdea?: boolean;
        sideToAdd?: string;
        specialMealTitle?: string;
      } = {},
    ) => {
      if (isPlannerSaving) {
        return;
      }
      setPlannerSaving(true);
      savedIndicatorDay && setSavedIndicatorDay(null);
      const nextSpecialMealTitles = {
        ...(plannedWeek.specialMealTitles ?? {}),
      };
      if (meal.id === EAT_OUT_MEAL_ID && options.specialMealTitle?.trim()) {
        nextSpecialMealTitles[day] = options.specialMealTitle.trim();
      } else {
        delete nextSpecialMealTitles[day];
      }
      const nextPlan: CurrentPlannedWeek = {
        ...plannedWeek,
        [day]: meal.id,
        weekedPlanned: false,
        weekStartISO: planningWeekStartISO,
        plannedScope: isRemainingMode ? "remaining" : "full",
        specialMealTitles: Object.keys(nextSpecialMealTitles).length
          ? nextSpecialMealTitles
          : undefined,
        savedIdeas: options.removeSavedIdea
          ? (plannedWeek.savedIdeas ?? []).filter(
              (idea) => idea.mealId !== meal.id,
            )
          : plannedWeek.savedIdeas ?? [],
        carryOverIdeas: options.removeCarryOverIdea
          ? (plannedWeek.carryOverIdeas ?? []).filter(
              (idea) => idea.mealId !== meal.id,
            )
          : plannedWeek.carryOverIdeas ?? [],
      };
      const sideToAdd = options.sideToAdd?.trim();
      const nextSidesMap = sideToAdd
        ? {
            ...daySidesMap,
            [day]: [...(daySidesMap[day] ?? []), sideToAdd],
          }
        : daySidesMap;
      setPlannedWeek(nextPlan);
      if (nextSidesMap !== daySidesMap) {
        resetSides(nextSidesMap);
      }
      setSelectedSavedIdeaMealId(null);
      setSelectedMealPoolId(null);
      setPendingPlannedDay(day);
      try {
        await Promise.all([
          setCurrentWeekPlan(planningWeekStartISO, nextPlan),
          setCurrentWeekSides(planningWeekStartISO, nextSidesMap),
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
      resetSides,
      savedIndicatorDay,
      isRemainingMode,
    ],
  );

  const assignInlineMeal = useCallback(
    (day: PlannedWeekDayKey, meal: Meal) => {
      setPlannedWeek((current) => {
        const nextSpecialMealTitles = { ...(current.specialMealTitles ?? {}) };
        delete nextSpecialMealTitles[day];
        return {
          ...current,
          [day]: meal.id,
          weekedPlanned: false,
          weekStartISO: planningWeekStartISO,
          plannedScope: isRemainingMode ? "remaining" : "full",
          specialMealTitles: Object.keys(nextSpecialMealTitles).length
            ? nextSpecialMealTitles
            : undefined,
        };
      });
      resetSides({ ...daySidesMap, [day]: [] });
      setExpandedDrawerDay(null);
      setPendingInlineMeal(null);
      setPendingEatOutDay(null);
      Haptics.selectionAsync().catch(() => {});
    },
    [daySidesMap, isRemainingMode, planningWeekStartISO, resetSides],
  );

  const beginInlineMealEditing = useCallback(
    (day: PlannedWeekDayKey, meal: Meal, currentMeal: Meal | null) => {
      const initialSides =
        currentMeal?.id === meal.id ? daySidesMap[day] ?? [] : [];
      setPlannedWeek((current) => {
        const nextSpecialMealTitles = { ...(current.specialMealTitles ?? {}) };
        delete nextSpecialMealTitles[day];
        return {
          ...current,
          [day]: meal.id,
          weekedPlanned: false,
          weekStartISO: planningWeekStartISO,
          plannedScope: isRemainingMode ? "remaining" : "full",
          specialMealTitles: Object.keys(nextSpecialMealTitles).length
            ? nextSpecialMealTitles
            : undefined,
        };
      });
      if (currentMeal?.id !== meal.id) {
        resetSides({ ...daySidesMap, [day]: [] });
      }
      setPendingEatOutDay(null);
      setPendingInlineMeal({ day, meal, sides: initialSides });
      Haptics.selectionAsync().catch(() => {});
    },
    [daySidesMap, isRemainingMode, planningWeekStartISO, resetSides],
  );

  const commitInlineEatOut = useCallback(
    (day: PlannedWeekDayKey, note: string) => {
      setPlannedWeek((current) => {
        const nextSpecialMealTitles = { ...(current.specialMealTitles ?? {}) };
        if (note) nextSpecialMealTitles[day] = note;
        else delete nextSpecialMealTitles[day];
        return {
          ...current,
          [day]: EAT_OUT_MEAL_ID,
          weekedPlanned: false,
          weekStartISO: planningWeekStartISO,
          plannedScope: isRemainingMode ? "remaining" : "full",
          specialMealTitles: Object.keys(nextSpecialMealTitles).length
            ? nextSpecialMealTitles
            : undefined,
        };
      });
      resetSides({ ...daySidesMap, [day]: [] });
      setPendingEatOutDay(null);
      setExpandedDrawerDay(null);
      Haptics.selectionAsync().catch(() => {});
    },
    [daySidesMap, isRemainingMode, planningWeekStartISO, resetSides],
  );

  const removeInlineAssignment = useCallback((day: PlannedWeekDayKey) => {
    setPlannedWeek((current) => {
      const nextSpecialMealTitles = { ...(current.specialMealTitles ?? {}) };
      delete nextSpecialMealTitles[day];
      return {
        ...current,
        [day]: null,
        weekedPlanned: false,
        specialMealTitles: Object.keys(nextSpecialMealTitles).length
          ? nextSpecialMealTitles
          : undefined,
      };
    });
    resetSides({ ...daySidesMap, [day]: [] });
    setPendingInlineMeal(null);
    setPendingEatOutDay(null);
    Haptics.selectionAsync().catch(() => {});
  }, [daySidesMap, resetSides]);

  const focusExpandedDay = useCallback(
    (day: PlannedWeekDayKey) => {
      const rowOffset = plannerDayOffsetsRef.current[day];
      if (rowOffset === undefined) return;
      requestAnimationFrame(() => {
        plannerScrollRef.current?.scrollTo({
          y: Math.max(
            0,
            plannerRowsOffsetRef.current + rowOffset - theme.space.sm,
          ),
          animated: true,
        });
      });
    },
    [theme.space.sm],
  );

  useEffect(() => {
    const previousDay = previousExpandedDrawerDayRef.current;
    previousExpandedDrawerDayRef.current = expandedDrawerDay;
    if (!previousDay || expandedDrawerDay !== null) return;

    requestAnimationFrame(() => {
      plannerScrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, [expandedDrawerDay]);

  const beginInspirationDayEditor = useCallback(
    (day: PlannedWeekDayKey, meal: Meal) => {
      const targetIndex = sessionDays.indexOf(day);
      if (targetIndex !== -1) setActiveDayIndex(targetIndex);
      setInspirationTargetDay(day);
      setPendingInlineMeal({ day, meal, sides: [] });
      setPendingEatOutDay(null);
      setExpandedDrawerDay(day);
    },
    [sessionDays],
  );

  const handleChooseInspirationDay = useCallback(
    (day: PlannedWeekDayKey, plannedMeal: Meal | undefined) => {
      if (!selectedInspirationMeal) return;
      const nextTitle =
        (selectedInspirationMeal as Meal & { displayTitle?: string })
          .displayTitle?.trim() || selectedInspirationMeal.title;
      const begin = () =>
        beginInspirationDayEditor(day, selectedInspirationMeal);
      if (!plannedMeal) {
        begin();
        return;
      }
      Alert.alert(
        "Replace planned meal?",
        `Replace ${plannedMeal.title} with ${nextTitle}?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Replace", onPress: begin },
        ],
      );
    },
    [beginInspirationDayEditor, selectedInspirationMeal],
  );

  const commitInspirationAssignment = useCallback(
    (day: PlannedWeekDayKey, meal: Meal, sides: string[]) => {
      setPlannedWeek((current) => {
        const nextSpecialMealTitles = { ...(current.specialMealTitles ?? {}) };
        delete nextSpecialMealTitles[day];
        return {
          ...current,
          [day]: meal.id,
          weekedPlanned: false,
          weekStartISO: planningWeekStartISO,
          plannedScope: isRemainingMode ? "remaining" : "full",
          specialMealTitles: Object.keys(nextSpecialMealTitles).length
            ? nextSpecialMealTitles
            : undefined,
        };
      });
      resetSides({ ...daySidesMap, [day]: sides });
      setPendingInlineMeal(null);
      setInspirationTargetDay(null);
      setSelectedSavedIdeaMealId(null);
      setSelectedMealPoolId(null);
      setExpandedDrawerDay(null);
      Haptics.selectionAsync().catch(() => {});
    },
    [daySidesMap, isRemainingMode, planningWeekStartISO, resetSides],
  );

  const cancelInspirationSelection = useCallback(() => {
    setSelectedSavedIdeaMealId(null);
    setSelectedMealPoolId(null);
    setInspirationTargetDay(null);
    setPendingInlineMeal(null);
    requestAnimationFrame(() => {
      plannerScrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, []);

  const handleSelectMealPoolMeal = useCallback(
    (meal: Meal, poolId: MealPoolId) => {
      Haptics.selectionAsync().catch(() => {});
      setSelectedSavedIdeaMealId(meal.id);
      setSelectedMealPoolId(poolId);
      setInspirationTargetDay(null);
      setPendingInlineMeal(null);
      setExpandedDrawerDay(null);
      requestAnimationFrame(() => {
        plannerScrollRef.current?.scrollTo({
          y: Math.max(0, plannerRowsOffsetRef.current - 140),
          animated: true,
        });
      });
    },
    [],
  );

  const handleInspirationPoolChange = useCallback((poolId: MealPoolId | null) => {
    setActiveInspirationPoolId(poolId);
    setSelectedSavedIdeaMealId(null);
    setSelectedMealPoolId(null);
    setInspirationTargetDay(null);
    setPendingInlineMeal(null);
    if (inspirationTargetDay) setExpandedDrawerDay(null);
  }, [inspirationTargetDay]);

  const handlePlanMealPoolMealForDay = useCallback(
    (day: PlannedWeekDayKey) => {
      const meal = meals.find(
        (candidate) => candidate.id === selectedSavedIdeaMealId,
      );
      if (!meal) {
        return;
      }
      saveMealToDay(day, meal);
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

  const handleSelectCarryOverMeal = useCallback(
    (meal: Meal) => {
      if (expandedDrawerDay) {
        saveMealToDay(expandedDrawerDay, meal, {
          removeCarryOverIdea: true,
        });
        return;
      }
      Haptics.selectionAsync().catch(() => {});
      setSelectedCarryOverMealId((current) =>
        current === meal.id ? null : meal.id,
      );
      setSelectedSavedIdeaMealId(null);
      setSelectedMealPoolId(null);
    },
    [expandedDrawerDay, saveMealToDay],
  );

  const handlePlanCarryOverMealForDay = useCallback(
    (day: PlannedWeekDayKey) => {
      const meal = carryOverMeals.find(
        (candidate) => candidate.id === selectedCarryOverMealId,
      );
      if (!meal) {
        return;
      }
      saveMealToDay(day, meal, { removeCarryOverIdea: true });
      setSelectedCarryOverMealId(null);
    }, [carryOverMeals, saveMealToDay, selectedCarryOverMealId],
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

  const handleChangePlannedDay = useCallback(
    (day: PlannedWeekDayKey) => {
      setPlannedEditDay(null);
      handleSuggestDrawerDay(day);
    },
    [handleSuggestDrawerDay],
  );

  const handleDismissSuggestModal = useCallback(() => {
    setSuggestModalVisible(false);
    setSuggestTargetDay(null);
  }, []);

  const handleEatOutFromSuggestModal = useCallback((title?: string) => {
    const targetDay = suggestTargetDay ?? activeDay;
    setSuggestModalVisible(false);
    setSuggestTargetDay(null);
    saveMealToDay(targetDay, EAT_OUT_MEAL, { specialMealTitle: title });
  }, [activeDay, saveMealToDay, suggestTargetDay]);

  const handleFlexNightFromSuggestModal = useCallback(() => {
    const targetDay = suggestTargetDay ?? activeDay;
    setSuggestModalVisible(false);
    setSuggestTargetDay(null);
    saveMealToDay(targetDay, FLEX_NIGHT_MEAL);
  }, [activeDay, saveMealToDay, suggestTargetDay]);

  const handleSelectSuggestSearchMeal = useCallback(
    (meal: Meal, side?: string) => {
      const targetDay = suggestTargetDay ?? activeDay;
      setSuggestModalVisible(false);
      setSuggestTargetDay(null);
      saveMealToDay(targetDay, meal, { sideToAdd: side });
    },
    [activeDay, saveMealToDay, suggestTargetDay],
  );

  const handleAddSuggestedMeal = useCallback(
    (meal: Meal, side?: string) => {
      const targetDay = suggestTargetDay ?? activeDay;
      setSuggestModalVisible(false);
      setSuggestTargetDay(null);
      saveMealToDay(targetDay, meal, { sideToAdd: side });
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
      setAutoPlanSession(null);
      setAlternateWeekSnapshot(null);
      setCompleteWeekPromptVisible(false);
      setAutoPlanAnimationPhase("idle");
      setAutoPlanMessage(null);
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
      const nextSpecialMealTitles = {
        ...(plannedWeek.specialMealTitles ?? {}),
      };
      delete nextSpecialMealTitles[day];
      const nextPlan: CurrentPlannedWeek = {
        ...plannedWeek,
        [day]: null,
        specialMealTitles: Object.keys(nextSpecialMealTitles).length
          ? nextSpecialMealTitles
          : undefined,
      };
      const nextSides = { ...daySidesMap, [day]: [] };
      nextPlan.weekStartISO = planningWeekStartISO;
      nextPlan.weekedPlanned = false;
      nextPlan.plannedScope = isRemainingMode ? "remaining" : "full";
      setPlannedWeek(nextPlan);
      resetSides(nextSides);
      setPlannedCardPreviewDay(null);
      setPendingPlannedDay(null);
      setActiveWizardAction(null);
      await Promise.all([
        setCurrentWeekPlan(planningWeekStartISO, nextPlan),
        setCurrentWeekSides(planningWeekStartISO, nextSides),
      ]);
    },
    [
      daySidesMap,
      plannedWeek,
      planningWeekStartISO,
      isRemainingMode,
      resetSides,
    ],
  );

  const handleRemoveDrawerDay = useCallback(
    (day: PlannedWeekDayKey) => {
      setExpandedDrawerDay(null);
      setPlannedEditDay(null);
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
    const nextSpecialMealTitles = {
      ...(plannedWeek.specialMealTitles ?? {}),
    };
    delete nextSpecialMealTitles[targetDay];
    const nextPlan: CurrentPlannedWeek = {
      ...plannedWeek,
      [targetDay]: plannerSelection.meal.id,
      weekedPlanned: false,
      weekStartISO: planningWeekStartISO,
      plannedScope: isRemainingMode ? "remaining" : "full",
      specialMealTitles: Object.keys(nextSpecialMealTitles).length
        ? nextSpecialMealTitles
        : undefined,
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
          ref={plannerScrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
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
                plannedWeek={plannedWeek}
                selectedMealId={selectedSavedIdeaMealId}
                activePoolId={resolvedActiveInspirationPoolId}
                onActivePoolChange={handleInspirationPoolChange}
                onSelectMeal={handleSelectMealPoolMeal}
                onRemoveSuggestedMeal={handleRemoveSavedIdea}
                getLastServedISO={getMealLastServedISO}
                isAutoPlanActive={
                  Boolean(autoPlanSession) || isCompleteWeekPromptVisible
                }
                autoPlanCardState={
                  isCompleteWeekPromptVisible
                    ? "complete"
                    : autoPlanSession
                      ? "fill"
                      : null
                }
                autoPlanAnimationPhase={autoPlanAnimationPhase}
                autoPlanThinkingIcons={autoPlanThinkingIcons}
                isReduceMotionEnabled={isReduceMotionEnabled}
                autoPlanMessage={autoPlanMessage}
                onPlanItForMe={handlePlanItForMe}
                onAcceptAutoPlan={handleAcceptAutoPlan}
                onTryAnotherAutoPlan={handleTryAnotherAutoPlan}
                onClearAutoPlan={handleClearAutoPlan}
                onKeepCurrentWeek={handleKeepCurrentWeek}
                onRestorePreviousWeek={handleRestorePreviousWeek}
                beforeActivePoolContent={
                  resolvedActiveInspirationPoolId === "beenAwhile" ? (
                    <CarryOverSection
                      meals={carryOverMeals}
                      orderedDays={sessionDays}
                      plannedWeek={plannedWeek}
                      selectedMealId={selectedCarryOverMealId}
                      onSelectMeal={handleSelectCarryOverMeal}
                      onSelectDay={handlePlanCarryOverMealForDay}
                    />
                  ) : null
                }
              />

              {selectedInspirationMeal && !inspirationTargetDay ? (
                <View style={styles.chooseDayPrompt}>
                  <Text style={styles.chooseDayText} numberOfLines={2}>
                    Choose a day for{" "}
                    <Text style={styles.chooseDayMealName}>
                      {(selectedInspirationMeal as Meal & {
                        displayTitle?: string;
                      }).displayTitle?.trim() || selectedInspirationMeal.title}
                    </Text>
                  </Text>
                  <Pressable
                    onPress={cancelInspirationSelection}
                    accessibilityRole="button"
                    accessibilityLabel={`Cancel assigning ${selectedInspirationMeal.title}`}
                    hitSlop={8}
                  >
                    <Text style={styles.chooseDayCancel}>Cancel</Text>
                  </Pressable>
                </View>
              ) : null}

              <View
                style={styles.weekRowsList}
                onLayout={(event) => {
                  plannerRowsOffsetRef.current = event.nativeEvent.layout.y;
                }}
              >
                {sessionDays.map((day, index) => {
                  const plannedMeal = getPlannedMealForDay(day);
                  const temporaryMeal =
                    pendingInlineMeal?.day === day
                      ? pendingInlineMeal.meal
                      : null;
                  const isEditingEatOut = pendingEatOutDay === day;
                  const displayedMeal = isEditingEatOut
                    ? EAT_OUT_MEAL
                    : temporaryMeal ?? plannedMeal;
                  const sides = temporaryMeal
                    ? pendingInlineMeal?.sides ?? []
                    : daySidesMap[day] ?? [];
                  const isEatOutPlan = displayedMeal?.id === EAT_OUT_MEAL_ID;
                  const eatOutSubtitle =
                    isEatOutPlan && displayedMeal?.title !== EAT_OUT_MEAL.title
                      ? displayedMeal?.title
                      : null;
                  const plannedMealLabel = displayedMeal
                    ? displayedMeal.title
                    : "Unplanned";
                  const sidesLabel = sides.join(" • ");
                  const accessibleSides = sides.length
                    ? `, with ${sides
                        .map((side, sideIndex) =>
                          sideIndex === sides.length - 1 && sides.length > 1
                            ? `and ${side}`
                            : side,
                        )
                        .join(sides.length > 2 ? ", " : " ")}`
                    : "";
                  const accessiblePlanLabel = isEatOutPlan
                    ? `Eat Out${eatOutSubtitle ? `, ${eatOutSubtitle}` : ""}`
                    : plannedMealLabel;
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
                  const isAutoSuggested = Boolean(
                    displayedMeal &&
                      autoPlanSession?.ownedDays[day]?.mealId ===
                        displayedMeal.id,
                  );
                  const autoPlanRowAnimation =
                    autoPlanRowAnimationsRef.current[day];
                  const isCelebrated =
                    celebratedDayIndex !== null && index <= celebratedDayIndex;
                  const rowScale =
                    rowCelebrationScales[index] ?? fallbackRowCelebrationScale;
                  const isChoosingInspirationDay = Boolean(
                    selectedInspirationMeal && !inspirationTargetDay,
                  );
                  return (
                    <Animated.View
                      key={day}
                      onLayout={(event) => {
                        plannerDayOffsetsRef.current[day] =
                          event.nativeEvent.layout.y;
                      }}
                      style={[
                        styles.weekDrawer,
                        isActive && styles.weekRowActive,
                        isCelebrated && styles.weekDrawerCelebrated,
                        isChoosingInspirationDay &&
                          styles.weekDrawerChooseTarget,
                        isExpanded && styles.weekDrawerExpanded,
                        { transform: [{ scale: rowScale }] },
                      ]}
                    >
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          isChoosingInspirationDay && selectedInspirationMeal
                            ? `${PLANNED_WEEK_DISPLAY_NAMES[day]}, ${plannedMeal ? `${plannedMeal.title} planned, replace` : "unplanned, assign"} ${selectedInspirationMeal.title}`
                            : `${PLANNED_WEEK_DISPLAY_NAMES[day]}, ${accessiblePlanLabel}${accessibleSides}`
                        }
                        accessibilityState={{ expanded: isExpanded }}
                        onPress={() => {
                          setActiveDayIndex(index);
                          if (isChoosingInspirationDay) {
                            handleChooseInspirationDay(day, plannedMeal);
                            return;
                          }
                          if (temporaryMeal) {
                            setPendingInlineMeal(null);
                            if (inspirationTargetDay === day) {
                              setInspirationTargetDay(null);
                              setSelectedSavedIdeaMealId(null);
                              setSelectedMealPoolId(null);
                              setExpandedDrawerDay(null);
                            }
                            return;
                          }
                          if (isEditingEatOut) {
                            setPendingEatOutDay(null);
                            setExpandedDrawerDay(null);
                            return;
                          }
                          setPendingInlineMeal(null);
                          setPendingEatOutDay(null);
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
                          <Animated.View
                            style={[
                              styles.weekRowMeal,
                              {
                                opacity: autoPlanRowAnimation,
                                transform: isReduceMotionEnabled
                                  ? []
                                  : [
                                      {
                                        translateY: autoPlanRowAnimation.interpolate({
                                          inputRange: [0, 1],
                                          outputRange: [6, 0],
                                        }),
                                      },
                                      {
                                        scale: autoPlanRowAnimation.interpolate({
                                          inputRange: [0, 1],
                                          outputRange: [0.98, 1],
                                        }),
                                      },
                                    ],
                              },
                            ]}
                          >
                            {isEatOutPlan ? (
                              <View style={styles.weekRowSpecialIcon}>
                                <MaterialCommunityIcons
                                  name="silverware-fork-knife"
                                  size={24}
                                  color={theme.color.accent}
                                />
                              </View>
                            ) : displayedMeal ? (
                              <Text style={styles.weekRowEmoji}>
                                {displayedMeal.emoji}
                              </Text>
                            ) : null}
                            <View style={styles.weekRowMealTextStack}>
                              <View style={styles.weekRowTitleLine}>
                                <Text
                                  style={[
                                    styles.weekRowTitle,
                                    !displayedMeal && styles.weekRowTitleMuted,
                                  ]}
                                  numberOfLines={1}
                                  ellipsizeMode="tail"
                                >
                                  {isEatOutPlan ? "Eat Out" : plannedMealLabel}
                                </Text>
                                {isAutoSuggested ? (
                                  <Text
                                    style={styles.weekRowSuggested}
                                    accessibilityLabel="Suggested by Plan It For Me"
                                  >
                                    ✨
                                  </Text>
                                ) : null}
                              </View>
                              {isEatOutPlan && eatOutSubtitle ? (
                                <Text style={styles.weekRowSubtitle} numberOfLines={1}>
                                  {eatOutSubtitle}
                                </Text>
                              ) : !isEatOutPlan && sidesLabel ? (
                                <CompactSidesSummary sides={sides} />
                              ) : null}
                            </View>
                          </Animated.View>
                          {isChoosingInspirationDay ? (
                            plannedMeal ? (
                              <Text style={styles.weekRowReplace}>Replace</Text>
                            ) : (
                              <MaterialCommunityIcons
                                name="plus"
                                size={26}
                                color={theme.color.accent}
                              />
                            )
                          ) : (
                            <MaterialCommunityIcons
                              name={
                                isExpanded ? "chevron-down" : "chevron-right"
                              }
                              size={28}
                              color={theme.color.subtleInk}
                            />
                          )}
                        </View>
                      </Pressable>
                      {isExpanded ? (
                        isEditingEatOut ? (
                          <InlineEatOutEditor
                            key={`${day}-${plannedWeek.specialMealTitles?.[day] ?? ""}`}
                            day={day}
                            initialNote={
                              plannedWeek[day] === EAT_OUT_MEAL_ID
                                ? plannedWeek.specialMealTitles?.[day]
                                : ""
                            }
                            calendarEvents={
                              groupedCalendarEvents[dayDateMap[day]] ?? []
                            }
                            onBack={() => setPendingEatOutDay(null)}
                            onSave={(note) => commitInlineEatOut(day, note)}
                            onExpandedLayout={() => focusExpandedDay(day)}
                          />
                        ) : temporaryMeal ? (
                          <InlineSideEditor
                            key={`${day}-${temporaryMeal.id}`}
                            day={day}
                            meal={temporaryMeal}
                            initialSides={
                              plannedMeal?.id === temporaryMeal.id
                                ? daySidesMap[day] ?? []
                                : []
                            }
                            suggestedSides={sessionDays.flatMap((otherDay) =>
                              otherDay !== day &&
                              plannedWeek[otherDay] === temporaryMeal.id
                                ? daySidesMap[otherDay] ?? []
                                : [],
                            )}
                            completionLabel={
                              inspirationTargetDay === day
                                ? `Save ${PLANNED_WEEK_DISPLAY_NAMES[day]}`
                                : undefined
                            }
                            completionAccessibilityLabel={
                              inspirationTargetDay === day
                                ? `Save ${temporaryMeal.title} and selected sides for ${PLANNED_WEEK_DISPLAY_NAMES[day]}`
                                : undefined
                            }
                            onDone={() => {
                              if (inspirationTargetDay === day) {
                                commitInspirationAssignment(
                                  day,
                                  temporaryMeal,
                                  pendingInlineMeal?.sides ?? [],
                                );
                                return;
                              }
                              setPendingInlineMeal(null);
                              setExpandedDrawerDay(null);
                            }}
                            onSelectedSidesChange={(selectedSides) => {
                              if (inspirationTargetDay !== day) {
                                resetSides({
                                  ...daySidesMap,
                                  [day]: selectedSides,
                                });
                              }
                              setPendingInlineMeal((current) =>
                                current?.day === day
                                  ? { ...current, sides: selectedSides }
                                  : current,
                              );
                            }}
                            onChangeMeal={() => {
                              setPendingInlineMeal(null);
                              if (inspirationTargetDay === day) {
                                setInspirationTargetDay(null);
                                setSelectedSavedIdeaMealId(null);
                                setSelectedMealPoolId(null);
                                setExpandedDrawerDay(null);
                              }
                            }}
                            onExpandedLayout={() => focusExpandedDay(day)}
                          />
                        ) : (
                          <InlineDaySearch
                            day={day}
                            meals={meals}
                            history={servedEntries}
                            assignedMeal={plannedMeal ?? null}
                            onSelectMeal={(meal) =>
                              beginInlineMealEditing(
                                day,
                                meal,
                                plannedMeal ?? null,
                              )
                            }
                            onSelectEatOut={() => setPendingEatOutDay(day)}
                            onSelectFlexNight={() =>
                              assignInlineMeal(day, FLEX_NIGHT_MEAL)
                            }
                            onEditSides={() => {
                              if (!plannedMeal) return;
                              setPendingInlineMeal({
                                day,
                                meal: plannedMeal,
                                sides: daySidesMap[day] ?? [],
                              });
                            }}
                            onViewDetails={() => {
                              if (!plannedMeal) return;
                              Keyboard.dismiss();
                              setViewingMealId(plannedMeal.id);
                            }}
                            onRemove={() => removeInlineAssignment(day)}
                            onExpandedLayout={() => focusExpandedDay(day)}
                          />
                        )
                      ) : null}
                      <CalendarEventLines events={dayEvents} />
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
      <PlannedDayEditModal
        visible={Boolean(plannedEditDay && plannedEditMeal)}
        dayName={
          plannedEditDay
            ? PLANNED_WEEK_DISPLAY_NAMES[plannedEditDay]
            : PLANNED_WEEK_DISPLAY_NAMES[activeDay]
        }
        meal={plannedEditMeal}
        sides={plannedEditDay ? daySidesMap[plannedEditDay] ?? [] : []}
        lastServedISO={plannedEditLastServedISO}
        onDismiss={() => setPlannedEditDay(null)}
        onChangePlan={() => {
          if (plannedEditDay) {
            handleChangePlannedDay(plannedEditDay);
          }
        }}
        onRemovePlan={() => {
          if (plannedEditDay) {
            handleRemoveDrawerDay(plannedEditDay);
          }
        }}
      />
      <SuggestMealModal
        visible={isSuggestModalVisible}
        dayName={PLANNED_WEEK_DISPLAY_NAMES[suggestModalDay]}
        suggestion={suggestModalEntry}
        canSuggestAnother={suggestModalPool.length > 1}
        onDismiss={handleDismissSuggestModal}
        onAddMeal={handleAddSuggestedMeal}
        onSuggestAnother={handleSuggestAnother}
        meals={meals}
        onSelectSearchMeal={handleSelectSuggestSearchMeal}
        onEatOut={handleEatOutFromSuggestModal}
        onFlexNight={handleFlexNightFromSuggestModal}
        getLastServedISO={getMealLastServedISO}
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
      paddingBottom: SCREEN_HEIGHT * 0.72,
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
    chooseDayPrompt: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.space.md,
      paddingHorizontal: theme.space.sm,
    },
    chooseDayText: {
      flex: 1,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
    },
    chooseDayMealName: {
      color: theme.color.ink,
      fontWeight: theme.type.weight.bold,
    },
    chooseDayCancel: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      paddingVertical: theme.space.sm,
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
    weekDrawerChooseTarget: {
      borderColor: theme.color.accent,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255, 75, 145, 0.06)"
          : "rgba(255, 75, 145, 0.035)",
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
    weekRowSpecialIcon: {
      width: 34,
      alignItems: "center",
      justifyContent: "center",
    },
    weekRowTitle: {
      flexShrink: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    weekRowMealTextStack: {
      flex: 1,
      justifyContent: "center",
      gap: 2,
    },
    weekRowTitleLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
    },
    weekRowSuggested: {
      color: theme.color.accent,
      fontSize: theme.type.size.xs,
    },
    weekRowSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.regular,
    },
    weekRowTitleMuted: {
      color: theme.color.subtleInk,
      fontWeight: theme.type.weight.medium,
    },
    weekRowReplace: {
      color: theme.color.accent,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.bold,
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
