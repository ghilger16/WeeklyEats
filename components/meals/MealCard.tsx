import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  DimensionValue,
  GestureResponderEvent,
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  ViewStyle,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { FlexGrid } from "../../styles/flex-grid";
import { Meal, MealDraft } from "../../types/meals";

type MealCardProps = {
  mode: "create" | "edit";
  initialMeal: MealDraft | Meal;
  onClose: () => void;
  onCreateMeal: (draft: MealDraft) => void;
  onUpdateMeal: (meal: Meal) => void;
};

type MealFormValues = MealDraft;

const SLIDER_STEPS = 5;
type PercentString = `${number}%`;

const clampSliderValue = (value: number) =>
  Math.min(Math.max(Math.round(value), 1), SLIDER_STEPS);

const sliderValueToPercent = (value: number): PercentString => {
  const clamped = clampSliderValue(value);
  const ratio = (clamped - 1) / (SLIDER_STEPS - 1);
  return `${Math.round(ratio * 100)}%` as PercentString;
};

const normalizeMeal = (meal: MealDraft | Meal): MealFormValues => ({
  id: meal.id,
  title: meal.title ?? "",
  emoji: meal.emoji ?? "🍽️",
  rating: meal.rating ?? 3,
  plannedCostTier: meal.plannedCostTier ?? 2,
  locked: meal.locked ?? false,
  isFavorite: meal.isFavorite ?? false,
  recipeUrl: meal.recipeUrl ?? "",
  ingredients: meal.ingredients ? [...meal.ingredients] : [],
  difficulty: clampSliderValue(meal.difficulty ?? 3),
  expense: clampSliderValue(meal.expense ?? 3),
  createdAt: meal.createdAt,
  updatedAt: meal.updatedAt,
});

