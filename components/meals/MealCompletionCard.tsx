import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { alpha, WeeklyTheme } from "../../styles/theme";
import { Ingredient, Meal } from "../../types/meals";
import {
  retryIngredientSuggestions,
  suggestIngredientsForMealTitle,
} from "../../utils/mealCompletion";

type Props = {
  meal: Meal;
  onApply: (ingredients: Ingredient[]) => void;
  onUpdateDetails: (patch: Pick<Partial<Meal>, "difficulty" | "expense">) => void;
  onExpand: () => void;
  isLastIncomplete?: boolean;
};

const MealCompletionCard = ({ meal, onApply, onUpdateDetails, onExpand, isLastIncomplete = false }: Props) => {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [suggestions, setSuggestions] = useState<Ingredient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manualKey, setManualKey] = useState("");
  const [isExpanded, setExpanded] = useState(false);
  const [isLoading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isCompleting, setCompleting] = useState(false);
  const [detailDifficulty, setDetailDifficulty] = useState(meal.difficulty);
  const [detailExpense, setDetailExpense] = useState(meal.expense);
  const [reduceMotion, setReduceMotion] = useState(false);
  const celebrationOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const exitProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion
    );
    return () => subscription.remove();
  }, []);

  const load = useCallback(async (retry = false) => {
    setLoading(true);
    setHasError(false);
    const outcome = retry
      ? await retryIngredientSuggestions(meal.title)
      : await suggestIngredientsForMealTitle(meal.title);
    if (!outcome.ok) {
      setHasError(true);
      setLoading(false);
      return;
    }
    const next = [...outcome.data.keyIngredients, ...outcome.data.pantryStaples];
    setSuggestions(next);
    setSelected(new Set());
    setLoading(false);
  }, [meal.title]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isCompleting) return;
    setDetailDifficulty(meal.difficulty);
    setDetailExpense(meal.expense);
  }, [isCompleting, meal.difficulty, meal.expense]);

  const addManualIngredient = useCallback(() => {
    const name = manualKey.trim();
    if (!name) return;
    const ingredient: Ingredient = {
      name,
      category: "other",
      ingredientType: "keyIngredient",
    };
    setSuggestions((current) => {
      if (current.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
        return current;
      }
      return [...current, ingredient];
    });
    setSelected((current) => new Set(current).add(name.toLowerCase()));
    setManualKey("");
  }, [manualKey]);

  const toggle = (name: string) => {
    const key = name.trim().toLowerCase();
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const orderedSuggestions = [
    ...suggestions.filter((item) => item.ingredientType === "keyIngredient"),
    ...suggestions.filter((item) => item.ingredientType === "pantryStaple"),
  ];

  const renderSuggestions = () => (
    <View style={styles.chipRow}>
      {orderedSuggestions.map((ingredient) => {
        const isSelected = selected.has(ingredient.name.toLowerCase());
        return (
          <Pressable
            key={`${ingredient.ingredientType}-${ingredient.name}`}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: isSelected }}
            onPress={() => toggle(ingredient.name)}
            style={({ pressed }) => [
              styles.chip,
              isSelected && styles.chipSelected,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.chipDot} />
            <Text
              style={[styles.chipText, isSelected && styles.chipTextSelected]}
              numberOfLines={1}
            >
              {ingredient.name}
            </Text>
            <MaterialCommunityIcons
              name={isSelected ? "check" : "plus"}
              size={15}
              color={
                isSelected
                  ? theme.color.accent
                  : alpha(theme.color.accent, 0.58)
              }
            />
          </Pressable>
        );
      })}
    </View>
  );

  const selectedIngredients = suggestions.filter((item) =>
    selected.has(item.name.toLowerCase())
  );
  const hasKeyIngredients = (meal.ingredients ?? []).some((ingredient) =>
    typeof ingredient === "string"
      ? Boolean(ingredient.trim())
      : Boolean(ingredient.name.trim()) && ingredient.ingredientType !== "pantryStaple"
  );
  const missingDetailLabels = [
    !hasKeyIngredients ? "ingredients" : null,
    typeof meal.difficulty !== "number" ? "difficulty" : null,
    typeof meal.expense !== "number" ? "expense" : null,
  ].filter((label): label is string => Boolean(label));
  const missingStatus = `Missing ${missingDetailLabels.join(
    missingDetailLabels.length === 2 ? " and " : ", "
  )}`;
  const cycleLevel = (value?: number) =>
    typeof value !== "number" ? 1 : value <= 1 ? 3 : value <= 3 ? 5 : 1;
  const difficultyLabel =
    typeof detailDifficulty !== "number"
      ? "Not set"
      : detailDifficulty <= 1
      ? "Easy"
      : detailDifficulty <= 3
      ? "Medium"
      : "Hard";
  const difficultyColor =
    typeof detailDifficulty !== "number"
      ? undefined
      : detailDifficulty <= 1
      ? theme.color.success
      : detailDifficulty <= 3
      ? theme.color.warning
      : theme.color.danger;
  const expenseLabel =
    typeof detailExpense !== "number"
      ? "Not set"
      : detailExpense <= 1
      ? "$"
      : detailExpense <= 3
      ? "$$"
      : "$$$";
  const finishMeal = useCallback(
    (commit: () => void) => {
      if (isCompleting) return;
      const timingScale = isLastIncomplete ? 0.75 : 1;
      if (!reduceMotion) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      setCompleting(true);
      setExpanded(false);

      if (reduceMotion) {
        Animated.timing(exitProgress, {
          toValue: 1,
          duration: 520 * timingScale,
          easing: Easing.out(Easing.quad),
          useNativeDriver: false,
        }).start(() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          commit();
        });
        return;
      }

      Animated.parallel([
        Animated.sequence([
          Animated.timing(celebrationOpacity, {
            toValue: 1,
            duration: 320 * timingScale,
            useNativeDriver: true,
          }),
          Animated.delay(840 * timingScale),
          Animated.timing(celebrationOpacity, {
            toValue: 0,
            duration: 320 * timingScale,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(cardScale, {
            toValue: 1.015,
            duration: 360 * timingScale,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(cardScale, {
            toValue: 1,
            duration: 360 * timingScale,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: false,
          }),
        ]),
      ]).start();

      setTimeout(() => {
        Animated.timing(exitProgress, {
          toValue: 1,
          duration: 640 * timingScale,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }).start(() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          commit();
        });
      }, 1520 * timingScale);
    },
    [cardScale, celebrationOpacity, exitProgress, isCompleting, isLastIncomplete, reduceMotion]
  );

  const handleApplyIngredients = useCallback(() => {
    const commit = () => onApply(selectedIngredients);
    const addsKeyIngredient = selectedIngredients.some(
      (ingredient) => ingredient.ingredientType !== "pantryStaple"
    );
    if (
      addsKeyIngredient &&
      typeof meal.difficulty === "number" &&
      typeof meal.expense === "number"
    ) {
      finishMeal(commit);
      return;
    }
    commit();
  }, [finishMeal, meal.difficulty, meal.expense, onApply, selectedIngredients]);

  const detailsReady =
    typeof detailDifficulty === "number" && typeof detailExpense === "number";
  const handleSaveDetails = useCallback(() => {
    if (!detailsReady) return;
    finishMeal(() =>
      onUpdateDetails({
        difficulty: detailDifficulty,
        expense: detailExpense,
      })
    );
  }, [detailDifficulty, detailExpense, detailsReady, finishMeal, onUpdateDetails]);

  const sparkleOffsets = [
    [-24, -16], [-10, -24], [8, -22], [24, -12],
    [-22, 8], [-6, 14], [12, 12], [26, 5],
  ] as const;

  return (
    <Animated.View
      style={[
        styles.animatedCardShell,
        {
          opacity: exitProgress.interpolate({
            inputRange: [0, 0.65, 1],
            outputRange: [1, 0.72, 0],
          }),
          transform: [
            { scale: cardScale },
            {
              translateY: exitProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -14],
              }),
            },
          ],
        },
      ]}
    >
    <View style={[styles.card, isCompleting && styles.cardComplete]}>
      <View style={styles.header}>
        <View style={styles.emojiWrap}><Text style={styles.emoji}>{meal.emoji}</Text></View>
        <View style={styles.headerText}>
          <Text style={styles.title}>{meal.title}</Text>
          <View style={styles.statusRow}>
            {isCompleting ? (
              <View style={styles.completionAnchor}>
                <MaterialCommunityIcons name="check" size={17} color={theme.color.success} />
                {sparkleOffsets.map(([x, y], index) => (
                  <Animated.Text
                    key={`${x}-${y}`}
                    style={[
                      styles.sparkle,
                      {
                        left: x,
                        top: y,
                        opacity: celebrationOpacity,
                        color: index % 3 === 0 ? theme.color.accent : index % 3 === 1 ? "#F2D15B" : theme.color.ink,
                      },
                    ]}
                  >
                    ✦
                  </Animated.Text>
                ))}
              </View>
            ) : <View style={styles.statusDot} />}
            <Text style={[styles.status, isCompleting && styles.statusComplete]} numberOfLines={1}>
              {isCompleting ? "Meal complete" : missingStatus}
            </Text>
          </View>
          {!isCompleting ? <Pressable
            style={({ pressed }) => [styles.suggestionRow, pressed && styles.pressed]}
            onPress={() => {
              if (!isExpanded) onExpand();
              setExpanded((current) => !current);
            }}
            accessibilityRole="button"
            accessibilityLabel={isExpanded ? `Hide missing details for ${meal.title}` : `Show missing details for ${meal.title}`}
          >
            <Text style={styles.suggestionEmoji}>✨</Text>
            <Text style={styles.suggestionLabel}>{hasKeyIngredients ? "Add Missing Details" : "Suggested Ingredients"}</Text>
            <MaterialCommunityIcons
              name={!hasKeyIngredients && isExpanded ? "chevron-up" : "chevron-right"}
              size={22}
              color={theme.color.subtleInk}
            />
          </Pressable> : null}
        </View>
      </View>

      {isExpanded && !hasKeyIngredients && (isLoading ? (
        <View style={styles.messageRow}>
          <ActivityIndicator size="small" color={theme.color.accent} />
          <Text style={styles.message}>Finding likely ingredients…</Text>
        </View>
      ) : (
        <>
          {hasError ? (
            <View style={styles.errorRow}>
              <Text style={styles.message}>We couldn’t suggest ingredients right now.</Text>
              <Pressable onPress={() => load(true)} accessibilityRole="button">
                <Text style={styles.retry}>Try again</Text>
              </Pressable>
            </View>
          ) : null}
          {renderSuggestions()}
          <View style={styles.manualRow}>
            <TextInput
              value={manualKey}
              onChangeText={setManualKey}
              onSubmitEditing={addManualIngredient}
              placeholder="Add an ingredient"
              placeholderTextColor={theme.color.subtleInk}
              style={styles.manualInput}
              returnKeyType="done"
            />
            <Pressable onPress={addManualIngredient} style={styles.addButton}>
              <MaterialCommunityIcons name="plus" size={22} color={theme.color.accent} />
            </Pressable>
          </View>
          <View style={styles.footer}>
            <Pressable
              disabled={selectedIngredients.length === 0}
              onPress={handleApplyIngredients}
              style={({ pressed }) => [
                styles.applyButton,
                selectedIngredients.length === 0 && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.applyText}>Add selected</Text>
            </Pressable>
          </View>
        </>
      ))}

      {isExpanded && hasKeyIngredients ? (
        <View style={styles.detailsDrawer}>
          <Text style={styles.detailsLabel}>Details</Text>
          <View style={styles.detailsGrid}>
            <Pressable
              onPress={() => setDetailDifficulty((current) => cycleLevel(current))}
              accessibilityRole="button"
              accessibilityLabel={`Difficulty, ${difficultyLabel}`}
              style={({ pressed }) => [styles.detailTile, pressed && styles.pressed]}
            >
              <Text style={styles.detailTileLabel}>Difficulty</Text>
              <View style={styles.detailValueRow}>
                {difficultyColor ? <View style={[styles.detailDot, { backgroundColor: difficultyColor }]} /> : null}
                <Text style={[styles.detailValue, !difficultyColor && styles.detailValueUnset]}>{difficultyLabel}</Text>
                {!difficultyColor ? <Text style={styles.detailAdd}>+</Text> : null}
              </View>
            </Pressable>
            <Pressable
              onPress={() => setDetailExpense((current) => cycleLevel(current))}
              accessibilityRole="button"
              accessibilityLabel={`Expense, ${expenseLabel}`}
              style={({ pressed }) => [styles.detailTile, pressed && styles.pressed]}
            >
              <Text style={styles.detailTileLabel}>Expense</Text>
              <View style={styles.detailValueRow}>
                <Text style={[styles.detailValue, typeof detailExpense !== "number" && styles.detailValueUnset]}>{expenseLabel}</Text>
                {typeof detailExpense !== "number" ? <Text style={styles.detailAdd}>+</Text> : null}
              </View>
            </Pressable>
          </View>
          <View style={styles.footer}>
            <Pressable
              disabled={!detailsReady}
              onPress={handleSaveDetails}
              accessibilityRole="button"
              accessibilityLabel="Save meal details"
              style={({ pressed }) => [
                styles.applyButton,
                !detailsReady && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.applyText}>Done</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
    </Animated.View>
  );
};

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  animatedCardShell: { width: "100%" },
  card: { borderRadius: theme.radius.lg, backgroundColor: theme.color.surfaceAlt, padding: theme.space.md, gap: theme.space.md },
  cardComplete: { borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(theme.color.success, 0.45), shadowColor: theme.color.accent, shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  header: { flexDirection: "row", alignItems: "stretch", gap: theme.space.md },
  emojiWrap: { width: 58, height: 58, alignSelf: "center", borderRadius: theme.radius.full, alignItems: "center", justifyContent: "center", backgroundColor: theme.color.surface },
  emoji: { fontSize: 32 },
  headerText: { flex: 1, gap: theme.space.sm },
  title: { color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  statusRow: { flexDirection: "row", alignItems: "center", gap: theme.space.xs },
  statusDot: { width: 8, height: 8, borderRadius: theme.radius.full, backgroundColor: theme.color.warning },
  status: { color: theme.color.subtleInk, fontSize: theme.type.size.sm },
  statusComplete: { color: theme.color.success, fontWeight: theme.type.weight.bold },
  completionAnchor: { width: 17, height: 17, alignItems: "center", justifyContent: "center" },
  sparkle: { position: "absolute", fontSize: 8 },
  suggestionRow: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: theme.space.sm, paddingTop: theme.space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border },
  suggestionEmoji: { fontSize: 18 },
  suggestionLabel: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm },
  chip: { width: "48.5%", height: 44, flexDirection: "row", alignItems: "center", gap: theme.space.sm, borderRadius: theme.radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border, backgroundColor: theme.color.surface, paddingHorizontal: theme.space.md },
  chipDot: { width: 7, height: 7, borderRadius: theme.radius.full, backgroundColor: theme.color.accent },
  chipSelected: { borderColor: theme.color.accent, backgroundColor: alpha(theme.color.accent, 0.12) },
  chipText: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium, textTransform: "capitalize" },
  chipTextSelected: { color: theme.color.accent },
  manualRow: { minHeight: 48, flexDirection: "row", alignItems: "center", borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
  manualInput: { flex: 1, minHeight: 48, color: theme.color.ink, fontSize: theme.type.size.base, paddingHorizontal: theme.space.md },
  addButton: { width: 44, height: 44, marginRight: theme.space.xs, borderRadius: theme.radius.full, alignItems: "center", justifyContent: "center" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: theme.space.xs },
  applyButton: { minHeight: 42, borderRadius: theme.radius.md, backgroundColor: theme.color.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: theme.space.lg },
  applyText: { color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  messageRow: { minHeight: 80, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm },
  message: { color: theme.color.subtleInk, fontSize: theme.type.size.sm },
  errorRow: { gap: theme.space.sm },
  retry: { color: theme.color.accent, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold },
  detailsDrawer: { gap: theme.space.md },
  detailsLabel: { color: theme.color.subtleInk, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.medium, textTransform: "uppercase", letterSpacing: 0.8 },
  detailsGrid: { flexDirection: "row", gap: theme.space.md },
  detailTile: { flex: 1, gap: theme.space.xs, padding: theme.space.md, borderRadius: theme.radius.md, backgroundColor: theme.color.surface },
  detailTileLabel: { color: theme.color.subtleInk, fontSize: theme.type.size.xs, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValueRow: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
  detailDot: { width: 8, height: 8, borderRadius: theme.radius.full },
  detailValue: { color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  detailValueUnset: { color: theme.color.subtleInk, fontWeight: theme.type.weight.medium },
  detailAdd: { marginLeft: "auto", color: theme.color.accent, fontSize: theme.type.size.title, fontWeight: theme.type.weight.medium },
});

export default MealCompletionCard;
