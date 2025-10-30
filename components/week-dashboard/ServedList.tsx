import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Meal } from "../../types/meals";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import ServedListItem from "./ServedListItem";

export type ServedWeek = Array<{ dayLabel: string; mealId: Meal["id"] | null }>;

type Props = {
  servedWeek: ServedWeek;
  meals: Meal[];
  title?: string;
};

export default function ServedList({ servedWeek, meals, title = "Served Meals" }: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const mealsById = useMemo(() => {
    const map = new Map<string, Meal>();
    meals.forEach((meal) => map.set(meal.id, meal));
    return map;
  }, [meals]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons
              name="silverware-fork-knife"
              size={20}
              color={theme.color.accent}
            />
          </View>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <Pressable style={styles.headerButton} accessibilityRole="button">
          <MaterialCommunityIcons
            name="history"
            size={20}
            color={theme.color.subtleInk}
          />
        </Pressable>
      </View>

      <View style={styles.divider} />

      <View>
        {servedWeek.map((entry) => (
          <ServedListItem
            key={entry.dayLabel}
            dayLabel={entry.dayLabel}
            meal={entry.mealId ? mealsById.get(entry.mealId) : undefined}
          />
        ))}
      </View>

      <Pressable style={styles.footer} accessibilityRole="button">
        <Text style={styles.footerText}>View history</Text>
        <MaterialCommunityIcons
          name="chevron-right"
          size={20}
          color={theme.color.subtleInk}
        />
      </Pressable>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.lg,
      gap: theme.space.lg,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    headerButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.color.border,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.xs,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
    },
    footerText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
  });

