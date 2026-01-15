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
import TabParent from "../../../components/tab-parent/TabParent";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import CurrentWeekList from "../../../components/week-dashboard/CurrentWeekList";
import TodayCard from "../../../components/week-dashboard/TodayCard";
import UnmarkedCard from "../../../components/week-dashboard/UnmarkedCard";
import DateControls from "../../../components/week-dashboard/DateControls";
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
} from "../../../utils/weekDays";
import {
  PLANNED_WEEK_LABELS,
  createEmptyCurrentPlannedWeek,
  createEmptyCurrentWeekSides,
  PlannedWeekDayKey,
} from "../../../types/weekPlan";
import {
  setCurrentWeekPlan,
  setCurrentWeekSides,
  getWeekPlanStreak,
} from "../../../stores/weekPlanStorage";
import { clearServedMeals } from "../../../stores/servedMealsStorage";
import type { ServedOutcome } from "../../../components/week-dashboard/servedActions";
import { getRandomCelebrationMessage } from "../../../components/week-dashboard/celebrations";
import { FamilyRatingValue } from "../../../types/meals";
import { setFamilyRatingValue } from "../../../utils/familyRatings";

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
  const [streakCount, setStreakCount] = useState(0);
  const [isStreakModalOpen, setStreakModalOpen] = useState(false);
  const dashboardAnim = useRef(new Animated.Value(0)).current;
  const plannedDayCount = useMemo(
    () =>
      orderedDays.reduce(
        (acc, day) => (typeof plan?.[day] === "string" ? acc + 1 : acc),
        0
      ),
    [orderedDays, plan]
  );
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
      refreshServedMeals();
      refreshStreak();
    }, [refreshServedMeals, refreshStreak, refreshWeekPlan])
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

  const unmarkedDays = useMemo(
    () =>
      days
        .filter(
          (day) =>
            day.status === "past" &&
            Boolean(day.meal && day.mealId) &&
            !servedEntries.some((entry) => entry.dayKey === day.key)
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
          });
        }
      }
    },
    [getRandomCelebrationMessage, logServedMeal, meals, updateMeal]
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
  const showPlanningCTA = !showWeekPlanDetails;

  const showPlanButton = useMemo(() => {
    const reference = startOfDay(effectiveDate);
    const nextWeekStart = getNextWeekStartForDate(startDay, reference);
    const diffMs = nextWeekStart.getTime() - reference.getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    return diffMs <= oneDayMs;
  }, [effectiveDate, startDay]);

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
      setCurrentWeekPlan(weekStartISO, emptyPlan),
      setCurrentWeekSides(weekStartISO, emptySides),
    ]);
    await refreshWeekPlan();
  }, [refreshWeekPlan, setPlanState, setSidesState, weekStartISO]);

  const handleClearServedMeals = useCallback(async () => {
    await clearServedMeals();
    await refreshServedMeals();
  }, [refreshServedMeals]);

  const renderPlanningCTA = useCallback(
    (mode: "start" | "resume", onPrimary: () => void, onSkip?: () => void) => {
      const isResume = mode === "resume";
      const primaryLabel = isResume ? "Resume planning" : "Start planning";
      const title = isResume ? "You're partway through" : "Ready when you are";
      const subtitle = isResume
        ? `You planned ${plannedDayCount} of ${orderedDays.length} nights. Jump back in where you left off.`
        : "Pick dinners for the week in a few minutes. You can always change them later.";
      const progress = orderedDays.length
        ? Math.min(1, plannedDayCount / orderedDays.length)
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
                {plannedDayCount}/{orderedDays.length}
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
    [orderedDays.length, plannedDayCount]
  );

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
      onSelectOutcome={(outcome) =>
        handleUnmarkedOutcome(day.key, day.mealId!, day.plannedDate, outcome)
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
            {showPlanButton ? (
              <Pressable
                style={({ pressed }) => [
                  styles.planButton,
                  pressed && styles.planButtonPressed,
                ]}
                onPress={() => router.push("/modals/plan-week")}
                accessibilityRole="button"
                accessibilityLabel="Plan upcoming week"
              >
                <Text style={styles.planButtonText}>Plan Next Week</Text>
              </Pressable>
            ) : null}

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
                </>
              ) : (
                renderPlanningCTA(
                  plannedDayCount > 0 ? "resume" : "start",
                  () => router.push("/modals/plan-week")
                )
              )}
              <ServedList
                servedWeek={servedWeek}
                meals={meals}
                title="Served Meals"
                onFamilyRatingChange={handleFamilyRatingChange}
              />
            </View>
          </ScrollView>
        </TabParent>
      </Animated.View>
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
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
      paddingVertical: theme.space.md,
      paddingHorizontal: theme.space.lg,
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    planButtonPressed: {
      opacity: 0.85,
    },
    planButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
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
