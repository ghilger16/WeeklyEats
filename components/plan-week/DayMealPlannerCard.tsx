import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useMemo } from "react";
import { Meal } from "../../types/meals";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";

type DifficultyKey = "easy" | "medium" | "hard";

type Props = {
  dayLabel: string;
  dayDisplayName: string;
  meal?: Meal;
  difficulty: DifficultyKey;
  onDifficultyChange: (difficulty: DifficultyKey) => void;
  onAdd: () => void;
  onShuffle: () => void;
  onEat: () => void;
  onNextSuggestion: () => void;
  onPreviousSuggestion: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
};

const difficultyOptions: DifficultyKey[] = ["easy", "medium", "hard"];

const difficultyToLabel: Record<DifficultyKey, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const getDifficultyLabel = (value: number | undefined): DifficultyKey => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "medium";
  }
  if (value <= 2) return "easy";
  if (value >= 4) return "hard";
  return "medium";
};

const formatLastServed = (iso?: string) => {
  if (!iso) return "Never served";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Never served";
  }
  return `Last served: ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
};

export default function DayMealPlannerCard({
  dayLabel,
  dayDisplayName,
  meal,
  difficulty,
  onDifficultyChange,
  onAdd,
  onShuffle,
  onEat,
  onNextSuggestion,
  onPreviousSuggestion,
  searchQuery,
  onSearchQueryChange,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > Math.abs(gesture.dy) && Math.abs(gesture.dx) > 12,
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > 40) {
            onPreviousSuggestion();
          } else if (gesture.dx < -40) {
            onNextSuggestion();
          }
        },
      }),
    [onNextSuggestion, onPreviousSuggestion]
  );

  const mealDifficulty = meal ? getDifficultyLabel(meal.difficulty) : null;
  const ratingLabel = meal && meal.rating ? meal.rating.toFixed(1) : "--";
  const costTier = meal?.expense
    ? Math.max(1, Math.min(3, Math.round(meal.expense / 2)))
    : meal?.plannedCostTier ?? 1;
  const costLabel = meal ? "$".repeat(costTier) : "--";

  return (
    <View style={styles.container}>
      <View style={styles.dayTabs}>
        <Text style={styles.dayTabActive}>{dayLabel}</Text>
      </View>

      <Text style={styles.dayTitle}>{dayDisplayName}</Text>

      <View style={styles.difficultyRow}>
        {difficultyOptions.map((option) => (
          <Pressable
            key={option}
            onPress={() => onDifficultyChange(option)}
            style={[
              styles.difficultyChip,
              difficulty === option && styles.difficultyChipActive,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Show ${option} meals`}
          >
            <Text
              style={[
                styles.difficultyChipText,
                difficulty === option && styles.difficultyChipTextActive,
              ]}
            >
              {difficultyToLabel[option]}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchRow}>
        <MaterialCommunityIcons
          name="magnify"
          size={20}
          color={theme.color.subtleInk}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search meals"
          placeholderTextColor={theme.color.subtleInk}
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          returnKeyType="search"
          accessibilityLabel="Search meals"
        />
      </View>

      <View style={styles.mealCard} {...panResponder.panHandlers}>
        <View style={styles.mealHero}>
          <Text style={styles.mealEmoji}>{meal?.emoji ?? "🍽️"}</Text>
        </View>
        <View style={styles.mealContent}>
          <Text style={styles.mealTitle} numberOfLines={1}>
            {meal?.title ?? "No suggestion"}
          </Text>
          <Text style={styles.mealSubtitle} numberOfLines={2}>
            {meal
              ? "Suggested meal from your collection"
              : "Use search or shuffle to pick a meal"}
          </Text>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons
                name="star"
                size={16}
                color={theme.color.accent}
              />
              <Text style={styles.metaText}>{ratingLabel}</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons
                name="currency-usd"
                size={16}
                color={theme.color.success}
              />
              <Text style={styles.metaText}>{costLabel}</Text>
            </View>
            <View style={styles.metaItem}>
              <MaterialCommunityIcons
                name="circle"
                size={14}
                color={theme.color[difficultyToThemeColor(mealDifficulty ?? "medium")]}
              />
              <Text style={styles.metaText}>{mealDifficulty ? difficultyToLabel[mealDifficulty] : "--"}</Text>
            </View>
          </View>

          <Text style={styles.lastServed}>{formatLastServed(meal?.updatedAt)}</Text>
        </View>
      </View>

      <View style={styles.actionRow}>
        <PlannerActionButton
          icon="check"
          label="Add"
          onPress={onAdd}
          disabled={!meal}
          styles={styles}
        />
        <PlannerActionButton
          icon="shuffle"
          label="Shuffle"
          onPress={onShuffle}
          disabled={!meal}
          styles={styles}
        />
        <PlannerActionButton
          icon="silverware-fork-knife"
          label="Eat"
          onPress={onEat}
          disabled={!meal}
          styles={styles}
        />
      </View>
    </View>
  );
}

type PlannerActionButtonProps = {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  styles: ReturnType<typeof createStyles>;
};

const PlannerActionButton = ({ icon, label, onPress, disabled, styles }: PlannerActionButtonProps) => {
  const { theme } = useThemeController();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.actionButton,
        disabled && styles.actionButtonDisabled,
        pressed && !disabled && styles.actionButtonPressed,
      ]}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={18}
        color={disabled ? theme.color.subtleInk : theme.color.ink}
      />
      <Text
        style={[styles.actionButtonText, disabled && styles.actionButtonTextDisabled]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const difficultyToThemeColor = (difficulty: DifficultyKey) => {
  switch (difficulty) {
    case "easy":
      return "success" as const;
    case "hard":
      return "danger" as const;
    default:
      return "warning" as const;
  }
};

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    container: {
      gap: theme.space.xl,
    },
    dayTabs: {
      flexDirection: "row",
      justifyContent: "center",
      gap: theme.space.sm,
    },
    dayTabActive: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      letterSpacing: 3,
    },
    dayTitle: {
      textAlign: "center",
      color: theme.color.ink,
      fontSize: theme.type.size.h1,
      fontWeight: theme.type.weight.bold,
    },
    difficultyRow: {
      flexDirection: "row",
      justifyContent: "center",
      gap: theme.space.sm,
    },
    difficultyChip: {
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.xs,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
    },
    difficultyChipActive: {
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.accent,
    },
    difficultyChipText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    difficultyChipTextActive: {
      color: theme.color.accent,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
    },
    searchInput: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    mealCard: {
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      overflow: "hidden",
    },
    mealHero: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.space.xl,
      backgroundColor: theme.color.surfaceAlt,
    },
    mealEmoji: {
      fontSize: 64,
    },
    mealContent: {
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.lg,
      gap: theme.space.sm,
    },
    mealTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    mealSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
    },
    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
    },
    metaText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    lastServed: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.space.sm,
    },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      paddingVertical: theme.space.sm,
    },
    actionButtonDisabled: {
      opacity: 0.5,
    },
    actionButtonPressed: {
      opacity: 0.85,
    },
    actionButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    actionButtonTextDisabled: {
      color: theme.color.subtleInk,
    },
  });
