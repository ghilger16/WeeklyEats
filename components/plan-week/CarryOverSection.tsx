import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { Meal } from "../../types/meals";
import {
  CurrentPlannedWeek,
  PLANNED_WEEK_LABELS,
  PlannedWeekDayKey,
} from "../../types/weekPlan";

type Props = {
  meals: Meal[];
  orderedDays: PlannedWeekDayKey[];
  plannedWeek: CurrentPlannedWeek;
  selectedMealId: string | null;
  onSelectMeal: (meal: Meal) => void;
  onSelectDay: (day: PlannedWeekDayKey) => void;
};

export default function CarryOverSection({
  meals,
  orderedDays,
  plannedWeek,
  selectedMealId,
  onSelectMeal,
  onSelectDay,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const selectedMeal = meals.find((meal) => meal.id === selectedMealId);

  if (!meals.length) {
    return null;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>Carried Over</Text>
          <MaterialCommunityIcons
            name="information-outline"
            size={18}
            color={theme.color.subtleInk}
          />
        </View>
        <Text style={styles.subtitle}>Meals you postponed from last week.</Text>
      </View>

      <View style={styles.mealList}>
        {meals.map((meal) => {
          const isSelected = meal.id === selectedMealId;
          return (
            <Pressable
              key={meal.id}
              accessibilityRole="button"
              accessibilityLabel={`Plan carried over meal ${meal.title}`}
              onPress={() => onSelectMeal(meal)}
              style={({ pressed }) => [
                styles.mealRow,
                isSelected && styles.mealRowSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.emoji}>{meal.emoji ?? "🍽️"}</Text>
              <Text style={styles.mealTitle} numberOfLines={1}>
                {meal.title}
              </Text>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>Carried Over</Text>
              </View>
              <MaterialCommunityIcons
                name={isSelected ? "chevron-down" : "chevron-right"}
                size={24}
                color={theme.color.subtleInk}
              />
            </Pressable>
          );
        })}
      </View>

      {selectedMeal ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.dayList}
        >
          {orderedDays.map((day) => {
            const isPlanned = Boolean(plannedWeek[day]);
            return (
              <Pressable
                key={day}
                disabled={isPlanned}
                accessibilityRole="button"
                accessibilityLabel={`Plan ${selectedMeal.title} for ${day}`}
                onPress={() => onSelectDay(day)}
                style={({ pressed }) => [
                  styles.dayChip,
                  isPlanned && styles.dayChipDisabled,
                  pressed && !isPlanned && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    isPlanned && styles.dayTextDisabled,
                  ]}
                >
                  {PLANNED_WEEK_LABELS[day]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    card: {
      gap: theme.space.md,
      padding: theme.space.lg,
      borderRadius: theme.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.accent,
      backgroundColor: theme.color.surface,
    },
    header: { gap: 2 },
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
    },
    title: {
      color: theme.color.accent,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    subtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    mealList: { gap: theme.space.xs },
    mealRow: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      paddingHorizontal: theme.space.md,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
    },
    mealRowSelected: { borderColor: theme.color.accent },
    emoji: { fontSize: 22 },
    mealTitle: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    badge: {
      paddingHorizontal: theme.space.sm,
      paddingVertical: 5,
      borderRadius: theme.radius.full,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255, 75, 145, 0.10)"
          : "rgba(255, 75, 145, 0.08)",
    },
    badgeText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.bold,
    },
    dayList: { gap: theme.space.sm },
    dayChip: {
      minWidth: 54,
      minHeight: 42,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.color.accent,
      backgroundColor: theme.color.bg,
    },
    dayChipDisabled: { borderColor: theme.color.border, opacity: 0.55 },
    dayText: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    dayTextDisabled: { color: theme.color.subtleInk },
    pressed: { opacity: 0.75 },
  });
