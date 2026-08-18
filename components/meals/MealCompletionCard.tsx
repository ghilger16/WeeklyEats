import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  LayoutAnimation,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { alpha, WeeklyTheme } from "../../styles/theme";
import { Ingredient, Meal } from "../../types/meals";
import CuisineSelectorModal from "./CuisineSelectorModal";
import MealEmoji from "../emoji/MealEmoji";
import { getCuisineLabel } from "../../types/cuisine";
import {
  retryIngredientSuggestions,
  suggestIngredientsForMealTitle,
} from "../../utils/mealCompletion";
import {
  classifyIngredients,
  classifyIngredientType,
} from "../../utils/ingredientClassification";

type Props = {
  meal: Meal;
  onApply: (ingredients: Ingredient[]) => void;
  onUpdateDetails: (patch: Pick<Partial<Meal>, "difficulty" | "expense" | "cuisine">) => void;
  onExpand: () => void;
  onManualIngredientFocus?: () => void;
  onManualIngredientNeedsScroll?: (overlap: number) => void;
  isLastIncomplete?: boolean;
};

const MealCompletionCard = ({ meal, onApply, onUpdateDetails, onExpand, onManualIngredientFocus, onManualIngredientNeedsScroll, isLastIncomplete = false }: Props) => {
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
  const [detailCuisine, setDetailCuisine] = useState(meal.cuisine);
  const [isCuisineSelectorVisible, setCuisineSelectorVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const cardScale = useRef(new Animated.Value(1)).current;
  const exitProgress = useRef(new Animated.Value(0)).current;
  const manualInputRef = useRef<TextInput>(null);
  const isManualInputFocusedRef = useRef(false);
  const keyboardTopRef = useRef<number | null>(null);

  const ensureManualInputVisible = useCallback(() => {
    const keyboardTop = keyboardTopRef.current;
    if (keyboardTop === null || !isManualInputFocusedRef.current) return;
    requestAnimationFrame(() => {
      manualInputRef.current?.measureInWindow((_x, y, _width, height) => {
        const overlap = y + height + 16 - keyboardTop;
        if (overlap > 0) onManualIngredientNeedsScroll?.(overlap);
      });
    });
  }, [onManualIngredientNeedsScroll]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", (event) => {
      keyboardTopRef.current = event.endCoordinates.screenY;
      ensureManualInputVisible();
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      keyboardTopRef.current = null;
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [ensureManualInputVisible]);

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
    const next = await classifyIngredients([
      ...outcome.data.keyIngredients,
      ...outcome.data.pantryStaples,
    ]);
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
    setDetailCuisine(meal.cuisine);
  }, [isCompleting, meal.cuisine, meal.difficulty, meal.expense]);

  const addManualIngredient = useCallback(async () => {
    const name = manualKey.trim();
    if (!name) return;
    const ingredientType = await classifyIngredientType(name);
    const ingredient: Ingredient = {
      name,
      category: "other",
      ingredientType,
    };
    setSuggestions((current) => {
      if (current.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
        return current;
      }
      return [...current, ingredient];
    });
    setSelected((current) => new Set(current).add(name.toLowerCase()));
    setManualKey("");
    setTimeout(ensureManualInputVisible, 60);
  }, [ensureManualInputVisible, manualKey]);

  const toggle = (name: string) => {
    const key = name.trim().toLowerCase();
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const removeSuggestion = (name: string) => {
    const key = name.trim().toLowerCase();
    setSuggestions((current) =>
      current.filter((ingredient) => ingredient.name.trim().toLowerCase() !== key),
    );
    setSelected((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
  };

  const orderedSuggestions = [
    ...suggestions.filter((item) => item.ingredientType === "keyIngredient"),
    ...suggestions.filter((item) => item.ingredientType === "pantryStaple"),
  ];

  const renderSuggestions = () => (
    <>
      {orderedSuggestions.map((ingredient) => {
        const isSelected = selected.has(ingredient.name.toLowerCase());
        return (
          <View
            key={`${ingredient.ingredientType}-${ingredient.name}`}
            style={styles.ingredientRow}
          >
            <Pressable
              onPress={() => removeSuggestion(ingredient.name)}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${ingredient.name} from suggestions`}
              hitSlop={6}
              style={({ pressed }) => [
                styles.ingredientBulletSlot,
                pressed && styles.pressed,
              ]}
            >
              <MaterialCommunityIcons
                name="minus-circle-outline"
                size={19}
                color={theme.color.accent}
              />
            </Pressable>
            <Text
              style={[
                styles.ingredientText,
                isSelected && styles.ingredientTextSelected,
              ]}
              numberOfLines={1}
            >
              {ingredient.name}
            </Text>
            <Pressable
              onPress={() => toggle(ingredient.name)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isSelected }}
              accessibilityLabel={`${isSelected ? "Deselect" : "Select"} ${ingredient.name}`}
              hitSlop={6}
              style={({ pressed }) => [
                styles.ingredientSelectionAction,
                pressed && styles.pressed,
              ]}
            >
              <MaterialCommunityIcons
                name={isSelected ? "check" : "plus"}
                size={20}
                color={theme.color.accent}
              />
            </Pressable>
          </View>
        );
      })}
    </>
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
    !meal.cuisine ? "cuisine" : null,
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
  const cuisineLabel = getCuisineLabel(detailCuisine) ?? "Not set";
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
    [cardScale, exitProgress, isCompleting, isLastIncomplete, reduceMotion]
  );

  const handleApplyIngredients = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const commit = () => onApply(selectedIngredients);
    const addsKeyIngredient = selectedIngredients.some(
      (ingredient) => ingredient.ingredientType !== "pantryStaple"
    );
    if (
      addsKeyIngredient &&
      typeof meal.difficulty === "number" &&
      typeof meal.expense === "number" &&
      Boolean(meal.cuisine)
    ) {
      finishMeal(commit);
      return;
    }
    commit();
  }, [finishMeal, meal.cuisine, meal.difficulty, meal.expense, onApply, selectedIngredients]);

  const detailsReady =
    typeof detailDifficulty === "number" &&
    typeof detailExpense === "number" &&
    Boolean(detailCuisine);
  const handleSaveDetails = useCallback(() => {
    if (!detailsReady) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {},
    );
    finishMeal(() =>
      onUpdateDetails({
        difficulty: detailDifficulty,
        expense: detailExpense,
        cuisine: detailCuisine,
      })
    );
  }, [detailCuisine, detailDifficulty, detailExpense, detailsReady, finishMeal, onUpdateDetails]);

  const handleSelectCuisine = useCallback(
    (cuisine: Meal["cuisine"]) => {
      setCuisineSelectorVisible(false);
      setDetailCuisine(cuisine);
    },
    []
  );

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
        <View style={styles.emojiWrap}><MealEmoji value={meal.emoji} size={38} /></View>
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>{meal.title}</Text>
          </View>
          <View style={styles.statusRow}>
            {isCompleting ? (
              <View style={styles.completionAnchor}>
                <MaterialCommunityIcons name="check" size={17} color={theme.color.success} />
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
          <View style={styles.ingredientList}>
            {renderSuggestions()}
          <View style={styles.manualRow}>
            <View style={styles.ingredientBulletSlot}>
              <View style={styles.manualBullet} />
            </View>
            <TextInput
              ref={manualInputRef}
              value={manualKey}
              onChangeText={setManualKey}
              onSubmitEditing={addManualIngredient}
              placeholder="Add Ingredient"
              placeholderTextColor={theme.color.subtleInk}
              style={styles.manualInput}
              returnKeyType="next"
              blurOnSubmit={false}
              autoCapitalize="words"
              onFocus={() => {
                isManualInputFocusedRef.current = true;
                onManualIngredientFocus?.();
              }}
              onBlur={() => {
                isManualInputFocusedRef.current = false;
              }}
            />
            {manualKey.trim() ? (
            <Pressable onPress={addManualIngredient} style={styles.addButton}>
              <MaterialCommunityIcons name="plus" size={22} color={theme.color.accent} />
            </Pressable>
            ) : null}
          </View>
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
            <Pressable
              onPress={() => setCuisineSelectorVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={`Cuisine, ${cuisineLabel}`}
              style={({ pressed }) => [styles.detailTile, pressed && styles.pressed]}
            >
              <Text style={styles.detailTileLabel}>Cuisine</Text>
              <View style={styles.detailValueRow}>
                <Text style={[styles.detailValue, !detailCuisine && styles.detailValueUnset]}>{cuisineLabel}</Text>
                {!detailCuisine ? <Text style={styles.detailAdd}>+</Text> : null}
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
      <CuisineSelectorModal
        visible={isCuisineSelectorVisible}
        selected={detailCuisine}
        mealTitle={meal.title}
        mealEmoji={meal.emoji}
        onSelect={handleSelectCuisine}
        onClose={() => setCuisineSelectorVisible(false)}
      />
      {/* Complete-tab recipe Auto Fill was intentionally removed.
      <Modal
        transparent
        visible={isAutoFillPromptVisible}
        animationType="fade"
        onRequestClose={closeAutoFillPrompt}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.autoFillModalRoot}
        >
          <Pressable style={styles.autoFillBackdrop} onPress={closeAutoFillPrompt} />
          <View style={styles.autoFillPrompt}>
            <View style={styles.autoFillPromptHeader}>
              <View style={styles.autoFillPromptIcon}>
                <MaterialCommunityIcons name="creation" size={20} color={theme.color.accent} />
              </View>
              <View style={styles.autoFillPromptCopy}>
                <Text style={styles.autoFillPromptTitle}>Auto Fill Meal</Text>
                {!pendingDifferentRecipe ? (
                  <Text style={styles.autoFillPromptDescription}>
                    Paste a recipe link to fill in the missing meal details.
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={closeAutoFillPrompt}
                accessibilityRole="button"
                accessibilityLabel="Close auto fill"
                style={styles.autoFillClose}
              >
                <MaterialCommunityIcons name="close" size={22} color={theme.color.ink} />
              </Pressable>
            </View>
            {pendingDifferentRecipe ? (
              <>
                <View style={styles.autoFillWarning}>
                  <MaterialCommunityIcons name="alert-outline" size={20} color={theme.color.warning} />
                  <Text style={styles.autoFillWarningText}>This looks like a different meal</Text>
                </View>
                <Text style={styles.autoFillMismatchCopy}>
                  The recipe you pasted appears to be different from “{meal.title}”.
                </Text>
                <View style={styles.detectedRecipeCard}>
                  <MaterialCommunityIcons name="creation" size={22} color={theme.color.accent} />
                  <View style={styles.detectedRecipeCopy}>
                    <Text style={styles.detectedRecipeLabel}>Detected recipe</Text>
                    <Text style={styles.detectedRecipeTitle}>{pendingDifferentRecipe.title}</Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => {
                    onReviewAutoFill("add", pendingDifferentRecipe.title, pendingDifferentRecipe.patch);
                    setAutoFillPromptVisible(false);
                    setPendingDifferentRecipe(null);
                    setRecipeUrlDraft("");
                    resetAutoFill();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Add ${pendingDifferentRecipe.title} as a new meal`}
                  style={({ pressed }) => [styles.mismatchAction, styles.mismatchActionPrimary, pressed && styles.pressed]}
                >
                  <View style={[styles.mismatchActionIcon, styles.mismatchActionIconPrimary]}>
                    <MaterialCommunityIcons name="plus" size={22} color={theme.color.accent} />
                  </View>
                  <View style={styles.mismatchActionCopy}>
                    <Text style={styles.mismatchActionTitle}>Add as a New Meal</Text>
                    <Text style={styles.mismatchActionDescription}>
                      Keep {meal.title} and add {pendingDifferentRecipe.title} as a new meal.
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={theme.color.accent} />
                </Pressable>
                <Pressable
                  onPress={() => {
                    onReviewAutoFill("replace", pendingDifferentRecipe.title, pendingDifferentRecipe.patch);
                    setAutoFillPromptVisible(false);
                    setPendingDifferentRecipe(null);
                    setRecipeUrlDraft("");
                    resetAutoFill();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Replace ${meal.title} with ${pendingDifferentRecipe.title}`}
                  style={({ pressed }) => [styles.mismatchAction, pressed && styles.pressed]}
                >
                  <View style={styles.mismatchActionIcon}>
                    <MaterialCommunityIcons name="sync" size={22} color={theme.color.subtleInk} />
                  </View>
                  <View style={styles.mismatchActionCopy}>
                    <Text style={styles.mismatchActionTitle}>Replace {meal.title}</Text>
                    <Text style={styles.mismatchActionDescription}>
                      Update {meal.title} with this recipe and fill in its details.
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={theme.color.subtleInk} />
                </Pressable>
                <Pressable
                  onPress={closeAutoFillPrompt}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel auto fill"
                  style={({ pressed }) => [styles.mismatchCancel, pressed && styles.pressed]}
                >
                  <Text style={styles.mismatchCancelText}>Cancel</Text>
                </Pressable>
              </>
            ) : (
            <><View style={styles.autoFillInputRow}>
              <MaterialCommunityIcons name="link-variant" size={18} color={theme.color.subtleInk} />
              <TextInput
                autoFocus
                value={recipeUrlDraft}
                onChangeText={(value) => {
                  setRecipeUrlDraft(value);
                  if (autoFillError) clearAutoFillError();
                }}
                onSubmitEditing={() => void handleRecipeAutoFill()}
                editable={!isAutoFillLoading}
                placeholder="Paste recipe URL…"
                placeholderTextColor={theme.color.subtleInk}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                style={styles.autoFillInput}
              />
            </View>
            {autoFillError ? (
              <Text style={styles.autoFillError} accessibilityRole="alert">
                {autoFillError}
              </Text>
            ) : null}
            <Pressable
              disabled={!recipeUrlDraft.trim() || isAutoFillLoading}
              onPress={() => void handleRecipeAutoFill()}
              accessibilityRole="button"
              accessibilityLabel="Auto fill meal from recipe"
              style={({ pressed }) => [
                styles.autoFillSubmit,
                (!recipeUrlDraft.trim() || isAutoFillLoading) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {isAutoFillLoading ? (
                <ActivityIndicator size="small" color={theme.color.ink} />
              ) : (
                <MaterialCommunityIcons name="creation" size={18} color={theme.color.ink} />
              )}
              <Text style={styles.autoFillSubmitText}>
                {isAutoFillLoading ? "Filling Meal…" : "Auto Fill"}
              </Text>
            </Pressable>
            </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal> */}
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
  titleRow: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
  title: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  statusRow: { flexDirection: "row", alignItems: "center", gap: theme.space.xs },
  statusDot: { width: 8, height: 8, borderRadius: theme.radius.full, backgroundColor: theme.color.warning },
  status: { color: theme.color.subtleInk, fontSize: theme.type.size.sm },
  statusComplete: { color: theme.color.success, fontWeight: theme.type.weight.bold },
  completionAnchor: { width: 17, height: 17, alignItems: "center", justifyContent: "center" },
  suggestionRow: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: theme.space.sm, paddingTop: theme.space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border },
  suggestionEmoji: { fontSize: 18 },
  suggestionLabel: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium },
  ingredientList: { gap: theme.space.xs },
  ingredientRow: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: theme.space.sm },
  ingredientBulletSlot: { width: 32, minHeight: 38, alignItems: "center", justifyContent: "center" },
  ingredientSelectionAction: { width: 36, minHeight: 38, alignItems: "center", justifyContent: "center" },
  ingredientText: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.medium, textTransform: "capitalize" },
  ingredientTextSelected: { color: theme.color.accent },
  manualRow: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: theme.space.sm },
  manualBullet: { width: 8, height: 8, borderRadius: theme.radius.full, backgroundColor: theme.color.accent },
  manualInput: { flex: 1, minHeight: 38, color: theme.color.ink, fontSize: theme.type.size.base, paddingHorizontal: 0 },
  addButton: { width: 36, height: 38, borderRadius: theme.radius.full, alignItems: "center", justifyContent: "center" },
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
  detailsGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.md },
  detailTile: { minWidth: "46%", flexGrow: 1, gap: theme.space.xs, padding: theme.space.md, borderRadius: theme.radius.md, backgroundColor: theme.color.surface },
  detailTileLabel: { color: theme.color.subtleInk, fontSize: theme.type.size.xs, textTransform: "uppercase", letterSpacing: 0.5 },
  detailValueRow: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
  detailDot: { width: 8, height: 8, borderRadius: theme.radius.full },
  detailValue: { color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  detailValueUnset: { color: theme.color.subtleInk, fontWeight: theme.type.weight.medium },
  detailAdd: { marginLeft: "auto", color: theme.color.accent, fontSize: theme.type.size.title, fontWeight: theme.type.weight.medium },
});

export default MealCompletionCard;
