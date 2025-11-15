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
import DayMealPlannerCard from "../../components/plan-week/DayMealPlannerCard";
import WeeklyPlannerSteps from "../../components/plan-week/WeeklyPlannerSteps";
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
import { setCurrentWeekPlan } from "../../stores/weekPlanStorage";
import { useWeekStartController } from "../../providers/week-start/WeekStartController";
import {
  DayPinsPerWeek,
  DayPinsState,
  createEmptyDayPinsMap,
  normalizeDayPinsState,
} from "../../types/dayPins";
import {
  getStoredDayPins,
  setStoredDayPins,
} from "../../stores/dayPinsStorage";
import {
  WeeklyWeekSettings,
  deriveWeekPinsFromSettings,
} from "../../components/plan-week/weekPlanner";
import { buildMealSuggestions } from "../../components/plan-week/suggestionMatcher";
import { EAT_OUT_MEAL, EAT_OUT_MEAL_ID } from "../../types/specialMeals";

const createInitialSuggestionIndex = () =>
  PLANNED_WEEK_ORDER.reduce<Record<PlannedWeekDayKey, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<PlannedWeekDayKey, number>);

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SUMMARY_MAX_TRANSLATE = SCREEN_HEIGHT;

export default function PlanWeekModal() {
  const router = useRouter();
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { meals } = useMeals();
  const { plan, isLoading } = useCurrentWeekPlan();
  const { orderedDays } = useWeekStartController();
  const initializedRef = useRef(false);

  const [plannedWeek, setPlannedWeek] = useState<CurrentPlannedWeek>(
    createEmptyCurrentPlannedWeek()
  );
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [suggestionIndexMap, setSuggestionIndexMap] = useState(
    createInitialSuggestionIndex
  );
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSummaryVisible, setIsSummaryVisible] = useState(false);
  const summaryTranslateY = useRef(
    new Animated.Value(SUMMARY_MAX_TRANSLATE)
  ).current;
  const summaryClosingRef = useRef(false);
  const [dayPinsMap, setDayPinsMap] = useState<DayPinsPerWeek>(() =>
    createEmptyDayPinsMap()
  );
  const pinsHydratedRef = useRef(false);
  const [plannerSelection, setPlannerSelection] = useState<{
    day: PlannedWeekDayKey | null;
    meal: Meal | null;
  }>({ day: null, meal: null });
  const [isPlannerSaving, setPlannerSaving] = useState(false);
  const dayRowRefs = useRef<Record<PlannedWeekDayKey, View | null>>(
    {} as Record<PlannedWeekDayKey, View | null>
  );
  const [flashDay, setFlashDay] = useState<PlannedWeekDayKey | null>(null);
  const flashTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [savedIndicatorDay, setSavedIndicatorDay] =
    useState<PlannedWeekDayKey | null>(null);
  const [hasCompletedPlannerSetup, setHasCompletedPlannerSetup] =
    useState(false);
  const [daySidesMap, setDaySidesMap] = useState<
    Record<PlannedWeekDayKey, string[]>
  >(() =>
    PLANNED_WEEK_ORDER.reduce<Record<PlannedWeekDayKey, string[]>>(
      (acc, key) => {
        acc[key] = [];
        return acc;
      },
      {} as Record<PlannedWeekDayKey, string[]>
    )
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
    setFlashDay(null);
    setPlannerSelection({ day: null, meal: null });
  }, [animateSummaryTo, isSummaryVisible, theme.motion.duration.normal]);

  const handleDayPinsChange = useCallback(
    (day: PlannedWeekDayKey, next: DayPinsState) => {
      pinsHydratedRef.current = true;
      setDayPinsMap((prev) => {
        const updated: DayPinsPerWeek = {
          ...prev,
          [day]: normalizeDayPinsState(next),
        };
        setStoredDayPins(updated).catch(() => {});
        return updated;
      });
    },
    []
  );

  const handlePlannerSetupComplete = useCallback(
    (settings: WeeklyWeekSettings) => {
      const nextPins = deriveWeekPinsFromSettings(settings);
      pinsHydratedRef.current = true;
      setDayPinsMap(nextPins);
      setStoredDayPins(nextPins).catch(() => {});
      setHasCompletedPlannerSetup(true);
    },
    []
  );

  const activeDay =
    orderedDays[activeDayIndex] ?? orderedDays[0] ?? PLANNED_WEEK_ORDER[0];
  const isWeekComplete = useMemo(
    () => orderedDays.every((day) => Boolean(plannedWeek[day])),
    [orderedDays, plannedWeek]
  );

  useEffect(() => {
    setActiveDayIndex(0);
  }, [orderedDays]);

  useEffect(() => {
    let isMounted = true;
    getStoredDayPins().then((stored) => {
      if (!isMounted || pinsHydratedRef.current) {
        return;
      }
      pinsHydratedRef.current = true;
      setDayPinsMap(stored);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (plan && !initializedRef.current) {
      initializedRef.current = true;
      setPlannedWeek(plan);
    }
  }, [plan]);

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
        setFlashDay(plannerSelection.day);
        if (flashTimerRef.current) {
          clearTimeout(flashTimerRef.current);
        }
        flashTimerRef.current = setTimeout(() => setFlashDay(null), 600);
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

  const filteredMeals = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return [...meals]
      .filter((meal) => {
        if (!query) {
          return true;
        }
        return meal.title.toLowerCase().includes(query);
      })
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }, [meals, searchQuery]);

  const activeDayPins = useMemo(
    () => normalizeDayPinsState(dayPinsMap[activeDay]),
    [activeDay, dayPinsMap]
  );

  const suggestionPool = useMemo(
    () => buildMealSuggestions(filteredMeals, activeDayPins),
    [activeDayPins, filteredMeals]
  );

  const activeDaySides = daySidesMap[activeDay] ?? [];

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

  const handleChangeDay = useCallback(
    (day: PlannedWeekDayKey) => {
      const index = orderedDays.indexOf(day);
      if (index >= 0) {
        setActiveDayIndex(index);
      }
    },
    [orderedDays]
  );

  const totalDays = orderedDays.length;

  const handleStepDay = useCallback(
    (delta: number) => {
      let didChange = false;
      setActiveDayIndex((prev) => {
        const next = prev + delta;
        if (next < 0 || next >= totalDays) {
          return prev;
        }
        didChange = true;
        return next;
      });
      return didChange;
    },
    [totalDays]
  );

  const handleSwipeWithHaptics = useCallback(
    (delta: number) => {
      if (handleStepDay(delta)) {
        Haptics.selectionAsync().catch(() => {});
      }
    },
    [handleStepDay]
  );

  const handleSelectPlannerDay = useCallback(
    (day: PlannedWeekDayKey) => {
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
      setFlashDay(day);
      if (flashTimerRef.current) {
        clearTimeout(flashTimerRef.current);
      }
      flashTimerRef.current = setTimeout(() => setFlashDay(null), 600);
    },
    []
  );

  const handleAddMeal = useCallback(() => {
    if (!activeSuggestion) {
      return;
    }
    setPlannerSelection({ day: activeDay, meal: activeSuggestion });
    setFlashDay(activeDay);
    savedIndicatorDay && setSavedIndicatorDay(null);
    handleOpenSummary();
  }, [activeDay, activeSuggestion, handleOpenSummary, savedIndicatorDay]);

  const handleSelectEatOut = useCallback(() => {
    setPlannerSelection({ day: activeDay, meal: EAT_OUT_MEAL });
    setFlashDay(activeDay);
    savedIndicatorDay && setSavedIndicatorDay(null);
    handleOpenSummary();
  }, [activeDay, handleOpenSummary, savedIndicatorDay]);

  const handleAddSide = useCallback(
    (day: PlannedWeekDayKey, side: string) => {
      setDaySidesMap((prev) => {
        const existing = prev[day] ?? [];
        return {
          ...prev,
          [day]: [...existing, side],
        };
      });
    },
    []
  );

  const handleRemoveSide = useCallback(
    (day: PlannedWeekDayKey, index: number) => {
      setDaySidesMap((prev) => {
        const existing = prev[day] ?? [];
        if (index < 0 || index >= existing.length) {
          return prev;
        }
        const nextSides = existing.filter((_, idx) => idx !== index);
        return {
          ...prev,
          [day]: nextSides,
        };
      });
    },
    []
  );

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

  const handleSavePlan = useCallback(async () => {
    setIsSaving(true);
    try {
      await setCurrentWeekPlan(plannedWeek);
      router.back();
    } finally {
      setIsSaving(false);
    }
  }, [plannedWeek, router]);
  const handlePlannerSave = useCallback(async () => {
    if (!plannerSelection.day || !plannerSelection.meal) {
      return;
    }
    setPlannerSaving(true);
    const targetDay = plannerSelection.day;
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
        handleCloseSummary();
      }, 320);
    } finally {
      setPlannerSaving(false);
    }
  }, [handleCloseSummary, plannerSelection, plannedWeek]);

  const daySwipeResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > Math.abs(gesture.dy) &&
          Math.abs(gesture.dx) > 12,
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > Math.abs(gesture.dy) &&
          Math.abs(gesture.dx) > 12,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > 40) {
            handleSwipeWithHaptics(-1);
          } else if (gesture.dx < -40) {
            handleSwipeWithHaptics(1);
          }
        },
      }),
    [handleSwipeWithHaptics]
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

  return (
    <View style={styles.swipeContainer} {...daySwipeResponder.panHandlers}>
      <SafeAreaView
        style={styles.safe}
        edges={["top", "left", "right", "bottom"]}
      >
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Close plan week"
            style={styles.headerButton}
          >
            <MaterialCommunityIcons
              name="close"
              size={22}
              color={theme.color.ink}
            />
          </Pressable>
          <Text style={styles.headerTitle}>Plan Your Week</Text>
          <Pressable
            onPress={handleOpenSummary}
            accessibilityRole="button"
            accessibilityLabel="View planned meals summary"
            style={[
              styles.headerButton,
              isSummaryVisible && styles.headerButtonActive,
            ]}
          >
            <MaterialCommunityIcons
              name={
                isSummaryVisible
                  ? "clipboard-text-outline"
                  : "clipboard-text-outline"
              }
              size={22}
              color={isSummaryVisible ? theme.color.accent : theme.color.ink}
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.daySelectorRow}>
            {orderedDays.map((day) => {
              const isActive = day === activeDay;
              const isPlanned = Boolean(plannedWeek[day]);
              return (
                <Pressable
                  key={day}
                  onPress={() => handleChangeDay(day)}
                  accessibilityRole="button"
                  accessibilityLabel={`Plan ${PLANNED_WEEK_DISPLAY_NAMES[day]}`}
                  style={[styles.dayChip, isActive && styles.dayChipActive]}
                >
                  <Text
                    style={[
                      styles.dayChipText,
                      isActive && styles.dayChipTextActive,
                      !isActive && isPlanned && styles.dayChipTextPlanned,
                    ]}
                  >
                    {PLANNED_WEEK_LABELS[day]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {isLoading && !initializedRef.current ? (
            <ActivityIndicator color={theme.color.accent} />
          ) : (
            <DayMealPlannerCard
              dayKey={activeDay}
              dayDisplayName={PLANNED_WEEK_DISPLAY_NAMES[activeDay]}
              meal={activeSuggestion}
              suggestionContext={activeSuggestionContext}
              plannedMeal={plannedMealForActiveDay}
              onAdd={handleAddMeal}
              onShuffle={() => stepSuggestion(1)}
              onSelectEatOut={handleSelectEatOut}
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              pins={activeDayPins}
              onPinsChange={(next) => handleDayPinsChange(activeDay, next)}
              sides={activeDaySides}
              onAddSide={(side) => handleAddSide(activeDay, side)}
              onRemoveSide={(index) => handleRemoveSide(activeDay, index)}
            />
          )}
        </ScrollView>

        <View style={styles.footer}>
          {isWeekComplete && !isSummaryVisible && (
            <Pressable
              onPress={handleSavePlan}
              disabled={isSaving}
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
          <Animated.View
            style={[
              styles.summarySheet,
              { transform: [{ translateY: summaryTranslateY }] },
            ]}
            {...summaryPanResponder.panHandlers}
          >
            <SafeAreaView
              edges={["bottom"]}
              style={styles.summarySheetSafeArea}
            >
              <View style={styles.summaryHandle} />
              <View style={styles.summaryModalHeaderRow}>
                <View style={styles.summaryModalHeader}>
                  <Text style={styles.summaryModalTitle}>Planned Meals</Text>
                  <Text style={styles.summaryModalSubtitle}>
                    Review your picks for the week.
                  </Text>
                </View>
              </View>
              <View style={styles.summaryList}>
                {orderedDays.map((day) => {
                  const mealId = plannedWeek[day];
                  const plannedMeal =
                    mealId === EAT_OUT_MEAL_ID
                      ? EAT_OUT_MEAL
                      : meals.find((item) => item.id === mealId);
                  const isSelected = plannerSelection.day === day;
                  const canSelect = Boolean(plannerSelection.meal);
                  return (
                    <Pressable
                      key={day}
                      ref={(node) => {
                        dayRowRefs.current[day] = node;
                      }}
                      onPress={() =>
                        canSelect ? handleSelectPlannerDay(day) : undefined
                      }
                      disabled={!canSelect}
                      accessibilityRole={canSelect ? "button" : "text"}
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${PLANNED_WEEK_DISPLAY_NAMES[day]} ${
                        plannedMeal ? plannedMeal.title : "unplanned"
                      }`}
                      style={[
                        styles.summaryRow,
                        isSelected && styles.summaryRowSelected,
                        flashDay === day && styles.summaryRowFlashing,
                      ]}
                    >
                      <Text style={styles.summaryDay}>
                        {PLANNED_WEEK_LABELS[day]}
                      </Text>
                      <Text style={styles.summaryMeal} numberOfLines={1}>
                        {isSelected && plannerSelection.meal
                          ? `${plannerSelection.meal.emoji} ${plannerSelection.meal.title}`
                          : plannedMeal
                          ? `${plannedMeal.emoji} ${plannedMeal.title}`
                          : "Unplanned"}
                      </Text>
                      {savedIndicatorDay === day ? (
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={18}
                          color={theme.color.accent}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              {plannerSelection.day && plannerSelection.meal ? (
                <View style={styles.summaryPrimaryButtonWrapper}>
                  <Pressable
                    onPress={handlePlannerSave}
                    disabled={isPlannerSaving}
                    accessibilityRole="button"
                    accessibilityLabel={`Save to ${
                      PLANNED_WEEK_DISPLAY_NAMES[plannerSelection.day]
                    }`}
                    style={({ pressed }) => [
                      styles.summaryPrimaryButton,
                      pressed && !isPlannerSaving && styles.summaryPrimaryButtonPressed,
                      isPlannerSaving && styles.summaryPrimaryButtonDisabled,
                    ]}
                  >
                    {isPlannerSaving ? (
                      <ActivityIndicator color={theme.color.ink} />
                    ) : (
                      <Text style={styles.summaryPrimaryButtonText}>
                        {`Save to ${
                          PLANNED_WEEK_DISPLAY_NAMES[plannerSelection.day]
                        }`}
                      </Text>
                    )}
                  </Pressable>
                </View>
              ) : null}
            </SafeAreaView>
          </Animated.View>
        </View>
      )}
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
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.space.xl,
      paddingVertical: theme.space.lg,
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    headerButtonActive: {
      borderColor: theme.color.accent,
    },
    headerTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    content: {
      paddingHorizontal: theme.space.lg,
      paddingBottom: theme.space.lg,
      gap: theme.space["2xl"],
    },
    daySelectorRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: theme.space.xs,
      flexWrap: "wrap",
    },
    dayChip: {
      paddingHorizontal: theme.space.sm,
      paddingVertical: theme.space.xs,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
    },
    dayChipActive: {
      backgroundColor: theme.color.accent,
    },
    dayChipText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      letterSpacing: 1,
    },
    dayChipTextActive: {
      color: theme.color.ink,
    },
    dayChipTextPlanned: {
      color: theme.color.accent,
    },
    summaryBackdrop: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.4)",
    },
    summarySheet: {
      backgroundColor: theme.color.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      overflow: "hidden",
    },
    summarySheetSafeArea: {
      paddingHorizontal: theme.space.xl,
      paddingBottom: theme.space.xl,
      paddingTop: theme.space.lg,
      gap: theme.space.lg,
    },
    summaryHandle: {
      alignSelf: "center",
      width: 48,
      height: 4,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.cardOutline,
    },
    summaryModalHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.space.md,
    },
    summaryModalHeader: {
      flex: 1,
      gap: theme.space.xs,
    },
    summaryModalTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    summaryModalSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    summaryList: {
      gap: theme.space.sm,
      paddingBottom: theme.space.lg,
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.space.md,
      borderRadius: theme.radius.lg,
      paddingVertical: theme.space.sm,
      paddingHorizontal: theme.space.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
    },
    summaryRowSelected: {
      borderColor: theme.color.accent,
      backgroundColor: theme.color.surface,
    },
    summaryRowFlashing: {
      backgroundColor: theme.color.surfaceAlt,
      opacity: 0.85,
    },
    summaryDay: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      width: 48,
    },
    summaryMeal: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      textAlign: "right",
    },
    summaryPrimaryButtonWrapper: {
      paddingTop: theme.space.md,
    },
    summaryPrimaryButton: {
      height: theme.component.button.height,
      borderRadius: theme.component.button.radius,
      backgroundColor: theme.color.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    summaryPrimaryButtonPressed: {
      opacity: 0.85,
    },
    summaryPrimaryButtonDisabled: {
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
    },
    summaryPrimaryButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
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
