import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  FlatList,
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
import { buildMealSuggestions, MealSuggestion } from "./suggestionMatcher";
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
  onAddMeal: (meal: Meal, side?: string) => void;
  onSuggestAnother: () => void;
  meals?: Meal[];
  onSelectSearchMeal?: (meal: Meal, side?: string) => void;
  onEatOut?: (title?: string) => void;
  onFlexNight?: () => void;
  getLastServedISO?: (mealId: Meal["id"]) => string | null | undefined;
  sides?: string[];
  onAddSide?: (value: string) => void;
  onRemoveSide?: (index: number) => void;
  pins?: DayPinsState;
  onPinsChange?: (next: DayPinsState) => void;
};

type DifficultyKey = "easy" | "medium" | "hard";
type PlanMealMode = "suggest" | "search" | "eatOut" | "flexNight";

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
  meals = [],
  onSelectSearchMeal,
  onEatOut,
  onFlexNight,
  getLastServedISO,
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
  const [isFilterMode, setFilterMode] = useState(false);
  const [mode, setMode] = useState<PlanMealMode>("suggest");
  const [query, setQuery] = useState("");
  const [selectedSideMeal, setSelectedSideMeal] = useState<Meal | null>(null);
  const [isEatOutDetailMode, setEatOutDetailMode] = useState(false);
  const [eatOutTitle, setEatOutTitle] = useState("Eat Out Night");
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
  const lastServed = formatLastServed(
    meal ? getLastServedISO?.(meal.id) ?? undefined : undefined
  );
  const reason = suggestion
    ? reasonByContext[suggestion.context] ?? reasonByContext.general
    : "Add more meals to get better suggestions.";
  const hasSides = sides.length > 0;
  const hasActivePins = Boolean(
    normalizedPins.effort ||
      normalizedPins.expense ||
      normalizedPins.reuseWeeks ||
      normalizedPins.freezerNight ||
      normalizedPins.familyStar
  );
  const filteredMeals = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const sourceMeals =
      pins && hasActivePins
        ? buildMealSuggestions(meals, normalizedPins).map((entry) => entry.meal)
        : meals;
    if (!normalized) {
      return sourceMeals;
    }
    return sourceMeals.filter((candidate) =>
      candidate.title.toLowerCase().includes(normalized)
    );
  }, [hasActivePins, meals, normalizedPins, pins, query]);
  const canShowFilterToggle =
    (mode === "suggest" || mode === "search") && !selectedSideMeal;

  useEffect(() => {
    if (visible) {
      setSideInput("");
      setSideDeleteMode(false);
      setFilterMode(false);
      setMode("suggest");
      setQuery("");
      setSelectedSideMeal(null);
      setEatOutDetailMode(false);
      setEatOutTitle("Eat Out Night");
    }
  }, [visible]);

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

  const switchMode = (nextMode: PlanMealMode) => {
    setMode(nextMode);
    setFilterMode(false);
    setSelectedSideMeal(null);
    setEatOutDetailMode(false);
  };

  const handleBackToSuggestion = () => {
    setMode("suggest");
    setFilterMode(false);
    setSelectedSideMeal(null);
    setEatOutDetailMode(false);
  };

  const handleSelectSearchResult = (selectedMeal: Meal) => {
    setSelectedSideMeal(selectedMeal);
    setSideInput("");
    setSideDeleteMode(false);
  };

  const handleSaveSuggestedMealToDay = () => {
    if (!meal) {
      return;
    }
    setSelectedSideMeal(meal);
    setSideInput("");
    setSideDeleteMode(false);
  };

  const handleBackFromSideScreen = () => {
    setSelectedSideMeal(null);
    setSideInput("");
    setSideDeleteMode(false);
  };

  const handleSavePlan = () => {
    if (!selectedSideMeal) {
      return;
    }
    const pendingSide = formatSideLabel(sideInput);
    if (mode === "search") {
      onSelectSearchMeal?.(selectedSideMeal, pendingSide || undefined);
      return;
    }
    onAddMeal(selectedSideMeal, pendingSide || undefined);
  };

  const handleSaveEatOut = () => {
    const title = eatOutTitle.trim() || "Eat Out Night";
    onEatOut?.(title);
  };

  const visibleModeActions: PlanMealMode[] = [
    "search",
    "eatOut",
    "flexNight",
  ];

  const renderModeActionButton = (targetMode: PlanMealMode) => {
    const label =
      targetMode === "suggest"
        ? "Suggest"
        : targetMode === "search"
        ? "Search"
        : targetMode === "eatOut"
        ? "Eat Out"
        : "Flex Night";
    const icon =
      targetMode === "suggest"
        ? "lightbulb-on-outline"
        : targetMode === "search"
        ? "magnify"
        : targetMode === "eatOut"
        ? "silverware-fork-knife"
        : "recycle";
    const disabled =
      (targetMode === "eatOut" && !onEatOut) ||
      (targetMode === "flexNight" && !onFlexNight);

    return (
      <Pressable
        key={targetMode}
        onPress={() => switchMode(targetMode)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={
          targetMode === "eatOut"
            ? `Show eat out mode for ${dayName}`
            : `Show ${label.toLowerCase()} mode for ${dayName}`
        }
        style={({ pressed }) => [
          styles.quickActionButton,
          disabled && styles.quickActionButtonDisabled,
          pressed && !disabled && styles.quickActionButtonPressed,
        ]}
      >
        <MaterialCommunityIcons
          name={icon}
          size={18}
          color={theme.color.accent}
        />
        <Text style={styles.quickActionText}>{label}</Text>
      </Pressable>
    );
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
              {mode === "suggest" ? (
                <View style={styles.headerTitleSlot} />
              ) : (
                <Pressable
                  onPress={handleBackToSuggestion}
                  accessibilityRole="button"
                  accessibilityLabel="Back to suggestions"
                  style={({ pressed }) => [
                    styles.headerIconButton,
                    pressed && styles.headerIconButtonPressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="chevron-left"
                    size={24}
                    color={theme.color.ink}
                  />
                </Pressable>
              )}
              <Text style={styles.title}>Let&apos;s Plan {dayName}</Text>
              {canShowFilterToggle ? (
                <Pressable
                  onPress={() => setFilterMode((prev) => !prev)}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isFilterMode ? "Close filters" : "Show meal filters"
                  }
                  style={({ pressed }) => [
                    styles.headerIconButton,
                    pressed && styles.headerIconButtonPressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isFilterMode ? "close" : "tune-variant"}
                    size={20}
                    color={theme.color.ink}
                  />
                </Pressable>
              ) : (
                <View style={styles.headerTitleSlot} />
              )}
            </View>

            {canShowFilterToggle && isFilterMode && pins && onPinsChange ? (
              <DayPinsControls
                value={normalizedPins}
                onChange={onPinsChange}
                mode="editable"
              />
            ) : mode === "suggest" && !selectedSideMeal ? (
              <View style={styles.quickActionRow}>
                {visibleModeActions.map(renderModeActionButton)}
              </View>
            ) : null}

            {(mode === "search" || mode === "suggest") && selectedSideMeal ? (
              <View style={styles.searchSideStep}>
                <View style={styles.selectedMealCard}>
                  <Text style={styles.rowEmoji}>
                    {selectedSideMeal.emoji ?? "🍽️"}
                  </Text>
                  <View style={styles.selectedMealText}>
                    <Text style={styles.selectedMealEyebrow}>
                      Add a side (optional)
                    </Text>
                    <Text style={styles.selectedMealTitle} numberOfLines={1}>
                      {selectedSideMeal.title}
                    </Text>
                  </View>
                </View>

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
                        accessibilityRole={isSideDeleteMode ? "button" : "text"}
                        accessibilityLabel={
                          isSideDeleteMode
                            ? `Remove side ${side}`
                            : `Side ${side}`
                        }
                        style={({ pressed }) => [
                          styles.sideChip,
                          isSideDeleteMode && styles.sideChipDeleteMode,
                          pressed && isSideDeleteMode && styles.sideChipPressed,
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
                        isSideDeleteMode ? "trash-can" : "trash-can-outline"
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

                <View style={styles.actions}>
                  <Pressable
                    onPress={handleSavePlan}
                    accessibilityRole="button"
                    accessibilityLabel={`Save plan for ${dayName}`}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      pressed && styles.primaryButtonPressed,
                    ]}
                  >
                    <Text style={styles.primaryButtonText}>Save Plan</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleBackFromSideScreen}
                    accessibilityRole="button"
                    accessibilityLabel="Back"
                    style={({ pressed }) => [
                      styles.secondaryButton,
                      pressed && styles.secondaryButtonPressed,
                    ]}
                  >
                    <Text style={styles.secondaryButtonText}>Back</Text>
                  </Pressable>
                </View>
              </View>
            ) : mode === "search" ? (
              <>
                <View style={styles.searchRow}>
                  <MaterialCommunityIcons
                    name="magnify"
                    size={18}
                    color={theme.color.subtleInk}
                  />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search meals"
                    placeholderTextColor={theme.color.subtleInk}
                    style={styles.searchInput}
                    autoCapitalize="words"
                    accessibilityLabel="Search meals"
                    returnKeyType="search"
                  />
                </View>

                {filteredMeals.length === 0 ? (
                  <View style={[styles.emptyCard, styles.searchEmptyCard]}>
                    <Text style={styles.emptyTitle}>
                      No meals match your search.
                    </Text>
                    <Text style={styles.emptySubtitle}>
                      Try a different name or keyword.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={filteredMeals}
                    keyExtractor={(item) => item.id}
                    ItemSeparatorComponent={() => (
                      <View style={styles.separator} />
                    )}
                    contentContainerStyle={styles.listContent}
                    keyboardShouldPersistTaps="handled"
                    style={styles.list}
                    renderItem={({ item }) => (
                      <Pressable
                        onPress={() => handleSelectSearchResult(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${item.title} for ${dayName}`}
                        style={({ pressed }) => [
                          styles.row,
                          pressed && styles.rowPressed,
                        ]}
                      >
                        <Text style={styles.rowEmoji}>
                          {item.emoji ?? "🍽️"}
                        </Text>
                        <Text style={styles.rowTitle} numberOfLines={1}>
                          {item.title}
                        </Text>
                        <View style={styles.rowIcon}>
                          <MaterialCommunityIcons
                            name="plus"
                            size={18}
                            color={theme.color.ink}
                          />
                        </View>
                      </Pressable>
                    )}
                  />
                )}
              </>
            ) : mode === "eatOut" ? (
              isEatOutDetailMode ? (
                <View style={styles.searchSideStep}>
                  <View style={styles.selectedMealCard}>
                    <Text style={styles.rowEmoji}>🍽️</Text>
                    <View style={styles.selectedMealText}>
                      <Text style={styles.selectedMealEyebrow}>
                        Eat out plan
                      </Text>
                      <Text style={styles.selectedMealTitle} numberOfLines={1}>
                        {eatOutTitle.trim() || "Eat Out Night"}
                      </Text>
                    </View>
                  </View>

                  <TextInput
                    value={eatOutTitle}
                    onChangeText={setEatOutTitle}
                    placeholder="Eat Out Night"
                    placeholderTextColor={theme.color.subtleInk}
                    autoCapitalize="words"
                    returnKeyType="done"
                    onFocus={() => setEatOutTitle("")}
                    style={styles.eatOutInput}
                    accessibilityLabel="Eat out plan title"
                  />

                  <View style={styles.actions}>
                    <Pressable
                      onPress={handleSaveEatOut}
                      disabled={!onEatOut}
                      accessibilityRole="button"
                      accessibilityLabel={`Save eat out plan for ${dayName}`}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        !onEatOut && styles.buttonDisabled,
                        pressed && onEatOut && styles.primaryButtonPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.primaryButtonText,
                          !onEatOut && styles.buttonTextDisabled,
                        ]}
                      >
                        Save Plan
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => setEatOutDetailMode(false)}
                      accessibilityRole="button"
                      accessibilityLabel="Return to eat out"
                      style={({ pressed }) => [
                        styles.secondaryButton,
                        pressed && styles.secondaryButtonPressed,
                      ]}
                    >
                      <Text style={styles.secondaryButtonText}>
                        Back to Eat Out
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.confirmationView}>
                    <Text style={styles.confirmationEmoji}>🍽️</Text>
                    <Text style={styles.confirmationTitle}>Eat Out</Text>
                    <Text style={styles.confirmationSubtitle}>
                      Mark {dayName} as eating out instead of cooking.
                    </Text>
                  </View>
                  <View style={styles.actions}>
                    <Pressable
                      onPress={() => setEatOutDetailMode(true)}
                      disabled={!onEatOut}
                      accessibilityRole="button"
                      accessibilityLabel={`Save eat out for ${dayName}`}
                      style={({ pressed }) => [
                        styles.primaryButton,
                        !onEatOut && styles.buttonDisabled,
                        pressed && onEatOut && styles.primaryButtonPressed,
                      ]}
                    >
                      <Text
                        style={[
                          styles.primaryButtonText,
                          !onEatOut && styles.buttonTextDisabled,
                        ]}
                      >
                        Save Eat Out
                      </Text>
                    </Pressable>
                  </View>
                </>
              )
            ) : mode === "flexNight" ? (
              <>
                <View style={styles.confirmationView}>
                  <Text style={styles.confirmationEmoji}>🔄</Text>
                  <Text style={styles.confirmationTitle}>Flex Night</Text>
                  <Text style={styles.confirmationSubtitle}>
                    Leave this night flexible for leftovers, freezer meals, or
                    whatever is already in the house.
                  </Text>
                </View>
                <View style={styles.actions}>
                  <Pressable
                    onPress={onFlexNight}
                    disabled={!onFlexNight}
                    accessibilityRole="button"
                    accessibilityLabel={`Save flex night for ${dayName}`}
                    style={({ pressed }) => [
                      styles.primaryButton,
                      !onFlexNight && styles.buttonDisabled,
                      pressed && onFlexNight && styles.primaryButtonPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.primaryButtonText,
                        !onFlexNight && styles.buttonTextDisabled,
                      ]}
                    >
                      Save Flex Night
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : meal ? (
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
                    <Text style={styles.metaTextStrong}>Expense</Text>
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

            {mode === "suggest" && !selectedSideMeal ? (
              <View style={styles.actions}>
                <Pressable
                  onPress={handleSaveSuggestedMealToDay}
                  disabled={!meal}
                  accessibilityRole="button"
                  accessibilityLabel={`Save suggested meal to ${dayName}`}
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
                    Save to {dayName}
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
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.space.sm,
    },
    headerTitleSlot: {
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
    headerIconButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    headerIconButtonPressed: {
      opacity: 0.82,
    },
    subtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
    },
    quickActionRow: {
      flexDirection: "row",
      gap: theme.space.sm,
    },
    quickActionButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: theme.space.xs,
      paddingHorizontal: theme.space.xs,
    },
    quickActionButtonPressed: {
      opacity: 0.86,
    },
    quickActionButtonDisabled: {
      opacity: 0.5,
    },
    quickActionText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
    },
    searchInput: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingBottom: theme.space.lg,
      flexGrow: 1,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.color.cardOutline,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
      paddingVertical: theme.space.md,
    },
    rowPressed: {
      opacity: 0.85,
    },
    rowEmoji: {
      fontSize: 28,
    },
    rowTitle: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      alignItems: "center",
      justifyContent: "center",
    },
    searchSideStep: {
      flex: 1,
      gap: theme.space.md,
    },
    selectedMealCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      padding: theme.space.md,
    },
    selectedMealText: {
      flex: 1,
      gap: 2,
    },
    selectedMealEyebrow: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    selectedMealTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    confirmationView: {
      paddingVertical: theme.space.xl,
      paddingHorizontal: theme.space.lg,
      gap: theme.space.sm,
      alignItems: "center",
    },
    confirmationEmoji: {
      fontSize: 44,
    },
    confirmationTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    confirmationSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      textAlign: "center",
      lineHeight: theme.type.size.base * 1.35,
    },
    eatOutInput: {
      width: "100%",
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
      marginTop: theme.space.sm,
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
      fontWeight: "800",
    },
    metaTextStrong: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: "800",
    },
    expenseText: {
      color: theme.color.success,
      fontSize: theme.type.size.sm,
      fontWeight: "800",
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
    searchEmptyCard: {
      justifyContent: "center",
      flex: 1,
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
