import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useFocusEffect } from "expo-router";
import TabParent from "../../../components/tab-parent/TabParent";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import CurrentWeekList from "../../../components/week-dashboard/CurrentWeekList";
import TodayCard from "../../../components/week-dashboard/TodayCard";
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
import { PLANNED_WEEK_LABELS } from "../../../types/weekPlan";

export default function WeekDashboardScreen() {
  const router = useRouter();
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { meals } = useMeals();
  const { startDay } = useWeekStartController();
  const dateControlsEnabled = useFeatureFlag("weekDashboardDateControlsEnabled");
  const [overrideDate, setOverrideDate] = useState<Date | null>(null);

  useEffect(() => {
    if (!dateControlsEnabled) {
      setOverrideDate(null);
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
        dayLabel: PLANNED_WEEK_LABELS[entry.dayKey],
        mealId: entry.mealId,
      })),
    [servedEntries]
  );

  const todayServedEntry = useMemo(
    () => {
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
    },
    [servedEntries, today]
  );

  const handleMarkServed = useCallback(
    async (message: string) => {
      if (!today?.meal) {
        return;
      }
      await logServedMeal({
        dayKey: today.key,
        mealId: today.mealId,
        servedAtISO: new Date().toISOString(),
        outcome: "cookedAsPlanned",
        celebrationMessage: message,
      });
    },
    [logServedMeal, today]
  );

  const formattedDate = useMemo(
    () => formatWeekdayDate(effectiveDate),
    [effectiveDate]
  );

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

  const header = useMemo(
    () => (
      <View style={styles.headerMeta}>
        <Text style={styles.dateLabel}>
          {dateControlsEnabled && overrideDate ? "Simulated Date" : "Today"}
        </Text>
        <Text style={styles.dateValue}>{formattedDate}</Text>
        {dateControlsEnabled ? (
          <View style={styles.dateControls}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View previous day"
              style={({ pressed }) => [
                styles.dateControlButton,
                pressed && styles.dateControlButtonPressed,
              ]}
              onPress={handlePrevDay}
            >
              <Text style={styles.dateControlButtonText}>Prev Day</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="View next day"
              style={({ pressed }) => [
                styles.dateControlButton,
                pressed && styles.dateControlButtonPressed,
              ]}
              onPress={handleNextDay}
            >
              <Text style={styles.dateControlButtonText}>Next Day</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    ),
    [
      dateControlsEnabled,
      formattedDate,
      handleNextDay,
      handlePrevDay,
      overrideDate,
      styles,
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
  }, [formattedDate, isLoading, styles, theme.color.accent, today]);

  return (
    <TabParent title="Week Dashboard" header={header}>
      <ScrollView
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
          <CurrentWeekList
            days={days}
            title="Current Week Plan"
          />
          <ServedList servedWeek={servedWeek} meals={meals} title="Served Meals" />
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
    headerMeta: {
      gap: theme.space.xs,
    },
    dateLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    dateValue: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    dateControls: {
      flexDirection: "row",
      gap: theme.space.sm,
      marginTop: theme.space.sm,
    },
    dateControlButton: {
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    dateControlButtonPressed: {
      opacity: 0.85,
    },
    dateControlButtonText: {
      color: theme.color.ink,
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
