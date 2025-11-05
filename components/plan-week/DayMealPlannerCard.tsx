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
import { FlexGrid } from "../../styles/flex-grid";

type DifficultyKey = "easy" | "medium" | "hard";
type ExpenseFilterKey = "cheap" | "medium" | "expensive";

type Props = {
  dayLabel: string;
  dayDisplayName: string;
  meal?: Meal;
  activeDifficultyFilters: DifficultyKey[];
  onAdvanceDifficultyFilter: () => void;
  activeExpenseFilters: ExpenseFilterKey[];
  onAdvanceExpenseFilter: () => void;
  onAdd: () => void;
  onShuffle: () => void;
  onEat: () => void;
  onNextSuggestion: () => void;
  onPreviousSuggestion: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
};

const difficultyToLabel: Record<DifficultyKey, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const expenseFilterLabels: Record<ExpenseFilterKey, string> = {
  cheap: "$",
  medium: "$$",
  expensive: "$$$",
};

const expenseFilterColors: Record<
  ExpenseFilterKey,
  "success" | "warning" | "danger"
> = {
  cheap: "success",
  medium: "warning",
  expensive: "danger",
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
  activeDifficultyFilters,
  onAdvanceDifficultyFilter,
  activeExpenseFilters,
  onAdvanceExpenseFilter,
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
          Math.abs(gesture.dx) > Math.abs(gesture.dy) &&
          Math.abs(gesture.dx) > 12,
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
  const difficultyBadgeActive = activeDifficultyFilters.length > 0;
  const difficultyBadgeDots = difficultyBadgeActive
    ? activeDifficultyFilters.map((filter: DifficultyKey) => ({
        key: filter,
        color: theme.color[difficultyToThemeColor(filter)],
        label: difficultyToLabel[filter],
      }))
    : null;
  const expenseBadgeActive = activeExpenseFilters.length > 0;
  const expenseBadgeItems = expenseBadgeActive
    ? activeExpenseFilters.map((filter: ExpenseFilterKey) => ({
        key: filter,
        label: expenseFilterLabels[filter],
        color: theme.color[expenseFilterColors[filter]],
      }))
    : null;

  return (
    <View style={styles.container}>
      <View style={styles.dayTabs}></View>

      <Text style={styles.dayTitle}>{dayDisplayName}</Text>

      <View style={styles.filterRow}>
        <View style={styles.filterItem}>
          <Text style={styles.filterItemLabel}>Difficulty</Text>
          <Pressable
            onPress={onAdvanceDifficultyFilter}
            accessibilityRole="button"
            accessibilityState={{ selected: difficultyBadgeActive }}
            accessibilityLabel="Add another difficulty filter"
            style={({ pressed }) => [
              styles.filterBadge,
              difficultyBadgeActive && styles.filterBadgeActive,
              pressed && styles.filterBadgePressed,
            ]}
          >
            <View style={styles.filterBadgeContent}>
              {difficultyBadgeActive ? (
                difficultyBadgeDots?.map((dot) => (
                  <View
                    key={dot.key}
                    style={[
                      styles.filterBadgeDot,
                      { backgroundColor: dot.color },
                    ]}
                    accessibilityLabel={dot.label}
                  />
                ))
              ) : (
                <Text style={styles.filterBadgePlaceholder}>All</Text>
              )}
            </View>
          </Pressable>
        </View>
        <View style={styles.filterItem}>
          <Text style={styles.filterItemLabel}>Expense</Text>
          <Pressable
            onPress={onAdvanceExpenseFilter}
            accessibilityRole="button"
            accessibilityState={{ selected: expenseBadgeActive }}
            accessibilityLabel="Add another expense filter"
            style={({ pressed }) => [
              styles.filterBadge,
              expenseBadgeActive && styles.filterBadgeActive,
              pressed && styles.filterBadgePressed,
            ]}
          >
            <View style={styles.filterBadgeContent}>
              {expenseBadgeActive ? (
                expenseBadgeItems?.map((item) => (
                  <Text
                    key={item.key}
                    style={[
                      styles.filterBadgeExpenseText,
                      { color: item.color },
                    ]}
                  >
                    {item.label}
                  </Text>
                ))
              ) : (
                <Text style={styles.filterBadgePlaceholder}>$ • $$ • $$$</Text>
              )}
            </View>
          </Pressable>
        </View>
      </View>

      <FlexGrid gutterWidth={theme.space.sm} style={styles.searchRow}>
        <FlexGrid.Row alignItems="center">
          <FlexGrid.Col
            grow={0}
            style={[styles.gridAutoCol, styles.searchIconCell]}
          >
            <MaterialCommunityIcons
              name="magnify"
              size={20}
              color={theme.color.subtleInk}
            />
          </FlexGrid.Col>
          <FlexGrid.Col>
            <TextInput
              style={styles.searchInput}
              placeholder="Search meals"
              placeholderTextColor={theme.color.subtleInk}
              value={searchQuery}
              onChangeText={onSearchQueryChange}
              returnKeyType="search"
              accessibilityLabel="Search meals"
            />
          </FlexGrid.Col>
        </FlexGrid.Row>
      </FlexGrid>

      <View style={styles.mealCard} {...panResponder.panHandlers}>
        <View style={styles.mealHero}>
          <Text style={styles.mealEmoji}>{meal?.emoji ?? "🍽️"}</Text>
          <View style={styles.mealHeroDetails}>
            <FlexGrid
              gutterWidth={theme.space.md}
              style={styles.mealHeroMetaGrid}
            >
              <FlexGrid.Row
                alignItems="center"
                justifyContent="flex-start"
                style={styles.mealHeroMetaRow}
              >
                <FlexGrid.Col grow={0} style={styles.gridAutoCol}>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons
                      name="star"
                      size={16}
                      color={theme.color.accent}
                    />
                    <Text style={styles.metaText}>{ratingLabel}</Text>
                  </View>
                </FlexGrid.Col>
                <FlexGrid.Col grow={0} style={styles.gridAutoCol}>
                  <View style={styles.metaItem}>
                    <Text style={styles.metaText}>{costLabel}</Text>
                  </View>
                </FlexGrid.Col>
                <FlexGrid.Col grow={0} style={styles.gridAutoCol}>
                  <View style={styles.metaItem}>
                    <MaterialCommunityIcons
                      name="circle"
                      size={14}
                      color={
                        theme.color[
                          difficultyToThemeColor(mealDifficulty ?? "medium")
                        ]
                      }
                    />
                    <Text style={styles.metaText}>
                      {mealDifficulty
                        ? difficultyToLabel[mealDifficulty]
                        : "--"}
                    </Text>
                  </View>
                </FlexGrid.Col>
              </FlexGrid.Row>
            </FlexGrid>
            <Text style={styles.lastServed}>
              {formatLastServed(meal?.updatedAt)}
            </Text>
          </View>
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
        </View>
      </View>

      <FlexGrid gutterWidth={theme.space.sm}>
        <FlexGrid.Row alignItems="center">
          <FlexGrid.Col span={4}>
            <PlannerActionButton
              icon="check"
              label="Add"
              onPress={onAdd}
              disabled={!meal}
              styles={styles}
            />
          </FlexGrid.Col>
          <FlexGrid.Col span={4}>
            <PlannerActionButton
              icon="shuffle"
              label="Shuffle"
              onPress={onShuffle}
              disabled={!meal}
              styles={styles}
            />
          </FlexGrid.Col>
          <FlexGrid.Col span={4}>
            <PlannerActionButton
              icon="silverware-fork-knife"
              label="Eat"
              onPress={onEat}
              disabled={!meal}
              styles={styles}
            />
          </FlexGrid.Col>
        </FlexGrid.Row>
      </FlexGrid>
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

const PlannerActionButton = ({
  icon,
  label,
  onPress,
  disabled,
  styles,
}: PlannerActionButtonProps) => {
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
        style={[
          styles.actionButtonText,
          disabled && styles.actionButtonTextDisabled,
        ]}
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
      gap: theme.space.lg,
    },
    dayTabs: {
      flexDirection: "row",
      justifyContent: "center",
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
    gridAutoCol: {
      flexBasis: "auto",
      flexGrow: 0,
    },
    filterRow: {
      flexDirection: "row",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: theme.space.lg,
    },
    filterItem: {
      alignItems: "center",
      gap: theme.space.xs,
    },
    filterItemLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    filterBadge: {
      paddingHorizontal: theme.space.sm,
      paddingVertical: 4,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
    },
    filterBadgeActive: {
      backgroundColor: theme.color.surface,
      borderColor: theme.color.accent,
    },
    filterBadgePressed: {
      opacity: 0.85,
    },
    filterBadgeContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
    },
    filterBadgeDot: {
      width: 10,
      height: 10,
      borderRadius: theme.radius.full,
    },
    filterBadgePlaceholder: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    filterBadgeExpenseText: {
      color: theme.color.ink,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.medium,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    searchRow: {
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
    },
    searchIconCell: {
      justifyContent: "center",
    },
    searchInput: {
      flex: 1,
      width: "100%",
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
      backgroundColor: theme.color.surfaceAlt,
      paddingVertical: theme.space.lg,
      paddingHorizontal: theme.space.lg,
      gap: theme.space.md,
    },
    mealHeroDetails: {
      alignSelf: "stretch",
      alignItems: "flex-start",
      gap: theme.space.xs,
    },
    mealEmoji: {
      fontSize: 64,
    },
    mealHeroMetaGrid: {
      width: "100%",
    },
    mealHeroMetaRow: {
      columnGap: theme.space.sm,
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
      textAlign: "center",
    },
    actionButton: {
      flex: 1,
      width: "100%",
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
