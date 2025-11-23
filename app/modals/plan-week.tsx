import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
} from "../../types/weekPlan";
import { Meal } from "../../types/meals";
import { useCurrentWeekPlan } from "../../hooks/useCurrentWeekPlan";
import {
  setCurrentWeekPlan,
  updateWeekPlanStreak,
} from "../../stores/weekPlanStorage";
import { useWeekStartController } from "../../providers/week-start/WeekStartController";
import {
  WeeklyWeekSettings,
  deriveWeekPinsFromSettings,
} from "../../components/plan-week/weekPlanner";
import { buildMealSuggestions } from "../../components/plan-week/suggestions/suggestionMatcher";
import { EAT_OUT_MEAL, EAT_OUT_MEAL_ID } from "../../types/specialMeals";
import { addDays, getNextWeekStartForDate } from "../../utils/weekDays";
import PlanDayChoiceStep, {
  DayWizardAction,
} from "../../components/plan-week/steps/PlanDayChoiceStep";
import PlannedMealsSheet from "../../components/plan-week/planned-meals/PlannedMealsSheet";
import DayPlannedToast from "../../components/plan-week/planned-meals/DayPlannedToast";
import PlanWeekHeader from "../../components/plan-week/header/PlanWeekHeader";
import WeeklyPlannerSteps from "../../components/plan-week/steps/WeeklyPlannerSteps";
import WeeklyPlanTimeline from "../../components/plan-week/WeeklyPlanTimeline";
import useDayPins from "../../hooks/plan-week/useDayPins";
import usePlanSides from "../../hooks/plan-week/usePlanSides";
import MealSearchModal from "../../components/meals/MealSearchModal";

const createInitialSuggestionIndex = () =>
  PLANNED_WEEK_ORDER.reduce<Record<PlannedWeekDayKey, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<PlannedWeekDayKey, number>);

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SUMMARY_MAX_TRANSLATE = SCREEN_HEIGHT;

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

