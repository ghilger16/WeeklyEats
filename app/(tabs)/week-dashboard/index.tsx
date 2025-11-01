import {
  ActivityIndicator,
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
  PlannedWeekDayKey,
} from "../../../types/weekPlan";
import { setCurrentWeekPlan } from "../../../stores/weekPlanStorage";
import { clearServedMeals } from "../../../stores/servedMealsStorage";
import type { ServedOutcome } from "../../../components/week-dashboard/servedActions";
import { getRandomCelebrationMessage } from "../../../components/week-dashboard/celebrations";

export default function WeekDashboardScreen() {
  const router = useRouter();
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { meals, updateMeal } = useMeals();
  const { startDay } = useWeekStartController();
  const dateControlsEnabled = useFeatureFlag(
    "weekDashboardDateControlsEnabled"
  );
  const [overrideDate, setOverrideDate] = useState<Date | null>(null);
  const [isPreviewVisible, setPreviewVisible] = useState(false);
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

  const effectiveDate = useMemo(
    () => (dateControlsEnabled ? overrideDate ?? new Date() : new Date()),
    [dateControlsEnabled, overrideDate]
  );

  const {
    isLoading,
    days,
    today,
    plan,
    setPlanState,
    refresh: refreshWeekPlan,
  } = useCurrentWeekPlan({
    today: effectiveDate,
  });
  const {
    entries: servedEntries,
    logServedMeal,
    refresh: refreshServedMeals,
  } = useServedMeals();

  useFocusEffect(
    useCallback(() => {
      refreshWeekPlan();
      refreshServedMeals();
    }, [refreshServedMeals, refreshWeekPlan])
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
        .sort(
          (a, b) =>
            b.plannedDate.getTime() - a.plannedDate.getTime()
        ),
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
          outcome === "served"
            ? getRandomCelebrationMessage()
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
    const emptyPlan = createEmptyCurrentPlannedWeek();
    setPlanState(emptyPlan);
    await setCurrentWeekPlan(emptyPlan);
    await refreshWeekPlan();
  }, [refreshWeekPlan, setPlanState]);

  const handleClearServedMeals = useCallback(async () => {
    await clearServedMeals();
    await refreshServedMeals();
  }, [refreshServedMeals]);

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

  return (
    <TabParent title="Week Dashboard" header={header}>
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
              await setCurrentWeekPlan(nextPlan);
            }}
          />
          <ServedList
            servedWeek={servedWeek}
            meals={meals}
            title="Served Meals"
          />
        </View>
      </ScrollView>
    </TabParent>
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
