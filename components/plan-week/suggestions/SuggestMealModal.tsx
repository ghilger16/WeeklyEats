import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import { Meal } from "../../../types/meals";
import { MealSuggestion } from "./suggestionMatcher";
import { SuggestionBannerContext } from "./suggestionBanners";
import DayPinsControls from "../DayPinsControls";
import {
  DayPinsState,
  normalizeDayPinsState,
} from "../../../types/dayPins";

type Props = {
  visible: boolean;
  dayName: string;
  suggestion?: MealSuggestion;
  canSuggestAnother?: boolean;
  onDismiss: () => void;
  onAddMeal: (meal: Meal) => void;
  onSuggestAnother: () => void;
  sides?: string[];
  onAddSide?: (value: string) => void;
  onRemoveSide?: (index: number) => void;
  pins?: DayPinsState;
  onPinsChange?: (next: DayPinsState) => void;
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
  sides = [],
  onAddSide,
  onRemoveSide,
  pins,
  onPinsChange,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [sideInput, setSideInput] = useState("");
  const [isSideDeleteMode, setSideDeleteMode] = useState(false);
  const meal = suggestion?.meal;
  const normalizedPins = useMemo(
    () => normalizeDayPinsState(pins),
    [pins]
  );
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
  const hasSides = sides.length > 0;

  useEffect(() => {
    if (visible) {
      setSideInput("");
      setSideDeleteMode(false);
    }
  }, [meal?.id, visible]);

  useEffect(() => {
    if (!hasSides && isSideDeleteMode) {
      setSideDeleteMode(false);
    }
  }, [hasSides, isSideDeleteMode]);

  const formatSideLabel = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    return trimmed
      .split(/\s+/)
      .map(
        (segment) =>
          segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
      )
      .join(" ");
  };

  const handleSubmitSide = () => {
    if (!onAddSide) {
      return;
    }
    const formatted = formatSideLabel(sideInput);
    if (!formatted) {
      setSideInput("");
      return;
    }
    onAddSide(formatted);
    setSideInput("");
  };

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
            </View>

            {pins && onPinsChange ? (
              <DayPinsControls
                value={normalizedPins}
                onChange={onPinsChange}
                mode="editable"
              />
            ) : null}

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
                {onAddSide ? (
                  <View style={styles.sidesSection}>
                    {hasSides ? (
                      <View style={styles.sideList}>
                        {sides.map((side, index) => (
                          <Pressable
                            key={`${side}-${index}`}
                            onPress={() => {
                              if (isSideDeleteMode && onRemoveSide) {
                                onRemoveSide(index);
                              }
                            }}
                            disabled={!isSideDeleteMode}
                            accessibilityRole={
                              isSideDeleteMode ? "button" : "text"
                            }
                            accessibilityLabel={
                              isSideDeleteMode
                                ? `Remove side ${side}`
                                : `Side ${side}`
                            }
                            style={({ pressed }) => [
                              styles.sideChip,
                              isSideDeleteMode && styles.sideChipDeleteMode,
                              pressed &&
                                isSideDeleteMode &&
                                styles.sideChipPressed,
                            ]}
                          >
                            <Text style={styles.sideChipText}>w/ {side}</Text>
                          </Pressable>
                        ))}
                      </View>
                    ) : null}
                    <View style={styles.sideInputRow}>
                      <TextInput
                        value={sideInput}
                        onChangeText={setSideInput}
                        onSubmitEditing={handleSubmitSide}
                        placeholder="Add a side"
                        placeholderTextColor={theme.color.subtleInk}
                        autoCapitalize="words"
                        returnKeyType="done"
                        style={styles.sideInput}
                        accessibilityLabel="Add a side dish"
                      />
                      <Pressable
                        onPress={() => setSideDeleteMode((prev) => !prev)}
                        disabled={!hasSides}
                        accessibilityRole="button"
                        accessibilityLabel={
                          isSideDeleteMode
                            ? "Exit side delete mode"
                            : "Delete sides"
                        }
                        style={({ pressed }) => [
                          styles.sideTrashButton,
                          pressed && hasSides && styles.sideTrashButtonPressed,
                          isSideDeleteMode && styles.sideTrashButtonActive,
                          !hasSides && styles.sideTrashButtonDisabled,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={
                            isSideDeleteMode
                              ? "trash-can"
                              : "trash-can-outline"
                          }
                          size={18}
                          color={
                            !hasSides
                              ? theme.color.border
                              : isSideDeleteMode
                              ? theme.color.ink
                              : theme.color.subtleInk
                          }
                        />
                      </Pressable>
                    </View>
                  </View>
                ) : null}
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
                  meal && canSuggestAnother && styles.secondaryButtonAccent,
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
                    meal &&
                      canSuggestAnother &&
                      styles.secondaryButtonTextAccent,
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
      maxHeight: "90%",
      minHeight: "85%",
      flexShrink: 0,
      width: "100%",
    },
    body: {
      flex: 1,
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
    sidesSection: {
      alignSelf: "stretch",
      gap: theme.space.sm,
      paddingTop: theme.space.xs,
    },
    sideList: {
      gap: theme.space.xs,
    },
    sideChip: {
      borderRadius: 0,
      backgroundColor: theme.color.surface,
      paddingHorizontal: theme.space.md,
      paddingVertical: Math.max(4, theme.space.xs * 1.2),
      alignSelf: "stretch",
    },
    sideChipDeleteMode: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.danger,
    },
    sideChipPressed: {
      opacity: 0.8,
    },
    sideChipText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    sideInputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    sideInput: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth + 1,
      borderColor: theme.color.subtleInk,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.md,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      backgroundColor: theme.color.surface,
    },
    sideTrashButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
    },
    sideTrashButtonPressed: {
      opacity: 0.7,
    },
    sideTrashButtonActive: {
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.accent,
    },
    sideTrashButtonDisabled: {
      opacity: 0.5,
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
      marginTop: "auto",
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
    secondaryButtonAccent: {
      borderColor: theme.color.accent,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255, 75, 145, 0.14)"
          : "rgba(255, 75, 145, 0.08)",
    },
    secondaryButtonPressed: {
      opacity: 0.85,
    },
    secondaryButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    secondaryButtonTextAccent: {
      color: theme.color.accent,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    buttonTextDisabled: {
      color: theme.color.subtleInk,
    },
  });
