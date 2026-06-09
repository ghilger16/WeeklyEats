import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import {
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { Meal } from "../../types/meals";
import { isEatOutMealId, isFlexNightMealId } from "../../types/specialMeals";

type Props = {
  visible: boolean;
  dayName: string;
  meal?: Meal | null;
  sides?: string[];
  lastServedISO?: string | null;
  onDismiss: () => void;
  onChangePlan: () => void;
  onRemovePlan: () => void;
  showRemoveAction?: boolean;
  changeActionLabel?: string;
  removeActionLabel?: string;
};

const formatLastServed = (iso?: string) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
};

const getDifficultyLabel = (value?: number) => {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  if (value <= 2) return "Easy";
  if (value >= 4) return "Hard";
  return "Medium";
};

const getDifficultyColor = (value: number | undefined, theme: WeeklyTheme) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return theme.color.warning;
  }
  if (value <= 2) return theme.color.success;
  if (value >= 4) return theme.color.danger;
  return theme.color.warning;
};

const getExpenseLabel = (meal?: Meal | null) => {
  if (!meal) return null;
  if (typeof meal.expense === "number" && !Number.isNaN(meal.expense)) {
    const tier = Math.max(1, Math.min(3, Math.round(meal.expense / 2)));
    return "$".repeat(tier);
  }
  return "$".repeat(meal.plannedCostTier ?? 1);
};

