import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { useMeals } from "../../hooks/useMeals";
import DayMealPlannerCard from "../../components/plan-week/DayMealPlannerCard";
import {
  CurrentPlannedWeek,
  PLANNED_WEEK_DISPLAY_NAMES,
  PLANNED_WEEK_LABELS,
  PLANNED_WEEK_ORDER,
  PlannedWeekDayKey,
  createEmptyCurrentPlannedWeek,
} from "../../types/weekPlan";
import { useCurrentWeekPlan } from "../../hooks/useCurrentWeekPlan";
import { setCurrentWeekPlan } from "../../stores/weekPlanStorage";
import { useWeekStartController } from "../../providers/week-start/WeekStartController";

type DifficultyKey = "easy" | "medium" | "hard";

const createInitialSuggestionIndex = () =>
  PLANNED_WEEK_ORDER.reduce<Record<PlannedWeekDayKey, number>>((acc, key) => {
    acc[key] = 0;
    return acc;
  }, {} as Record<PlannedWeekDayKey, number>);

const mapDifficultyToKey = (value: number | undefined): DifficultyKey => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "medium";
  }
  if (value <= 2) return "easy";
  if (value >= 4) return "hard";
  return "medium";
};

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
  const [difficultyFilter, setDifficultyFilter] =
    useState<DifficultyKey>("medium");
  const [suggestionIndexMap, setSuggestionIndexMap] = useState(
    createInitialSuggestionIndex
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const activeDay =
    orderedDays[activeDayIndex] ?? orderedDays[0] ?? PLANNED_WEEK_ORDER[0];

  useEffect(() => {
    setActiveDayIndex(0);
  }, [orderedDays]);

  useEffect(() => {
    if (plan && !initializedRef.current) {
      initializedRef.current = true;
      setPlannedWeek(plan);
    }
  }, [plan]);

  const filteredMeals = useMemo(() => {
    const difficultyMatches = (mealDifficulty: DifficultyKey) => {
      if (!difficultyFilter) return true;
      return mealDifficulty === difficultyFilter;
    };

    const query = searchQuery.trim().toLowerCase();
    return meals
      .filter((meal) => {
        const mealDifficulty = mapDifficultyToKey(meal.difficulty);
        if (!difficultyMatches(mealDifficulty)) {
          return false;
        }
        if (!query) {
          return true;
        }
        return meal.title.toLowerCase().includes(query);
      })
      .sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }, [difficultyFilter, meals, searchQuery]);

  const activeSuggestion = useMemo(() => {
    if (!filteredMeals.length) {
      return undefined;
    }
    const index = suggestionIndexMap[activeDay] ?? 0;
    const normalizedIndex =
      ((index % filteredMeals.length) + filteredMeals.length) %
      filteredMeals.length;
    return filteredMeals[normalizedIndex];
  }, [activeDay, filteredMeals, suggestionIndexMap]);

  const handleChangeDay = useCallback(
    (day: PlannedWeekDayKey) => {
      const index = orderedDays.indexOf(day);
      if (index >= 0) {
        setActiveDayIndex(index);
      }
    },
    [orderedDays]
  );

  const handleAddMeal = useCallback(() => {
    if (!activeSuggestion) {
      return;
    }
    setPlannedWeek((prev) => ({
      ...prev,
      [activeDay]: activeSuggestion.id,
    }));
  }, [activeDay, activeSuggestion]);

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

  const handleReset = useCallback(() => {
    setPlannedWeek(createEmptyCurrentPlannedWeek());
    setSuggestionIndexMap(createInitialSuggestionIndex());
    setSearchQuery("");
  }, []);

  return (
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
          onPress={handleReset}
          accessibilityRole="button"
          accessibilityLabel="Reset plan"
          style={styles.headerButton}
        >
          <MaterialCommunityIcons
            name="restart"
            size={22}
            color={theme.color.ink}
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
            dayLabel={PLANNED_WEEK_LABELS[activeDay]}
            dayDisplayName={PLANNED_WEEK_DISPLAY_NAMES[activeDay]}
            meal={activeSuggestion}
            difficulty={difficultyFilter}
            onDifficultyChange={(next) => {
              setDifficultyFilter(next);
              setSuggestionIndexMap(createInitialSuggestionIndex());
            }}
            onAdd={handleAddMeal}
            onShuffle={() => stepSuggestion(1)}
            onEat={handleAddMeal}
            onNextSuggestion={() => stepSuggestion(1)}
            onPreviousSuggestion={() => stepSuggestion(-1)}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
          />
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Planned Meals</Text>
          {orderedDays.map((day) => {
            const mealId = plannedWeek[day];
            const meal = meals.find((item) => item.id === mealId);
            return (
              <View key={day} style={styles.summaryRow}>
                <Text style={styles.summaryDay}>
                  {PLANNED_WEEK_LABELS[day]}
                </Text>
                <Text style={styles.summaryMeal} numberOfLines={1}>
                  {meal ? `${meal.emoji} ${meal.title}` : "Unplanned"}
                </Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
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
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
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
    summaryCard: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.lg,
      gap: theme.space.sm,
    },
    summaryTitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.space.md,
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
