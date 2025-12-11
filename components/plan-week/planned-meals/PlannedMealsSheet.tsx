import {
  Animated,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMemo } from "react";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import {
  CurrentPlannedWeek,
  PlannedWeekDayKey,
  PLANNED_WEEK_LABELS,
  PLANNED_WEEK_DISPLAY_NAMES,
} from "../../../types/weekPlan";
import { Meal } from "../../../types/meals";
import PlannedMealRow from "./PlannedMealRow";
import { EAT_OUT_MEAL, EAT_OUT_MEAL_ID } from "../../../types/specialMeals";

type PlannerSelection = {
  day: PlannedWeekDayKey | null;
  meal: Meal | null;
};

type Props = {
  orderedDays: PlannedWeekDayKey[];
  plannedWeek: CurrentPlannedWeek;
  meals: Meal[];
  daySidesMap: Record<PlannedWeekDayKey, string[]>;
  plannerSelection: PlannerSelection;
  savedIndicatorDay: PlannedWeekDayKey | null;
  summaryTranslateY: Animated.Value;
  summaryPanHandlers: any;
  onSelectPlannerDay: (day: PlannedWeekDayKey) => void;
  onSaveSelection: () => void;
  isPlannerSaving: boolean;
  registerRowRef?: (day: PlannedWeekDayKey, ref: View | null) => void;
};

const PlannedMealsSheet = ({
  orderedDays,
  plannedWeek,
  meals,
  daySidesMap,
  plannerSelection,
  savedIndicatorDay,
  summaryTranslateY,
  summaryPanHandlers,
  onSelectPlannerDay,
  onSaveSelection,
  isPlannerSaving,
  registerRowRef,
}: Props) => {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const rows = orderedDays.map((day) => {
    const mealId = plannedWeek[day];
    const plannedMeal = mealId
      ? mealId === EAT_OUT_MEAL_ID
        ? EAT_OUT_MEAL
        : meals.find((item) => item.id === mealId) ?? null
      : null;
    return {
      day,
      plannedMeal,
      sides: daySidesMap[day] ?? [],
    };
  });

  const hasSelection = plannerSelection.day && plannerSelection.meal;

  return (
    <Animated.View
      style={[styles.summarySheet, { transform: [{ translateY: summaryTranslateY }] }]}
      {...summaryPanHandlers}
    >
      <SafeAreaView edges={["bottom"]} style={styles.summarySheetSafeArea}>
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
          {rows.map(({ day, plannedMeal, sides }) => (
            <PlannedMealRow
              key={day}
              day={day}
              dayLabel={PLANNED_WEEK_LABELS[day]}
              displayName={PLANNED_WEEK_DISPLAY_NAMES[day]}
              plannedMeal={plannedMeal}
              selectedMeal={plannerSelection.meal ?? undefined}
              sides={sides}
              isSelected={plannerSelection.day === day}
              isSaved={savedIndicatorDay === day}
              canSelect={Boolean(plannerSelection.meal)}
              onPress={() => onSelectPlannerDay(day)}
              registerRef={(ref) => registerRowRef?.(day, ref)}
            />
          ))}
        </View>
        {hasSelection ? (
          <View style={styles.summaryPrimaryButtonWrapper}>
            <PressableButton
              label={`Save to ${
                plannerSelection.day
                  ? PLANNED_WEEK_DISPLAY_NAMES[plannerSelection.day]
                  : ""
              }`}
              onPress={onSaveSelection}
              loading={isPlannerSaving}
              theme={theme}
            />
          </View>
        ) : null}
      </SafeAreaView>
    </Animated.View>
  );
};

export default PlannedMealsSheet;

const PressableButton = ({
  label,
  onPress,
  loading,
  theme,
}: {
  label: string;
  onPress: () => void;
  loading: boolean;
  theme: WeeklyTheme;
}) => (
  <Pressable
    onPress={onPress}
    disabled={loading}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={({ pressed }) => [
      stylesForTheme(theme).summaryPrimaryButton,
      pressed && !loading && stylesForTheme(theme).summaryPrimaryButtonPressed,
      loading && stylesForTheme(theme).summaryPrimaryButtonDisabled,
    ]}
  >
    {loading ? (
      <ActivityIndicator color={theme.color.ink} />
    ) : (
      <Text style={stylesForTheme(theme).summaryPrimaryButtonText}>{label}</Text>
    )}
  </Pressable>
);

const stylesForTheme = (() => {
  const cache = new WeakMap<WeeklyTheme, ReturnType<typeof createButtonStyles>>();
  return (theme: WeeklyTheme) => {
    if (!cache.has(theme)) {
      cache.set(theme, createButtonStyles(theme));
    }
    return cache.get(theme)!;
  };
})();

const createButtonStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
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
  });

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
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
    summaryPrimaryButtonWrapper: {
      paddingTop: theme.space.md,
    },
  });
