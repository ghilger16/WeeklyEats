import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import { Meal } from "../../../types/meals";
import { MealSuggestion } from "./suggestionMatcher";
import { SuggestionBannerContext } from "./suggestionBanners";

type Props = {
  visible: boolean;
  dayName: string;
  suggestion?: MealSuggestion;
  canSuggestAnother?: boolean;
  onDismiss: () => void;
  onAddMeal: (meal: Meal) => void;
  onSuggestAnother: () => void;
};

type DifficultyKey = "easy" | "medium" | "hard";

const getDifficultyKey = (value?: number): DifficultyKey => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "medium";
  }
  if (value <= 2) return "easy";
  if (value >= 4) return "hard";
  return "medium";
};

const getDifficultyLabel = (value?: number) => {
  const key = getDifficultyKey(value);
  return key === "easy" ? "Easy" : key === "hard" ? "Hard" : "Medium";
};

const getDifficultyColor = (key: DifficultyKey, theme: WeeklyTheme) => {
  switch (key) {
    case "easy":
      return theme.color.success;
    case "hard":
      return theme.color.danger;
    default:
      return theme.color.warning;
  }
};

const getExpenseTier = (meal: Meal) => {
  if (typeof meal.expense === "number" && !Number.isNaN(meal.expense)) {
    return Math.max(1, Math.min(3, Math.round(meal.expense / 2)));
  }
  return meal.plannedCostTier ?? 1;
};

const formatLastServed = (iso?: string) => {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return `Last served ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
};

const reasonByContext: Record<SuggestionBannerContext, string> = {
  difficulty: "Matches your Difficulty pin.",
  freezer: "Matches your Freezer Night pin.",
  favorite: "Matches your Family Favorite pin.",
  reuse: "Fits your reuse timing.",
  general: "Fits this planning slot.",
};

export default function SuggestMealModal({
  visible,
  dayName,
  suggestion,
  canSuggestAnother = true,
  onDismiss,
  onAddMeal,
  onSuggestAnother,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const meal = suggestion?.meal;
  const difficultyKey = getDifficultyKey(meal?.difficulty);
  const difficultyLabel = getDifficultyLabel(meal?.difficulty);
  const difficultyColor = getDifficultyColor(difficultyKey, theme);
  const costLabel = meal ? "$".repeat(getExpenseTier(meal)) : "$";
  const ratingLabel =
    meal && typeof meal.rating === "number" && meal.rating > 0
      ? `${meal.rating.toFixed(1)} family rating`
      : null;
  const lastServed = formatLastServed(meal?.updatedAt);
  const reason = suggestion
    ? reasonByContext[suggestion.context] ?? reasonByContext.general
    : "Add more meals to get better suggestions.";

  return (
    <Modal
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      visible={visible}
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPad} onPress={onDismiss} />
        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <View style={styles.body}>
            <View style={styles.header}>
              <Text style={styles.title}>{dayName} Suggestion</Text>
              <Text style={styles.subtitle}>A quick pick for this day.</Text>
            </View>

            {meal ? (
              <View style={styles.card}>
                <Text style={styles.emoji}>{meal.emoji ?? "🍽️"}</Text>
                <Text style={styles.mealTitle} numberOfLines={2}>
                  {meal.title}
                </Text>

                <View style={styles.metaWrap}>
                  <View style={styles.metaPill}>
                    <View
                      style={[
                        styles.difficultyDot,
                        { backgroundColor: difficultyColor },
                      ]}
                    />
                    <Text style={styles.metaText}>{difficultyLabel}</Text>
                  </View>
                  <View style={styles.metaPill}>
                    <Text style={styles.expenseText}>{costLabel}</Text>
                    <Text style={styles.metaText}>Expense</Text>
                  </View>
                  {ratingLabel ? (
                    <View style={styles.metaPill}>
                      <Text style={styles.starText}>★</Text>
                      <Text style={styles.metaText}>{ratingLabel}</Text>
                    </View>
                  ) : null}
                </View>

                {lastServed ? (
                  <Text style={styles.lastServed}>{lastServed}</Text>
                ) : null}
                <Text style={styles.reason}>{reason}</Text>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <MaterialCommunityIcons
                  name="silverware-fork-knife"
                  size={28}
                  color={theme.color.subtleInk}
                />
                <Text style={styles.emptyTitle}>No suggestion yet</Text>
                <Text style={styles.emptySubtitle}>
                  Add a few saved meals first, then Weekly Eats can suggest one.
                </Text>
              </View>
            )}

            <View style={styles.actions}>
              <Pressable
                onPress={() => meal && onAddMeal(meal)}
                disabled={!meal}
                accessibilityRole="button"
                accessibilityLabel={`Add suggested meal to ${dayName}`}
                style={({ pressed }) => [
                  styles.primaryButton,
                  !meal && styles.buttonDisabled,
                  pressed && meal && styles.primaryButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    !meal && styles.buttonTextDisabled,
                  ]}
                >
                  Add Meal
                </Text>
              </Pressable>
              <Pressable
                onPress={onSuggestAnother}
                disabled={!meal || !canSuggestAnother}
                accessibilityRole="button"
                accessibilityLabel="Suggest another meal"
                style={({ pressed }) => [
                  styles.secondaryButton,
                  (!meal || !canSuggestAnother) && styles.buttonDisabled,
                  pressed &&
                    meal &&
                    canSuggestAnother &&
                    styles.secondaryButtonPressed,
                ]}
              >
                <Text
                  style={[
                    styles.secondaryButtonText,
                    (!meal || !canSuggestAnother) && styles.buttonTextDisabled,
                  ]}
                >
                  Suggest Another
                </Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.35)",
      justifyContent: "flex-end",
    },
    backdropPad: {
      flex: 1,
    },
    sheet: {
      backgroundColor: theme.color.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      paddingHorizontal: theme.space.xl,
      paddingVertical: theme.space.xl,
      width: "100%",
    },
    body: {
      gap: theme.space.lg,
    },
    header: {
      gap: theme.space.xs / 2,
      alignItems: "center",
    },
    title: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    subtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
    },
    card: {
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      padding: theme.space.lg,
      gap: theme.space.md,
      alignItems: "center",
    },
    emoji: {
      fontSize: 52,
    },
    mealTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    metaWrap: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "center",
      gap: theme.space.sm,
    },
    metaPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.xs,
    },
    difficultyDot: {
      width: 9,
      height: 9,
      borderRadius: theme.radius.full,
    },
    metaText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    expenseText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    starText: {
      color: theme.color.warning,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    lastServed: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
    },
    reason: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
      textAlign: "center",
    },
    emptyCard: {
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      padding: theme.space.xl,
      gap: theme.space.sm,
      alignItems: "center",
    },
    emptyTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    emptySubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
    },
    actions: {
      gap: theme.space.sm,
    },
    primaryButton: {
      minHeight: 52,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.accent,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.space.lg,
    },
    primaryButtonPressed: {
      opacity: 0.88,
    },
    primaryButtonText: {
      color: "#FFFFFF",
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    secondaryButton: {
      minHeight: 52,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.space.lg,
    },
    secondaryButtonPressed: {
      opacity: 0.85,
    },
    secondaryButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonTextDisabled: {
      color: theme.color.subtleInk,
    },
  });