export default function MealCard({
  mode,
  initialMeal,
  onClose,
  onCreateMeal,
  onUpdateMeal,
}: MealCardProps) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [form, setForm] = useState<MealFormValues>(() =>
    normalizeMeal(initialMeal)
  );
  const [newIngredient, setNewIngredient] = useState("");
  const skipAutoSaveRef = useRef(true);
  const difficultyTrackWidth = useRef(1);
  const expenseTrackWidth = useRef(1);
  const isEditMode = mode === "edit";
  const title = isEditMode ? "Edit Meal" : "Add Meal";

  useEffect(() => {
    skipAutoSaveRef.current = true;
    setForm(normalizeMeal(initialMeal));
    setNewIngredient("");
  }, [initialMeal]);

  useEffect(() => {
    if (!isEditMode || !form.id) {
      return;
    }

    if (skipAutoSaveRef.current) {
      skipAutoSaveRef.current = false;
      return;
    }

    onUpdateMeal({
      ...(form as Meal),
      id: form.id,
      ingredients: form.ingredients ?? [],
      updatedAt: new Date().toISOString(),
    });
  }, [form, isEditMode, onUpdateMeal]);

  const updateField = useCallback(
    <K extends keyof MealFormValues>(key: K, value: MealFormValues[K]) => {
      setForm((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const handleSliderPress = useCallback(
    (key: "difficulty" | "expense") => (event: GestureResponderEvent) => {
      const { locationX } = event.nativeEvent;
      const trackWidth =
        key === "difficulty"
          ? difficultyTrackWidth.current
          : expenseTrackWidth.current;
      const ratio =
        trackWidth <= 0 ? 0 : Math.min(Math.max(locationX / trackWidth, 0), 1);
      const value = clampSliderValue(ratio * (SLIDER_STEPS - 1) + 1);
      updateField(key, value);
    },
    [updateField]
  );

  const handleTrackLayout = useCallback(
    (key: "difficulty" | "expense") => (event: LayoutChangeEvent) => {
      const width = event.nativeEvent.layout.width;
      if (width <= 0) {
        return;
      }
      if (key === "difficulty") {
        difficultyTrackWidth.current = width;
      } else {
        expenseTrackWidth.current = width;
      }
    },
    []
  );

  const difficultyStyles = useMemo(
    () => ({
      fill: {
        width: sliderValueToPercent(form.difficulty ?? 3) as DimensionValue,
      } as ViewStyle,
      thumb: {
        left: sliderValueToPercent(form.difficulty ?? 3) as DimensionValue,
      } as ViewStyle,
    }),
    [form.difficulty]
  );

  const expenseStyles = useMemo(
    () => ({
      fill: {
        width: sliderValueToPercent(form.expense ?? 3) as DimensionValue,
      } as ViewStyle,
      thumb: {
        left: sliderValueToPercent(form.expense ?? 3) as DimensionValue,
      } as ViewStyle,
    }),
    [form.expense]
  );

  const handleAddIngredient = useCallback(() => {
    const trimmed = newIngredient.trim();
    if (!trimmed) {
      return;
    }

    updateField("ingredients", [...(form.ingredients ?? []), trimmed]);
    setNewIngredient("");
  }, [form.ingredients, newIngredient, updateField]);

  const handleRemoveIngredient = useCallback(
    (index: number) => {
      updateField(
        "ingredients",
        (form.ingredients ?? []).filter((_, i) => i !== index)
      );
    },
    [form.ingredients, updateField]
  );

  const isSaveDisabled = form.title.trim().length === 0;

  const handleSubmit = useCallback(() => {
    if (isEditMode) {
      return;
    }

    const trimmedTitle = form.title.trim();
    if (!trimmedTitle) {
      return;
    }

    const { id: _, updatedAt: __, createdAt: ___, ...rest } = form;
    const sanitizedIngredients = (rest.ingredients ?? []).map((ingredient) =>
      ingredient.trim()
    );

    onCreateMeal({
      ...rest,
      title: trimmedTitle,
      recipeUrl: rest.recipeUrl?.trim() ?? "",
      ingredients: sanitizedIngredients,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    onClose();
  }, [form, isEditMode, onClose, onCreateMeal]);

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoid}
      >
        <FlexGrid gutterWidth={theme.space.lg} gutterHeight={theme.space.md}>
          <FlexGrid.Row alignItems="center" wrap={false}>
            <FlexGrid.Col grow={0}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back"
                onPress={onClose}
                style={styles.backButton}
              >
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={24}
                  color={theme.color.subtleInk}
                />
              </Pressable>
            </FlexGrid.Col>
            <FlexGrid.Col grow={1}>
              <Text style={styles.headerTitle}>{title}</Text>
            </FlexGrid.Col>
          </FlexGrid.Row>
        </FlexGrid>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Meal Title</Text>
            <TextInput
              placeholder="e.g. Chicken Stir Fry"
              placeholderTextColor={theme.color.subtleInk}
              style={styles.input}
              value={form.title}
              onChangeText={(value) => updateField("title", value)}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Recipe Link</Text>
            <View style={styles.linkInput}>
              <MaterialCommunityIcons
                name="link-variant"
                size={18}
                color={theme.color.subtleInk}
              />
              <TextInput
                placeholder="Paste recipe URL"
                placeholderTextColor={theme.color.subtleInk}
                style={styles.linkTextInput}
                value={form.recipeUrl}
                onChangeText={(value) => updateField("recipeUrl", value)}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Key Ingredients</Text>
            <View style={styles.ingredientsWrapper}>
              {(form.ingredients ?? []).length === 0 ? (
                <Text style={styles.ingredientsEmpty}>
                  Add a few highlights for this meal.
                </Text>
              ) : (
                (form.ingredients ?? []).map((ingredient, index) => (
                  <Pressable
                    key={`${ingredient}-${index}`}
                    style={styles.chip}
                    accessibilityRole="button"
                    accessibilityHint="Double tap to remove ingredient"
                    onPress={() => handleRemoveIngredient(index)}
                  >
                    <Text style={styles.chipText}>{ingredient}</Text>
                  </Pressable>
                ))
              )}
            </View>
            <View style={styles.addIngredientRow}>
              <TextInput
                placeholder="Add ingredient"
                placeholderTextColor={theme.color.subtleInk}
                style={styles.ingredientInput}
                value={newIngredient}
                onChangeText={setNewIngredient}
                onSubmitEditing={handleAddIngredient}
                returnKeyType="done"
              />
              <Pressable
                style={[
                  styles.addIngredientButton,
                  !newIngredient.trim() && styles.addIngredientButtonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Add ingredient"
                disabled={!newIngredient.trim()}
                onPress={handleAddIngredient}
              >
                <Text style={styles.addIngredientText}>Add</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Difficulty</Text>
            <Pressable
              style={styles.sliderTrack}
              onPress={handleSliderPress("difficulty")}
              onLayout={handleTrackLayout("difficulty")}
            >
              <View style={[styles.sliderFill, difficultyStyles.fill]} />
              <View style={[styles.sliderThumb, difficultyStyles.thumb]} />
            </Pressable>
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabelText}>Easy</Text>
              <Text style={styles.sliderLabelText}>Hard</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Expense</Text>
            <Pressable
              style={styles.sliderTrack}
              onPress={handleSliderPress("expense")}
              onLayout={handleTrackLayout("expense")}
            >
              <View
                style={[
                  styles.sliderFill,
                  styles.sliderFillExpense,
                  expenseStyles.fill,
                ]}
              />
              <View
                style={[
                  styles.sliderThumb,
                  styles.sliderThumbExpense,
                  expenseStyles.thumb,
                ]}
              />
            </Pressable>
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabelText}>Cheap</Text>
              <Text style={styles.sliderLabelText}>Pricey</Text>
            </View>
          </View>

          <View style={styles.section}>
            <FlexGrid.Row alignItems="center" justifyContent="space-between">
              <FlexGrid.Col grow={1}>
                <Text style={styles.sectionLabel}>Lock every Tuesday?</Text>
              </FlexGrid.Col>
              <FlexGrid.Col grow={0}>
                <Switch
                  value={form.locked}
                  onValueChange={(value) => updateField("locked", value)}
                  thumbColor={form.locked ? theme.color.accent : undefined}
                  trackColor={{
                    false: theme.color.surfaceAlt,
                    true: theme.color.surfaceAlt,
                  }}
                />
              </FlexGrid.Col>
            </FlexGrid.Row>
          </View>
        </ScrollView>

        {!isEditMode ? (
          <View style={styles.footer}>
            <Pressable
              style={[
                styles.saveButton,
                isSaveDisabled && styles.saveButtonDisabled,
              ]}
              disabled={isSaveDisabled}
              onPress={handleSubmit}
              accessibilityRole="button"
              accessibilityLabel="Save meal"
            >
              <Text
                style={[
                  styles.saveText,
                  isSaveDisabled && styles.saveTextDisabled,
                ]}
              >
                Save Meal
              </Text>
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.color.bg,
    },
    keyboardAvoid: {
      flex: 1,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    headerTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
    },
    scrollContent: {
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space["2xl"],
      paddingBottom: theme.space["2xl"],
      gap: theme.space["2xl"],
    },
    section: {
      gap: theme.space.md,
    },
    sectionLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    input: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.md,
      paddingVertical: theme.space.md,
      paddingHorizontal: theme.space.lg,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    linkInput: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.md,
      gap: theme.space.md,
    },
    linkTextInput: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    ingredientsWrapper: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.sm,
    },
    ingredientsEmpty: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
    },
    chip: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.md,
      paddingVertical: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    chipText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    addIngredientRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    ingredientInput: {
      flex: 1,
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.md,
      paddingVertical: theme.space.sm,
      paddingHorizontal: theme.space.md,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    addIngredientButton: {
      paddingHorizontal: theme.space.md,
      paddingVertical: 6,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.accent,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    addIngredientButtonDisabled: {
      backgroundColor: theme.color.surfaceAlt,
    },
    addIngredientText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    sliderTrack: {
      height: theme.component.slider.trackHeight,
      borderRadius: theme.component.slider.trackHeight / 2,
      backgroundColor: theme.color.surfaceAlt,
      position: "relative",
      overflow: "hidden",
      justifyContent: "center",
    },
    sliderFill: {
      position: "absolute",
      left: 0,
      top: 0,
      bottom: 0,
      backgroundColor: theme.color.accent,
      width: "0%",
    },
    sliderFillExpense: {
      backgroundColor: theme.color.success,
    },
    sliderThumb: {
      position: "absolute",
      top:
        -(theme.component.slider.thumbSize / 2 -
          theme.component.slider.trackHeight / 2),
      left: "0%",
      width: theme.component.slider.thumbSize,
      height: theme.component.slider.thumbSize,
      borderRadius: theme.component.slider.thumbSize / 2,
      backgroundColor: theme.color.accent,
      borderWidth: 2,
      borderColor: theme.color.bg,
      transform: [{ translateX: -(theme.component.slider.thumbSize / 2) }],
    },
    sliderThumbExpense: {
      backgroundColor: theme.color.success,
    },
    sliderLabels: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    sliderLabelText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    footer: {
      paddingHorizontal: theme.space.xl,
      paddingBottom: theme.space["2xl"],
      paddingTop: theme.space.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border,
      backgroundColor: theme.color.bg,
    },
    saveButton: {
      height: theme.component.button.height,
      borderRadius: theme.component.button.radius,
      backgroundColor: theme.color.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    saveTextDisabled: {
      color: theme.color.subtleInk,
    },
  });
