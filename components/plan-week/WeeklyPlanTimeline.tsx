import { View, Text, StyleSheet, Animated } from "react-native";
import { useEffect, useMemo } from "react";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import {
  CurrentPlannedWeek,
  PlannedWeekDayKey,
  PLANNED_WEEK_LABELS,
} from "../../types/weekPlan";
import { Meal } from "../../types/meals";
import { EAT_OUT_MEAL, EAT_OUT_MEAL_ID } from "../../types/specialMeals";

type WeeklyPlanTimelineProps = {
  orderedDays: PlannedWeekDayKey[];
  plannedWeek: CurrentPlannedWeek;
  meals: Meal[];
  daySidesMap: Record<PlannedWeekDayKey, string[]>;
};

const WeeklyPlanTimeline = ({
  orderedDays,
  plannedWeek,
  meals,
  daySidesMap,
}: WeeklyPlanTimelineProps) => {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const rows = orderedDays.map((day) => {
    const mealId = plannedWeek[day];
    const plannedMeal = mealId
      ? mealId === EAT_OUT_MEAL_ID
        ? EAT_OUT_MEAL
        : meals.find((candidate) => candidate.id === mealId) ?? null
      : null;
    const sides = daySidesMap[day] ?? [];
    return {
      day,
      meal: plannedMeal,
      sides,
    };
  });

  const animatedEntries = useMemo(
    () =>
      orderedDays.map(() => ({
        translateY: new Animated.Value(20),
        opacity: new Animated.Value(0),
      })),
    [orderedDays]
  );

  useEffect(() => {
    animatedEntries.forEach((entry, index) => {
      entry.translateY.setValue(20);
      entry.opacity.setValue(0);
      Animated.parallel([
        Animated.timing(entry.translateY, {
          toValue: 0,
          duration: 420,
          delay: index * 220,
          useNativeDriver: true,
        }),
        Animated.timing(entry.opacity, {
          toValue: 1,
          duration: 420,
          delay: index * 220,
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [animatedEntries, plannedWeek]);

  return (
    <View style={styles.timelineContainer}>
      {rows.map(({ day, meal, sides }, index) => {
        const isFirst = index === 0;
        const isLast = index === rows.length - 1;
        const hasMeal = Boolean(meal);
        const emoji = meal?.emoji ?? "🍽️";
        const title = meal?.title ?? "Unplanned";
        const sidesLabel = sides.length
          ? `w/ ${sides.join(" • ")}`
          : null;

        return (
          <Animated.View
            key={day}
            style={[
              styles.timelineRow,
              {
                opacity: animatedEntries[index]?.opacity ?? 1,
                transform: [
                  {
                    translateY:
                      animatedEntries[index]?.translateY ?? 0,
                  },
                ],
              },
            ]}
          >
            <View style={styles.timelineRail}>
              <View
                style={[
                  styles.timelineConnector,
                  isFirst && styles.timelineConnectorHidden,
                ]}
              />
              <View
                style={[
                  styles.timelineNode,
                  hasMeal && styles.timelineNodeFilled,
                ]}
              />
              <View
                style={[
                  styles.timelineConnector,
                  isLast && styles.timelineConnectorHidden,
                ]}
              />
            </View>
            <View style={styles.timelineContent}>
              <Text style={styles.timelineDayLabel}>
                {PLANNED_WEEK_LABELS[day]}
              </Text>
              <Text style={styles.timelineMealTitle} numberOfLines={1}>
                {`${emoji} ${title}`}
              </Text>
              {sidesLabel ? (
                <Text style={styles.timelineSides} numberOfLines={1}>
                  {sidesLabel}
                </Text>
              ) : null}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
};

export default WeeklyPlanTimeline;

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    timelineContainer: {
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      padding: theme.space.lg,
      gap: theme.space.lg,
    },
    timelineRow: {
      flexDirection: "row",
      gap: theme.space.md,
    },
    timelineRail: {
      width: 32,
      alignItems: "center",
    },
    timelineConnector: {
      width: 2,
      flex: 1,
      backgroundColor: theme.color.cardOutline,
    },
    timelineConnectorHidden: {
      opacity: 0,
    },
    timelineNode: {
      width: 16,
      height: 16,
      borderRadius: theme.radius.full,
      borderWidth: 2,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
    },
    timelineNodeFilled: {
      borderColor: theme.color.accent,
      backgroundColor: theme.color.accent,
    },
    timelineContent: {
      flex: 1,
      gap: theme.space.xs,
    },
    timelineDayLabel: {
      fontSize: theme.type.size.xs,
      color: theme.color.subtleInk,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    timelineMealTitle: {
      fontSize: theme.type.size.base,
      color: theme.color.ink,
      fontWeight: theme.type.weight.medium,
    },
    timelineSides: {
      fontSize: theme.type.size.sm,
      color: theme.color.subtleInk,
    },
  });
