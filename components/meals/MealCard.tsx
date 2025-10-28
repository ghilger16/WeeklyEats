import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { FlexGrid } from "../../styles/flex-grid";
import { Meal, MealDraft } from "../../types/meals";
import { useFeatureFlag } from "../../hooks/useFeatureFlags";
import { useRecipeAutoFill } from "../../hooks/useRecipeAutoFill";
import { supportsRecipeAutoFill } from "../../utils/recipeAutoFillCapability";
import RatingStars from "./RatingStars";

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

const AUTO_FILL_SELECTION_DEFAULT = {
  title: false,
  ingredients: false,
  difficulty: false,
  expense: false,
} as const;

type AutoFillSelectionKey = keyof typeof AUTO_FILL_SELECTION_DEFAULT;
type AutoFillSelectionState = Record<AutoFillSelectionKey, boolean>;

const labelForLevel = (
  value: number | undefined,
  levels: readonly { label: string; value: number }[]
): string | undefined => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return undefined;
  }

  const clamped = clampSliderValue(value);
  const match = levels.find((level) => level.value === clamped);
  return match?.label ?? `Level ${clamped}`;
};

const normalizeMeal = (meal: MealDraft | Meal): MealFormValues => ({
  id: meal.id,
  title: meal.title ?? "",
  emoji: meal.emoji ?? "🍽️",
  rating: meal.rating ?? 0,
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
  const autoFillFeatureFlag = useFeatureFlag("recipeAutoFillEnabled");
  const isAutoFillSupported = useMemo(() => supportsRecipeAutoFill(), []);
  const isAutoFillEnabled = autoFillFeatureFlag && isAutoFillSupported;
  const {
    isLoading: isAutoFillLoading,
    error: autoFillError,
    result: autoFillResult,
    requestAutoFill,
    resetAutoFill,
    clearError,
  } = useRecipeAutoFill(form.recipeUrl);
  const [isAutoFillPreviewVisible, setIsAutoFillPreviewVisible] =
    useState(false);
  const [autoFillSelection, setAutoFillSelection] =
    useState<AutoFillSelectionState>({
      ...AUTO_FILL_SELECTION_DEFAULT,
    });

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

  const handleToggleAutoFillSelection = useCallback(
    (field: AutoFillSelectionKey, value: boolean) => {
      setAutoFillSelection((prev) => ({
        ...prev,
        [field]: value,
      }));
    },
    []
  );

  const handleAutoFillPress = useCallback(async () => {
    clearError();
    const outcome = await requestAutoFill();
    if (!outcome.ok) {
      return;
    }

    const defaultSelection: AutoFillSelectionState = {
      ...AUTO_FILL_SELECTION_DEFAULT,
      title: Boolean(outcome.data.title) && form.title.trim().length === 0,
      ingredients:
        Boolean(outcome.data.ingredients?.length) &&
        (form.ingredients ?? []).length === 0,
      difficulty:
        typeof outcome.data.difficulty === "number" &&
        clampSliderValue(outcome.data.difficulty) !==
          clampSliderValue(form.difficulty ?? 3),
      expense:
        typeof outcome.data.expense === "number" &&
        clampSliderValue(outcome.data.expense) !==
          clampSliderValue(form.expense ?? 3),
    };

    setAutoFillSelection(defaultSelection);
    setIsAutoFillPreviewVisible(true);
  }, [
    clearError,
    requestAutoFill,
    form.title,
    form.ingredients,
    form.difficulty,
    form.expense,
  ]);

  const closeAutoFillPreview = useCallback(() => {
    setIsAutoFillPreviewVisible(false);
    setAutoFillSelection({ ...AUTO_FILL_SELECTION_DEFAULT });
    resetAutoFill();
  }, [resetAutoFill]);

  const handleConfirmAutoFill = useCallback(() => {
    if (!autoFillResult) {
      return;
    }

    if (autoFillSelection.title && autoFillResult.title) {
      updateField("title", autoFillResult.title);
    }

    if (
      autoFillSelection.ingredients &&
      autoFillResult.ingredients &&
      autoFillResult.ingredients.length > 0
    ) {
      updateField("ingredients", autoFillResult.ingredients);
    }

    if (
      autoFillSelection.difficulty &&
      typeof autoFillResult.difficulty === "number"
    ) {
      updateField("difficulty", clampSliderValue(autoFillResult.difficulty));
    }

    if (
      autoFillSelection.expense &&
      typeof autoFillResult.expense === "number"
    ) {
      updateField("expense", clampSliderValue(autoFillResult.expense));
    }

    closeAutoFillPreview();
  }, [autoFillResult, autoFillSelection, closeAutoFillPreview, updateField]);

  const isSaveDisabled = form.title.trim().length === 0;
  const hasAutoFillSelection = useMemo(
    () => Object.values(autoFillSelection).some(Boolean),
    [autoFillSelection]
  );
  const trimmedRecipeUrl = form.recipeUrl?.trim() ?? "";
  const isAutoFillButtonDisabled =
    !trimmedRecipeUrl.length || isAutoFillLoading;
  const autoFillFields = useMemo(() => {
    if (!autoFillResult) {
      return [] as Array<{
        key: AutoFillSelectionKey;
        label: string;
        value?: string;
        selectable: boolean;
      }>;
    }

    const difficultyLabel = labelForLevel(
      autoFillResult.difficulty,
      DIFFICULTY_LEVELS
    );
    const expenseLabel = labelForLevel(autoFillResult.expense, EXPENSE_LEVELS);

    return [
      {
        key: "title" as const,
        label: "Meal Title",
        value: autoFillResult.title,
        selectable: Boolean(autoFillResult.title),
      },
      {
        key: "ingredients" as const,
        label: "Key Ingredients",
        value: autoFillResult.ingredients?.length
          ? autoFillResult.ingredients.join("\n")
          : undefined,
        selectable: Boolean(autoFillResult.ingredients?.length),
      },
      {
        key: "difficulty" as const,
        label: "Difficulty",
        value: difficultyLabel,
        selectable: Boolean(difficultyLabel),
      },
      {
        key: "expense" as const,
        label: "Expense",
        value: expenseLabel,
        selectable: Boolean(expenseLabel),
      },
    ];
  }, [autoFillResult]);

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
                onChangeText={(value) => {
                  if (autoFillError) {
                    clearError();
                  }
                  if (autoFillResult) {
                    resetAutoFill();
                    setAutoFillSelection({ ...AUTO_FILL_SELECTION_DEFAULT });
                    setIsAutoFillPreviewVisible(false);
                  }
                  updateField("recipeUrl", value);
                }}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
            {isAutoFillEnabled ? (
              <View style={styles.autoFillBlock}>
                <Pressable
                  style={[
                    styles.autoFillButton,
                    isAutoFillButtonDisabled && styles.autoFillButtonDisabled,
                  ]}
                  disabled={isAutoFillButtonDisabled}
                  onPress={handleAutoFillPress}
                  accessibilityRole="button"
                  accessibilityLabel="Auto-fill meal details from recipe link"
                >
                  {isAutoFillLoading ? (
                    <ActivityIndicator color={theme.color.ink} size="small" />
                  ) : (
                    <Text style={styles.autoFillButtonText}>
                      Auto-fill from link
                    </Text>
                  )}
                </Pressable>
                {autoFillError ? (
                  <Text
                    style={styles.autoFillErrorText}
                    accessibilityRole="alert"
                  >
                    {autoFillError}
                  </Text>
                ) : null}
              </View>
            ) : null}
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
            <Text style={styles.sectionLabel}>Rating</Text>
            <FlexGrid.Row justifyContent="center">
              <RatingStars
                value={form.rating ?? 0}
                size={32}
                onChange={(next) => updateField("rating", next)}
                gap={theme.space.xl}
              />
            </FlexGrid.Row>
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

        <Modal
          transparent
          animationType="fade"
          visible={isAutoFillPreviewVisible && Boolean(autoFillResult)}
          onRequestClose={closeAutoFillPreview}
        >
          <View style={styles.autoFillModalBackdrop}>
            <View style={styles.autoFillModalContent}>
              <Text style={styles.autoFillModalTitle}>
                Apply recipe details?
              </Text>
              {autoFillResult?.summary ? (
                <Text style={styles.autoFillModalDescription}>
                  {autoFillResult.summary}
                </Text>
              ) : null}

              <View style={styles.autoFillFieldGroup}>
                {autoFillFields.map((field) => {
                  const isActive = autoFillSelection[field.key];
                  const isSelectable = field.selectable;
                  return (
                    <View style={styles.autoFillFieldRow} key={field.key}>
                      <View style={styles.autoFillFieldContent}>
                        <Text style={styles.autoFillFieldLabel}>
                          {field.label}
                        </Text>
                        <Text style={styles.autoFillFieldValue}>
                          {field.value ?? "No new suggestion"}
                        </Text>
                      </View>
                      <Switch
                        style={styles.autoFillSwitch}
                        value={isSelectable && isActive}
                        disabled={!isSelectable}
                        onValueChange={(value) =>
                          handleToggleAutoFillSelection(field.key, value)
                        }
                        trackColor={{
                          false: theme.color.surfaceAlt,
                          true: theme.color.accent,
                        }}
                        thumbColor={
                          isSelectable && isActive
                            ? theme.color.ink
                            : theme.color.surface
                        }
                      />
                    </View>
                  );
                })}
              </View>

              <View style={styles.autoFillModalActions}>
                <Pressable
                  style={styles.autoFillModalButton}
                  onPress={closeAutoFillPreview}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel applying auto-filled details"
                >
                  <Text style={styles.autoFillModalButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.autoFillModalButton,
                    styles.autoFillModalButtonPrimary,
                    !hasAutoFillSelection &&
                      styles.autoFillModalButtonPrimaryDisabled,
                  ]}
                  disabled={!hasAutoFillSelection}
                  onPress={handleConfirmAutoFill}
                  accessibilityRole="button"
                  accessibilityLabel="Apply the selected auto-filled details"
                >
                  <Text
                    style={[
                      styles.autoFillModalButtonText,
                      styles.autoFillModalButtonTextPrimary,
                      !hasAutoFillSelection &&
                        styles.autoFillModalButtonTextDisabled,
                    ]}
                  >
                    Apply
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

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
    autoFillBlock: {
      gap: theme.space.xs,
    },
    autoFillButton: {
      alignSelf: "flex-start",
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      backgroundColor: theme.color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: theme.space.sm,
    },
    autoFillButtonDisabled: {
      opacity: 0.6,
    },
    autoFillButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    autoFillErrorText: {
      color: theme.color.danger,
      fontSize: theme.type.size.sm,
    },
    autoFillModalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.35)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.space.xl,
    },
    autoFillModalContent: {
      width: "100%",
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      padding: theme.space.xl,
      gap: theme.space.lg,
    },
    autoFillModalTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    autoFillModalDescription: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
    },
    autoFillFieldGroup: {
      gap: theme.space.md,
    },
    autoFillFieldRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.space.md,
    },
    autoFillFieldContent: {
      flex: 1,
      gap: theme.space.xs,
    },
    autoFillFieldLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    autoFillFieldValue: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      lineHeight: theme.type.size.base * 1.3,
    },
    autoFillSwitch: {
      marginLeft: theme.space.sm,
    },
    autoFillModalActions: {
      flexDirection: "row",
      justifyContent: "flex-end",
      gap: theme.space.sm,
    },
    autoFillModalButton: {
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      backgroundColor: theme.color.surfaceAlt,
    },
    autoFillModalButtonPrimary: {
      backgroundColor: theme.color.accent,
      borderColor: theme.color.accent,
    },
    autoFillModalButtonPrimaryDisabled: {
      opacity: 0.5,
    },
    autoFillModalButtonText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    autoFillModalButtonTextPrimary: {
      color: theme.color.ink,
    },
    autoFillModalButtonTextDisabled: {
      color: theme.color.subtleInk,
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