export default function PlanWeekModal() {
  const router = useRouter();
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { meals } = useMeals();
  const { plan, isLoading } = useCurrentWeekPlan();
  const { orderedDays, startDay } = useWeekStartController();
  const initializedRef = useRef(false);

  const [plannedWeek, setPlannedWeek] = useState<CurrentPlannedWeek>(
    createEmptyCurrentPlannedWeek()
  );
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [suggestionIndexMap, setSuggestionIndexMap] = useState(
    createInitialSuggestionIndex
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isSummaryVisible, setIsSummaryVisible] = useState(false);
  const summaryTranslateY = useRef(
    new Animated.Value(SUMMARY_MAX_TRANSLATE)
  ).current;
  const summaryClosingRef = useRef(false);
  const [plannerSelection, setPlannerSelection] = useState<{
    day: PlannedWeekDayKey | null;
    meal: Meal | null;
  }>({ day: null, meal: null });
  const [isPlannerSaving, setPlannerSaving] = useState(false);
  const dayRowRefs = useRef<Record<PlannedWeekDayKey, View | null>>(
    {} as Record<PlannedWeekDayKey, View | null>
  );
  const [savedIndicatorDay, setSavedIndicatorDay] =
    useState<PlannedWeekDayKey | null>(null);
  const [toastDay, setToastDay] = useState<PlannedWeekDayKey | null>(null);
  const [pendingPlannedDay, setPendingPlannedDay] =
    useState<PlannedWeekDayKey | null>(null);
  const [plannedCardPreviewDay, setPlannedCardPreviewDay] =
    useState<PlannedWeekDayKey | null>(null);
  const [hasCompletedPlannerSetup, setHasCompletedPlannerSetup] =
    useState(false);
  const [activeWizardAction, setActiveWizardAction] =
    useState<DayWizardAction | null>(null);
  const [isCelebratingSave, setIsCelebratingSave] = useState(false);
  const [celebratedDayIndex, setCelebratedDayIndex] = useState<number | null>(
    null
  );
  const [saveToastPayload, setSaveToastPayload] = useState<{
    title: string;
    subtitle?: string;
    onComplete?: () => void;
  } | null>(null);
  const [isSearchModalVisible, setSearchModalVisible] = useState(false);
  const [searchTargetDay, setSearchTargetDay] =
    useState<PlannedWeekDayKey | null>(null);

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
    [summaryTranslateY]
  );

  const handleOpenSummary = useCallback(() => {
    if (summaryClosingRef.current) {
      return;
    }
    setIsSummaryVisible(true);
  }, []);

  const handleCloseSummary = useCallback(async () => {
    if (summaryClosingRef.current || !isSummaryVisible) {
      return;
    }
    summaryClosingRef.current = true;
    await animateSummaryTo(
      SUMMARY_MAX_TRANSLATE,
      theme.motion.duration.normal,
      Easing.bezier(0.4, 0, 1, 1)
    );
    summaryClosingRef.current = false;
    setIsSummaryVisible(false);
    setPlannerSelection({ day: null, meal: null });
    setPendingPlannedDay(null);
  }, [animateSummaryTo, isSummaryVisible, theme.motion.duration.normal]);

  const activeDay =
    orderedDays[activeDayIndex] ?? orderedDays[0] ?? PLANNED_WEEK_ORDER[0];
  const { activeDayPins, handleDayPinsChange, replaceDayPins } = useDayPins({
    activeDay,
  });
  const { daySidesMap, activeDaySides, handleAddSide, handleRemoveSide } =
    usePlanSides({ activeDay });
  const handlePlannerSetupComplete = useCallback(
    (settings: WeeklyWeekSettings) => {
      const nextPins = deriveWeekPinsFromSettings(settings);
      replaceDayPins(nextPins);
      setHasCompletedPlannerSetup(true);
    },
    [replaceDayPins]
  );
  const planningWeekStart = useMemo(
    () => getNextWeekStartForDate(startDay),
    [startDay]
  );
  const planningWeekEnd = useMemo(
    () => addDays(planningWeekStart, 6),
    [planningWeekStart]
  );
  const planningWeekLabel = useMemo(
    () => formatWeekRangeLabel(planningWeekStart, planningWeekEnd),
    [planningWeekEnd, planningWeekStart]
  );
  const isWeekComplete = useMemo(
    () => orderedDays.every((day) => Boolean(plannedWeek[day])),
    [orderedDays, plannedWeek]
  );
  const isDayPlanningStep = Boolean(activeWizardAction);

  useEffect(() => {
    setActiveDayIndex(0);
  }, [orderedDays]);

  useEffect(() => {
    if (plan && !initializedRef.current) {
      initializedRef.current = true;
      setPlannedWeek(plan);
    }
  }, [plan]);

  useEffect(() => {
    setActiveWizardAction(null);
    setPlannedCardPreviewDay(null);
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
      Easing.bezier(0, 0, 0.2, 1)
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

  const filteredMeals = useMemo(
    () =>
      [...meals].sort((a, b) =>
        (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
      ),
    [meals]
  );

  const suggestionPool = useMemo(
    () => buildMealSuggestions(filteredMeals, activeDayPins),
    [activeDayPins, filteredMeals]
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

  const handleAddMeal = useCallback(() => {
    if (!activeSuggestion) {
      return;
    }
    setPendingPlannedDay(activeDay);
    setPlannerSelection({ day: activeDay, meal: activeSuggestion });
    savedIndicatorDay && setSavedIndicatorDay(null);
    handleOpenSummary();
  }, [activeDay, activeSuggestion, handleOpenSummary, savedIndicatorDay]);

  const handleSelectSearchMeal = useCallback(
    (meal: Meal) => {
      const targetDay = searchTargetDay ?? activeDay;
      setPendingPlannedDay(targetDay);
      setPlannerSelection({ day: targetDay, meal });
      savedIndicatorDay && setSavedIndicatorDay(null);
      handleOpenSummary();
      setSearchModalVisible(false);
      setSearchTargetDay(null);
    },
    [activeDay, handleOpenSummary, savedIndicatorDay, searchTargetDay]
  );

  const handleDismissSearchModal = useCallback(() => {
    setSearchModalVisible(false);
    setSearchTargetDay(null);
  }, []);

  const handleSelectEatOut = useCallback(() => {
    setPendingPlannedDay(activeDay);
    setPlannerSelection({ day: activeDay, meal: EAT_OUT_MEAL });
    savedIndicatorDay && setSavedIndicatorDay(null);
    handleOpenSummary();
  }, [activeDay, handleOpenSummary, savedIndicatorDay]);

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
    [activeDay, plannedWeek]
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
    [activeDay, filteredMeals.length]
  );

  const runSavePlanCelebration = useCallback(async () => {
    if (!orderedDays.length) {
      return;
    }
    setIsCelebratingSave(true);
    setCelebratedDayIndex(null);
    const streak = await updateWeekPlanStreak(planningWeekStart);
    const delay = (ms: number) =>
      new Promise<void>((resolve) => setTimeout(resolve, ms));
    for (let i = 0; i < orderedDays.length; i += 1) {
      setCelebratedDayIndex(i);
      await Haptics.selectionAsync().catch(() => {});
      await delay(140);
    }
    const baseMessage = `Plan saved for ${planningWeekLabel}`;
    const streakLine =
      streak.count > 0 ? `🔥 ${streak.count}-week streak` : "";
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
  }, [
    orderedDays,
    planningWeekLabel,
    planningWeekStart,
  ]);

  const handleSavePlan = useCallback(async () => {
    if (isSaving || isCelebratingSave) {
      return;
    }
    setIsSaving(true);
    try {
      await setCurrentWeekPlan(plannedWeek);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
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
  ]);

  const handleToastComplete = useCallback(() => {
    if (!toastDay) {
      return;
    }
    const currentIndex = orderedDays.indexOf(toastDay);
    if (currentIndex !== -1 && orderedDays.length > 0) {
      const nextIndex = Math.min(
        currentIndex + 1,
        Math.max(orderedDays.length - 1, 0)
      );
      setActiveDayIndex(nextIndex);
    }
    setActiveWizardAction(null);
    setPlannedCardPreviewDay(null);
    setToastDay(null);
    setPendingPlannedDay(null);
  }, [orderedDays, toastDay]);
  const handlePlannerSave = useCallback(async () => {
    if (!plannerSelection.meal) {
      return;
    }
    setPlannerSaving(true);
    const targetDay = plannerSelection.day ?? pendingPlannedDay ?? activeDay;
    const nextPlan: CurrentPlannedWeek = {
      ...plannedWeek,
      [targetDay]: plannerSelection.meal.id,
    };
    setPlannedWeek(nextPlan);
    try {
      await setCurrentWeekPlan(nextPlan);
      await Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success
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
  }, [activeDay, handleCloseSummary, plannerSelection, plannedWeek, pendingPlannedDay]);

  const handleRequestEditDay = useCallback(
    (day: PlannedWeekDayKey) => {
      const targetIndex = orderedDays.indexOf(day);
      const applyEditState = () => {
        if (targetIndex !== -1) {
          setActiveDayIndex(targetIndex);
        }
        if (plannedWeek[day]) {
          setPlannedCardPreviewDay(day);
        } else {
          setPlannedCardPreviewDay(null);
        }
        setActiveWizardAction("suggest");
        setPendingPlannedDay(null);
      };
      handleCloseSummary().then(applyEditState);
    },
    [handleCloseSummary, orderedDays, plannedWeek]
  );

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
              Easing.bezier(0, 0, 0.2, 1)
            );
          }
        },
        onPanResponderTerminate: () => {
          animateSummaryTo(
            0,
            theme.motion.duration.normal,
            Easing.bezier(0, 0, 0.2, 1)
          );
        },
      }),
    [
      animateSummaryTo,
      handleCloseSummary,
      summaryTranslateY,
      theme.motion.duration.normal,
    ]
  );

  const shouldShowTimeline = isWeekComplete && !isSummaryVisible;
  const searchModalTitleDay = searchTargetDay ?? activeDay;

  if (!hasCompletedPlannerSetup) {
    return (
      <SafeAreaView
        style={styles.plannerStepsSafeArea}
        edges={["top", "left", "right", "bottom"]}
      >
        <WeeklyPlannerSteps
          onComplete={handlePlannerSetupComplete}
          onCancel={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  if (toastDay) {
    return (
      <View style={styles.toastScreen}>
        <DayPlannedToast
          dayName={PLANNED_WEEK_DISPLAY_NAMES[toastDay]}
          onComplete={handleToastComplete}
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
          isDayPlanningStep={isDayPlanningStep}
          orderedDays={orderedDays}
          plannedWeek={plannedWeek}
          activeDay={activeDay}
        />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {!shouldShowTimeline && !activeWizardAction ? (
            <PlanDayChoiceStep
              dayKey={activeDay}
              orderedDays={orderedDays}
              plannedWeek={plannedWeek}
              weekLabel={planningWeekLabel}
              onSelectOption={handleSelectWizardOption}
              onSelectEatOut={handleSelectEatOut}
              onSelectDay={(day) => {
                const targetIndex = orderedDays.indexOf(day);
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
            />
          ) : null}

          {!shouldShowTimeline && activeWizardAction ? (
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

          {shouldShowTimeline ? (
            <WeeklyPlanTimeline
              orderedDays={orderedDays}
              plannedWeek={plannedWeek}
              meals={meals}
              daySidesMap={daySidesMap}
              celebratedIndex={celebratedDayIndex}
            />
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {isWeekComplete && !isSummaryVisible && (
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
        {saveToastPayload ? (
          <DayPlannedToast
            title={saveToastPayload.title}
            subtitle={saveToastPayload.subtitle}
            onComplete={() => {
              saveToastPayload.onComplete?.();
              setSaveToastPayload(null);
            }}
          />
        ) : null}
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
            orderedDays={orderedDays}
            plannedWeek={plannedWeek}
            meals={meals}
            daySidesMap={daySidesMap}
            plannerSelection={plannerSelection}
            savedIndicatorDay={savedIndicatorDay}
            summaryTranslateY={summaryTranslateY}
            summaryPanHandlers={summaryPanResponder.panHandlers}
            onSelectPlannerDay={handleSelectPlannerDay}
            onRequestEditDay={handleRequestEditDay}
            onSaveSelection={handlePlannerSave}
            isPlannerSaving={isPlannerSaving}
            registerRowRef={(day, ref) => {
              dayRowRefs.current[day] = ref;
            }}
          />
        </View>
      )}
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
    swipeContainer: {
      flex: 1,
    },
    safe: {
      flex: 1,
      backgroundColor: theme.color.bg,
    },
    content: {
      paddingHorizontal: theme.space.lg,
      paddingBottom: theme.space.lg,
      gap: theme.space["2xl"],
    },
    plannerSection: {
      gap: theme.space.md,
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
