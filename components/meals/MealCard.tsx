import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
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

const clampSliderValue = (value: number) =>
  Math.min(Math.max(Math.round(value), 1), SLIDER_STEPS);

const DIFFICULTY_LEVELS = [
  { label: "Easy", value: 1 as const },
  { label: "Medium", value: 3 as const },
  { label: "Hard", value: 5 as const },
];

const EXPENSE_LEVELS = [
  { label: "Cheap", value: 1 as const },
  { label: "Medium", value: 3 as const },
  { label: "Pricey", value: 5 as const },
];

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
  const isEditMode = mode === "edit";

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
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Difficulty</Text>
            <View style={styles.levelChipRow}>
              {DIFFICULTY_LEVELS.map(({ label, value }) => {
                const isSelected = form.difficulty === value;
                return (
                  <Pressable
                    key={label}
                    style={[
                      styles.levelChip,
                      isSelected && styles.levelChipSelected,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Set difficulty to ${label}`}
                    onPress={() => updateField("difficulty", value)}
                  >
                    <Text
                      style={[
                        styles.levelChipText,
                        isSelected && styles.levelChipTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Expense</Text>
            <View style={styles.levelChipRow}>
              {EXPENSE_LEVELS.map(({ label, value }) => {
                const isSelected = form.expense === value;
                return (
                  <Pressable
                    key={label}
                    style={[
                      styles.levelChip,
                      isSelected && styles.levelChipSelectedExpense,
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Set expense to ${label}`}
                    onPress={() => updateField("expense", value)}
                  >
                    <Text
                      style={[
                        styles.levelChipText,
                        isSelected && styles.levelChipTextSelected,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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
    levelChipRow: {
      flexDirection: "row",
      gap: theme.space.sm,
    },
    levelChip: {
      flex: 1,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      backgroundColor: theme.color.surface,
      paddingVertical: theme.space.sm,
      alignItems: "center",
      justifyContent: "center",
    },
    levelChipSelected: {
      backgroundColor: theme.color.accent,
      borderColor: theme.color.accent,
    },
    levelChipSelectedExpense: {
      backgroundColor: theme.color.success,
      borderColor: theme.color.success,
    },
    levelChipText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    levelChipTextSelected: {
      color: theme.color.ink,
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