export default function PlannedDayEditModal({
  visible,
  dayName,
  meal,
  sides = [],
  lastServedISO,
  onDismiss,
  onChangePlan,
  onRemovePlan,
  showRemoveAction = true,
  changeActionLabel,
  removeActionLabel,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isEatOut = isEatOutMealId(meal?.id);
  const isFlexNight = isFlexNightMealId(meal?.id);
  const isSpecialPlan = isEatOut || isFlexNight;
  const title = `${dayName} Plan`;
  const displayTitle = isEatOut
    ? meal?.title ?? "Eat Out"
    : isFlexNight
      ? "Flex Night"
      : meal?.title;
  const actionLabel =
    changeActionLabel ?? (isSpecialPlan ? "Change Plan" : "Swap Meal");
  const removeLabel =
    removeActionLabel ?? (isSpecialPlan ? "Remove Plan" : "Remove Meal");
  const difficultyLabel = getDifficultyLabel(meal?.difficulty);
  const difficultyColor = getDifficultyColor(meal?.difficulty, theme);
  const expenseLabel = getExpenseLabel(meal);
  const lastServed = formatLastServed(lastServedISO ?? undefined);
  const ratingLabel =
    meal && typeof meal.rating === "number" && meal.rating > 0
      ? `${meal.rating.toFixed(1)} family rating`
      : null;

  const helperText = isEatOut
    ? `${dayName} is currently marked as eating out.`
    : isFlexNight
      ? `${dayName} is intentionally flexible for leftovers, freezer meals, or whatever is already in the house.`
      : null;
  const canOpenRecipe = Boolean(meal?.recipeUrl && !isSpecialPlan);

  const handleOpenRecipe = () => {
    if (!meal?.recipeUrl || isSpecialPlan) {
      return;
    }
    Linking.openURL(meal.recipeUrl).catch(() => {
      // Ignore invalid or unavailable recipe URLs for now.
    });
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
          <View style={styles.header}>
            <View style={styles.headerSpacer} />
            <Text style={styles.title}>{title}</Text>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Close planned day details"
              style={({ pressed }) => [
                styles.iconButton,
                pressed && styles.iconButtonPressed,
              ]}
            >
              <MaterialCommunityIcons
                name="close"
                size={20}
                color={theme.color.ink}
              />
            </Pressable>
          </View>

          {meal ? (
            <Pressable
              onPress={canOpenRecipe ? handleOpenRecipe : undefined}
              accessibilityRole={canOpenRecipe ? "button" : "text"}
              accessibilityLabel={
                canOpenRecipe
                  ? `Open recipe for ${meal.title}`
                  : `${displayTitle} details`
              }
              style={({ pressed }) => [
                styles.card,
                pressed && canOpenRecipe && styles.cardPressed,
              ]}
            >
              {canOpenRecipe ? (
                <View style={styles.recipeTag}>
                  <Text style={styles.recipeTagText}>Recipe</Text>
                </View>
              ) : null}
              <Text style={styles.emoji}>
                {isFlexNight ? "🔄" : (meal.emoji ?? "🍽️")}
              </Text>
              <Text style={styles.mealTitle}>{displayTitle}</Text>
              {helperText ? (
                <Text style={styles.helperText}>{helperText}</Text>
              ) : null}

              {!isSpecialPlan ? (
                <>
                  <View style={styles.metaWrap}>
                    {difficultyLabel ? (
                      <View style={styles.metaPill}>
                        <View
                          style={[
                            styles.difficultyDot,
                            { backgroundColor: difficultyColor },
                          ]}
                        />
                        <Text style={styles.metaText}>{difficultyLabel}</Text>
                      </View>
                    ) : null}
                    {expenseLabel ? (
                      <View style={styles.metaPill}>
                        <Text style={styles.expenseText}>{expenseLabel}</Text>
                        <Text style={styles.metaSubtle}>Expense</Text>
                      </View>
                    ) : null}
                    {ratingLabel ? (
                      <View style={styles.metaPill}>
                        <Text style={styles.starText}>★</Text>
                        <Text style={styles.metaText}>{ratingLabel}</Text>
                      </View>
                    ) : null}
                  </View>

                  {lastServed ? (
                    <Text style={styles.detailText}>
                      Last served {lastServed}
                    </Text>
                  ) : null}
                  {sides.length ? (
                    <View style={styles.sides}>
                      {sides.map((side, index) => (
                        <Text key={`${side}-${index}`} style={styles.sideChip}>
                          w/ {side}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {meal.prepNotes ? (
                    <Text style={styles.detailText}>{meal.prepNotes}</Text>
                  ) : null}
                </>
              ) : null}
            </Pressable>
          ) : null}

          <View style={styles.actions}>
            <Pressable
              onPress={onChangePlan}
              accessibilityRole="button"
              accessibilityLabel={`${actionLabel} for ${dayName}`}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>{actionLabel}</Text>
            </Pressable>
            {showRemoveAction ? (
              <Pressable
                onPress={onRemovePlan}
                accessibilityRole="button"
                accessibilityLabel={`${removeLabel} for ${dayName}`}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.secondaryButtonPressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>{removeLabel}</Text>
              </Pressable>
            ) : null}
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
      paddingTop: theme.space.xl,
      paddingBottom: theme.space.xl,
      gap: theme.space.lg,
      width: "100%",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    headerSpacer: {
      width: 40,
      height: 40,
    },
    title: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    iconButtonPressed: {
      opacity: 0.82,
    },
    card: {
      position: "relative",
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      padding: theme.space.lg,
      gap: theme.space.md,
      alignItems: "center",
    },
    cardPressed: {
      opacity: 0.9,
    },
    recipeTag: {
      position: "absolute",
      top: theme.space.md,
      right: theme.space.md,
      paddingHorizontal: theme.space.sm,
      paddingVertical: theme.space.xs,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surface,
    },
    recipeTagText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    emoji: {
      fontSize: 44,
    },
    mealTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    helperText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      lineHeight: theme.type.size.base * 1.35,
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
    metaText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: "800",
    },
    difficultyDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radius.full,
    },
    expenseText: {
      color: theme.color.success,
      fontSize: theme.type.size.sm,
      fontWeight: "800",
    },
    metaSubtle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: "800",
    },
    starText: {
      color: theme.color.warning,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    detailText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      lineHeight: theme.type.size.sm * 1.35,
      textAlign: "center",
    },
    sides: {
      alignSelf: "stretch",
      gap: theme.space.xs,
    },
    sideChip: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
      backgroundColor: theme.color.surface,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.xs,
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
      color: theme.color.accent,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
  });
