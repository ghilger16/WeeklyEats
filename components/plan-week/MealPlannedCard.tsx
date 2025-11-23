import { StyleSheet, Text, View, Pressable } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { Meal } from "../../types/meals";

type Props = {
  meal: Meal;
  sides: string[];
  onSwap?: () => void;
};

const difficultyToThemeColor = (
  difficulty: "easy" | "medium" | "hard",
  theme: WeeklyTheme
) => {
  switch (difficulty) {
    case "easy":
      return theme.color.success;
    case "hard":
      return theme.color.danger;
    default:
      return theme.color.warning;
  }
};

const getDifficultyLabel = (value: number | undefined) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "medium";
  }
  if (value <= 2) return "easy";
  if (value >= 4) return "hard";
  return "medium";
};

const formatLastServed = (iso?: string) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `Last served: ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
};

export default function MealPlannedCard({ meal, sides, onSwap }: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const costTier = meal.expense
    ? Math.max(1, Math.min(3, Math.round(meal.expense / 2)))
    : meal.plannedCostTier ?? 1;
  const costLabel = "$".repeat(costTier);
  const difficultyKey = getDifficultyLabel(meal.difficulty);
  const difficultyText =
    difficultyKey === "easy"
      ? "Easy"
      : difficultyKey === "hard"
      ? "Hard"
      : "Medium";
  const difficultyColor = difficultyToThemeColor(difficultyKey, theme);
  const lastServed = formatLastServed(meal.updatedAt);

  return (
    <View style={styles.plannedCardWrapper}>
      <View style={styles.plannedCard}>
        {onSwap ? (
          <Pressable
            onPress={onSwap}
            accessibilityRole="button"
            accessibilityLabel="Change meal"
            style={({ pressed }) => [
              styles.plannedSwapButton,
              pressed && styles.plannedSwapButtonPressed,
            ]}
          >
            <MaterialCommunityIcons
              name="swap-horizontal"
              size={20}
              color="#FFE6C7"
            />
          </Pressable>
        ) : null}
        <View style={styles.plannedBadge}>
          <Text style={styles.plannedBadgeText}>DAY PLANNED</Text>
        </View>
        <Text style={styles.plannedEmoji}>{meal.emoji ?? "🍽️"}</Text>
        <View style={styles.plannedMetaRow}>
          <Text style={[styles.plannedMetaText, styles.plannedMetaAccent]}>
            {costLabel}
          </Text>
          <View style={styles.plannedDifficultyMeta}>
            <View
              style={[
                styles.plannedDifficultyDot,
                { backgroundColor: difficultyColor },
              ]}
            />
            <Text style={styles.plannedMetaText}>{difficultyText}</Text>
          </View>
        </View>
        {lastServed ? (
          <Text style={styles.plannedLastServed}>{lastServed}</Text>
        ) : null}
        <Text style={styles.plannedTitle}>{meal.title ?? "Meal planned"}</Text>
        {sides.length ? (
          <View style={styles.plannedSideList}>
            {sides.map((side, index) => (
              <View style={styles.plannedSideChip} key={`${side}-${index}`}>
                <Text style={styles.plannedSideText}>w/ {side}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    plannedCardWrapper: {
      width: "100%",
      position: "relative",
    },
    plannedCard: {
      borderRadius: theme.radius.xl,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      padding: theme.space.lg,
      alignItems: "center",
      gap: theme.space.sm,
    },
    plannedBadge: {
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.xs / 1.5,
      borderRadius: theme.radius.full,
      backgroundColor: "#C37D1D",
    },
    plannedBadgeText: {
      color: "#FFE6C7",
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.bold,
      letterSpacing: 1,
    },
    plannedEmoji: {
      fontSize: 72,
    },
    plannedMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
    },
    plannedMetaText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    plannedMetaAccent: {
      color: theme.color.accent,
    },
    plannedDifficultyMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs / 2,
    },
    plannedDifficultyDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.warning,
    },
    plannedLastServed: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    plannedTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    plannedSideList: {
      gap: theme.space.xs,
      alignItems: "center",
    },
    plannedSideChip: {
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.xs,
    },
    plannedSideText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    plannedSwapButton: {
      position: "absolute",
      top: theme.space.sm,
      right: theme.space.sm,
      padding: theme.space.sm,
      borderRadius: theme.radius.full,
      backgroundColor: "rgba(0,0,0,0.25)",
    },
    plannedSwapButtonPressed: {
      opacity: 0.8,
    },
  });
