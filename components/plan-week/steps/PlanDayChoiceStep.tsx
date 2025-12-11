import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo, useState } from "react";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import { Meal } from "../../../types/meals";
import {
  CurrentPlannedWeek,
  PLANNED_WEEK_DISPLAY_NAMES,
  PlannedWeekDayKey,
} from "../../../types/weekPlan";
import usePlanDayOptionsEntrance from "../../../hooks/animation/usePlanDayOptionsEntrance";
import DaysIndicatorRow from "../header/DaysIndicatorRow";
import MealPlannedCard from "../MealPlannedCard";

export type DayWizardAction = "eat_out" | "suggest" | "search";

type Props = {
  dayKey: PlannedWeekDayKey;
  orderedDays: PlannedWeekDayKey[];
  plannedWeek: CurrentPlannedWeek;
  weekLabel: string;
  hasSeenPlannedToast?: boolean;
  onSelectOption: (action: DayWizardAction) => void;
  onSelectEatOut: () => void;
  onSearchForMeal: () => void;
  onSelectDay?: (day: PlannedWeekDayKey) => void;
  onSwapPlannedMeal?: (day: PlannedWeekDayKey) => void;
  plannedMeal?: Meal | null;
  sides?: string[];
};

const DAY_OPTION_ITEMS: Array<{
  key: DayWizardAction;
  emoji: string;
  label: string;
}> = [
  { key: "eat_out", emoji: "🍽️", label: "Plans to Eat Out" },
  { key: "suggest", emoji: "🔮", label: "Suggest a Meal" },
  { key: "search", emoji: "🔍", label: "Search for a Meal" },
];

const PlanDayChoiceStep = ({
  dayKey,
  orderedDays,
  plannedWeek,
  weekLabel,
  hasSeenPlannedToast = false,
  onSelectOption,
  onSelectEatOut,
  onSearchForMeal,
  onSelectDay,
  onSwapPlannedMeal,
  plannedMeal,
  sides = [],
}: Props) => {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { animatedStyles } = usePlanDayOptionsEntrance(DAY_OPTION_ITEMS.length);
  const dayDisplayName = PLANNED_WEEK_DISPLAY_NAMES[dayKey];
  const [isPlannedCardDismissed, setPlannedCardDismissed] = useState(false);

  useEffect(() => {
    setPlannedCardDismissed(false);
  }, [plannedMeal?.id, dayKey]);

  const showPlannedCard =
    Boolean(plannedMeal) && hasSeenPlannedToast && !isPlannedCardDismissed;
  const headingText = showPlannedCard
    ? dayDisplayName
    : `Let’s plan ${dayDisplayName}`;

  return (
    <View style={styles.wrapper}>
      <View style={styles.stepperHero}>
        <Text style={styles.stepperTitle}>{headingText}</Text>
        <Text style={styles.stepperSubtitle}>{weekLabel}</Text>
        <View style={styles.indicatorWrapper}>
          <DaysIndicatorRow
            orderedDays={orderedDays}
            activeDay={dayKey}
            plannedWeek={plannedWeek}
            size="md"
            onSelectDay={onSelectDay}
          />
        </View>
        {showPlannedCard ? (
          <MealPlannedCard
            meal={plannedMeal}
            sides={sides}
            onSwap={() => {
              setPlannedCardDismissed(true);
              onSwapPlannedMeal?.(dayKey);
            }}
          />
        ) : null}
      </View>

      {!showPlannedCard ? (
        <View style={styles.optionList}>
          {DAY_OPTION_ITEMS.map((option, index) => (
            <Animated.View
              key={option.key}
              style={[styles.optionWrapper, animatedStyles[index]]}
            >
              <Pressable
                onPress={() =>
                  option.key === "eat_out"
                    ? onSelectEatOut()
                    : option.key === "search"
                    ? onSearchForMeal()
                    : onSelectOption(option.key)
                }
                accessibilityRole="button"
                accessibilityLabel={`${option.label} for ${dayDisplayName}`}
                style={({ pressed }) => [
                  styles.optionButton,
                  pressed && styles.optionButtonPressed,
                ]}
              >
                <Text style={styles.optionEmoji}>{option.emoji}</Text>
                <Text style={styles.optionLabel}>{option.label}</Text>
              </Pressable>
            </Animated.View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

export default PlanDayChoiceStep;

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    wrapper: {
      gap: theme.space["2xl"],
    },
    stepperHero: {
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      paddingHorizontal: theme.space.xl,
      paddingVertical: theme.space["2xl"],
      gap: theme.space.md,
      alignItems: "center",
    },
    indicatorWrapper: {
      marginBottom: theme.space.lg,
    },
    stepperTitle: {
      fontSize: theme.type.size.h1,
      fontWeight: theme.type.weight.bold,
      color: theme.color.ink,
    },
    stepperSubtitle: {
      fontSize: theme.type.size.base,
      color: theme.color.subtleInk,
    },
    optionList: {
      gap: theme.space.md,
    },
    optionWrapper: {
      width: "100%",
    },
    optionButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
      paddingVertical: theme.space.lg,
      paddingHorizontal: theme.space.lg,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
    },
    optionButtonPressed: {
      opacity: 0.9,
    },
    optionEmoji: {
      fontSize: 24,
    },
    optionLabel: {
      flex: 1,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
      color: theme.color.ink,
    },
  });
