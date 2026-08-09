import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
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
import { alpha, WeeklyTheme } from "../../styles/theme";
import { FlexGrid } from "../../styles/flex-grid";
import {
  FamilyRatingValue,
  Ingredient,
  IngredientType,
  Meal,
  MealDraft,
  ShoppingCategory,
} from "../../types/meals";
import { useFeatureFlag } from "../../hooks/useFeatureFlags";
import { useRecipeAutoFill } from "../../hooks/useRecipeAutoFill";
import { supportsRecipeAutoFill } from "../../utils/recipeAutoFillCapability";
import RatingStars from "./RatingStars";
import FamilyRatingIcons from "./FamilyRatingIcons";
import EmojiPickerModal from "../emoji/EmojiPickerModal";
import {
  DEFAULT_MEAL_EMOJI,
  suggestEmojiForTitle,
} from "../../utils/emojiCatalog";
import { useFamilyMembers } from "../../hooks/useFamilyMembers";
import { setFamilyRatingValue } from "../../utils/familyRatings";

type MealCardProps = {
  mode: "create" | "edit";
  initialMeal: MealDraft | Meal;
  autoFillOnOpen?: boolean;
  onClose: () => void;
  onCreateMeal: (draft: MealDraft) => void;
  onUpdateMeal: (meal: Meal) => void;
};

type MealFormValues = MealDraft;

type AddMealStep = "entry" | "manual" | "autofill-loading";

const SLIDER_STEPS = 5;

type IngredientValue =
  | string
  | { name?: unknown; category?: unknown; ingredientType?: unknown };

const SHOPPING_CATEGORIES: ShoppingCategory[] = [
  "produce",
  "meat",
  "seafood",
  "dairy",
  "bakery",
  "deli",
  "frozen",
  "pantry",
  "canned",
  "pastaAndRice",
  "spices",
  "condiments",
  "baking",
  "beverages",
  "snacks",
  "household",
  "other",
];

const normalizeCategory = (value: unknown): ShoppingCategory =>
  typeof value === "string" &&
  SHOPPING_CATEGORIES.includes(value as ShoppingCategory)
    ? (value as ShoppingCategory)
    : "other";

const normalizeIngredientType = (value: unknown): IngredientType =>
  value === "pantryStaple" ? "pantryStaple" : "keyIngredient";

const clampSliderValue = (value: number) =>
  Math.min(Math.max(Math.round(value), 1), SLIDER_STEPS);

const snapToLevelValue = (
  value: number,
  levels: readonly { value: number }[]
) => {
  const clamped = clampSliderValue(value);
  if (levels.length === 0) {
    return clamped;
  }

  return levels.reduce((closest, level) => {
    const distance = Math.abs(level.value - clamped);
    const closestDistance = Math.abs(closest - clamped);
    if (distance < closestDistance) {
      return level.value;
    }
    if (distance === closestDistance && level.value > closest) {
      return level.value;
    }
    return closest;
  }, levels[0].value);
};

const DIFFICULTY_LEVELS = [
  { label: "Easy", value: 1 as const, colorKey: "success" as const },
  { label: "Medium", value: 3 as const, colorKey: "warning" as const },
  { label: "Hard", value: 5 as const, colorKey: "danger" as const },
];

const EXPENSE_LEVELS = [
  { label: "$", value: 1 as const },
  { label: "$$", value: 3 as const },
  { label: "$$$", value: 5 as const },
];

const capitalizeMealTitleWords = (value: string) =>
  value.replace(/(^|[\s-/])([a-z])/g, (match, prefix, letter) =>
    `${prefix}${letter.toUpperCase()}`
  );

type AutoFillPreviewDraft = {
  title: string;
  ingredients: IngredientValue[];
  difficulty?: number;
  expense?: number;
  prepNotes: string;
};

const getIngredientName = (ingredient: IngredientValue) => {
  if (typeof ingredient === "string") {
    return ingredient.trim();
  }
  if (
    ingredient &&
    typeof ingredient === "object" &&
    typeof ingredient.name === "string"
  ) {
    return ingredient.name.trim();
  }
  return "";
};

const normalizeIngredientValue = (
  ingredient: IngredientValue
): Ingredient | null => {
  const name = getIngredientName(ingredient);
  if (!name) {
    return null;
  }
  if (typeof ingredient === "string") {
    return {
      name,
      category: "other",
      ingredientType: "keyIngredient",
    };
  }
  return {
    name,
    category: normalizeCategory(ingredient.category),
    ingredientType: normalizeIngredientType(ingredient.ingredientType),
  };
};

const isIngredient = (ingredient: Ingredient | null): ingredient is Ingredient =>
  Boolean(ingredient);

const createManualIngredient = (
  name: string,
  ingredientType: IngredientType = "keyIngredient"
): Ingredient => ({
  name,
  category: "other",
  ingredientType,
});

const toggleIngredientType = (ingredient: Ingredient): Ingredient => ({
  ...ingredient,
  ingredientType:
    ingredient.ingredientType === "pantryStaple"
      ? "keyIngredient"
      : "pantryStaple",
});

const normalizeMeal = (meal: MealDraft | Meal): MealFormValues => ({
  id: meal.id,
  title: meal.title ?? "",
  emoji: meal.emoji ?? "🍽️",
  rating: meal.rating ?? 0,
  familyRatings:
    meal.familyRatings && Object.keys(meal.familyRatings).length > 0
      ? { ...meal.familyRatings }
      : undefined,
  servedCount:
    typeof meal.servedCount === "number" && meal.servedCount >= 0
      ? meal.servedCount
      : 0,
  showServedCount: Boolean(meal.showServedCount),
  plannedCostTier: meal.plannedCostTier ?? 2,
  locked: meal.locked ?? false,
  isFavorite: meal.isFavorite ?? false,
  recipeUrl: meal.recipeUrl ?? "",
  ingredients: meal.ingredients
    ? (meal.ingredients as IngredientValue[])
        .map(normalizeIngredientValue)
        .filter(isIngredient)
    : [],
  difficulty: snapToLevelValue(meal.difficulty ?? 3, DIFFICULTY_LEVELS),
  expense: snapToLevelValue(meal.expense ?? 3, EXPENSE_LEVELS),
  prepNotes: meal.prepNotes ?? "",
  freezerAmount:
    "freezerAmount" in meal && meal.freezerAmount !== undefined
      ? meal.freezerAmount ?? ""
      : meal.freezerQuantity ?? "",
  freezerUnit: meal.freezerUnit ?? "",
  freezerAddedAt: meal.freezerAddedAt,
  createdAt: meal.createdAt,
  updatedAt: meal.updatedAt,
});

export default function MealCard({
  mode,
  initialMeal,
  autoFillOnOpen = false,
  onClose,
  onCreateMeal,
  onUpdateMeal,
}: MealCardProps) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scrollRef = useRef<ScrollView | null>(null);
  const autoFillScrollRef = useRef<ScrollView | null>(null);
  const notesSectionOffsetRef = useRef(0);
  const autoFillNotesSectionOffsetRef = useRef(0);
  const prevMealKeyRef = useRef<string | undefined>(undefined);
  const [form, setForm] = useState<MealFormValues>(() =>
    normalizeMeal(initialMeal)
  );
  const [prepNotesDraft, setPrepNotesDraft] = useState(
    () => form.prepNotes ?? ""
  );
  const [newIngredient, setNewIngredient] = useState("");
  const [newPantryIngredient, setNewPantryIngredient] = useState("");
  const [isIngredientDeleteMode, setIsIngredientDeleteMode] = useState(false);
  const skipAutoSaveRef = useRef(true);
  const isEditMode = mode === "edit";
  const autoFillFeatureFlag = useFeatureFlag("recipeAutoFillEnabled");
  const isAutoFillSupported = useMemo(() => supportsRecipeAutoFill(), []);
  const isAutoFillEnabled = autoFillFeatureFlag && isAutoFillSupported;
  const { members } = useFamilyMembers();
  const hasFamilyMembers = members.length > 0;
  const { familyAverageStars, familyCount } = useMemo(() => {
    if (!form.familyRatings) {
      return { familyAverageStars: null, familyCount: 0 };
    }
    const mapped = Object.values(form.familyRatings)
      .map((value) => {
        if (value === 3) return 5;
        if (value === 2) return 3;
        if (value === 1) return 1;
        return 0;
      })
      .filter((value) => value > 0);
    if (mapped.length === 0) {
      return { familyAverageStars: null, familyCount: 0 };
    }
    const total = mapped.reduce<number>((sum, value) => sum + value, 0);
    return {
      familyAverageStars: total / mapped.length,
      familyCount: mapped.length,
    };
  }, [form.familyRatings]);
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
  const [autoFillDraft, setAutoFillDraft] =
    useState<AutoFillPreviewDraft | null>(null);
  const [autoFillKeyboardHeight, setAutoFillKeyboardHeight] = useState(0);
  const [newAutoFillIngredient, setNewAutoFillIngredient] = useState("");
  const [newAutoFillPantryIngredient, setNewAutoFillPantryIngredient] =
    useState("");
  const [
    isAutoFillIngredientDeleteMode,
    setIsAutoFillIngredientDeleteMode,
  ] = useState(false);
  const autoFillTriggeredRef = useRef(false);
  const [isEmojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [showTitleRequiredError, setShowTitleRequiredError] = useState(false);
  const [addMealStep, setAddMealStep] = useState<AddMealStep>(
    mode === "edit" ? "manual" : "entry"
  );
  const [completedLoadingSteps, setCompletedLoadingSteps] = useState(0);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSub = Keyboard.addListener(showEvent, (event) => {
      setAutoFillKeyboardHeight(event.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      setAutoFillKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const suggestedEmoji = useMemo(
    () => suggestEmojiForTitle(form.title),
    [form.title]
  );

  const showEmojiSuggestion = useMemo(() => {
    if (!suggestedEmoji) {
      return false;
    }
    if (form.emoji === suggestedEmoji) {
      return false;
    }
    return true;
  }, [form.emoji, suggestedEmoji]);

  useEffect(() => {
    const servedKey =
      "servedCount" in initialMeal &&
      typeof initialMeal.servedCount === "number"
        ? initialMeal.servedCount
        : 0;
    const showKey =
      "showServedCount" in initialMeal && initialMeal.showServedCount
        ? "1"
        : "0";
    const updatedKey =
      "updatedAt" in initialMeal && initialMeal.updatedAt
        ? initialMeal.updatedAt
        : "na";
    const mealKey = `${mode}-${
      initialMeal.id ?? "draft"
    }-${updatedKey}-${servedKey}-${showKey}`;
    if (prevMealKeyRef.current === mealKey) {
      return;
    }

    prevMealKeyRef.current = mealKey;
    skipAutoSaveRef.current = true;
    const normalized = normalizeMeal(initialMeal);
    setForm(normalized);
    setPrepNotesDraft(normalized.prepNotes ?? "");
    setNewIngredient("");
    setNewPantryIngredient("");
    setShowTitleRequiredError(false);
    autoFillTriggeredRef.current = false;
    setAddMealStep(mode === "edit" ? "manual" : "entry");
    setCompletedLoadingSteps(0);
  }, [initialMeal, mode]);

  useEffect(() => {
    if (addMealStep !== "autofill-loading" || !isAutoFillLoading) {
      return;
    }

    setCompletedLoadingSteps(0);
    const findingTimer = setTimeout(() => setCompletedLoadingSteps(1), 350);
    const ingredientsTimer = setTimeout(
      () => setCompletedLoadingSteps(2),
      1100
    );

    return () => {
      clearTimeout(findingTimer);
      clearTimeout(ingredientsTimer);
    };
  }, [addMealStep, isAutoFillLoading]);

  useEffect(() => {
    setPrepNotesDraft((prev) => {
      const next = form.prepNotes ?? "";
      return prev === next ? prev : next;
    });
  }, [form.prepNotes]);

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
      if (
        key === "title" &&
        typeof value === "string" &&
        value.trim().length > 0
      ) {
        setShowTitleRequiredError(false);
      }
      setForm((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  const handleFamilyRatingChange = useCallback(
    (memberId: string, rating: FamilyRatingValue) => {
      setForm((prev) => ({
        ...prev,
        familyRatings: setFamilyRatingValue(
          prev.familyRatings,
          memberId,
          rating
        ),
      }));
    },
    []
  );

  const handleAddIngredient = useCallback(() => {
    const trimmed = newIngredient.trim();
    if (!trimmed) {
      return;
    }

    updateField("ingredients", [
      ...(form.ingredients ?? []),
      createManualIngredient(trimmed),
    ]);
    setNewIngredient("");
    setIsIngredientDeleteMode(false);
  }, [form.ingredients, newIngredient, updateField]);

  const handleAddPantryIngredient = useCallback(() => {
    const trimmed = newPantryIngredient.trim();
    if (!trimmed) {
      return;
    }

    updateField("ingredients", [
      ...(form.ingredients ?? []),
      createManualIngredient(trimmed, "pantryStaple"),
    ]);
    setNewPantryIngredient("");
    setIsIngredientDeleteMode(false);
  }, [form.ingredients, newPantryIngredient, updateField]);

  const handleOpenEmojiPicker = useCallback(() => {
    Keyboard.dismiss();
    setEmojiPickerVisible(true);
  }, []);

  const handleCloseEmojiPicker = useCallback(() => {
    setEmojiPickerVisible(false);
  }, []);

  const handlePickEmoji = useCallback(
    (emoji: string) => {
      updateField("emoji", emoji);
    },
    [updateField]
  );

  const handleApplySuggestedEmoji = useCallback(() => {
    if (!suggestedEmoji) {
      return;
    }
    updateField("emoji", suggestedEmoji);
  }, [suggestedEmoji, updateField]);

  const handleRemoveIngredient = useCallback(
    (index: number) => {
      updateField(
        "ingredients",
        (form.ingredients ?? []).filter((_, i) => i !== index)
      );
    },
    [form.ingredients, updateField]
  );

  const normalizedIngredientEntries = useMemo(
    () =>
      (form.ingredients ?? [])
        .map((ingredient, index) => ({
          ingredient: normalizeIngredientValue(ingredient as IngredientValue),
          index,
        }))
        .filter(
          (
            entry
          ): entry is {
            ingredient: Ingredient;
            index: number;
          } => Boolean(entry.ingredient)
        ),
    [form.ingredients]
  );
  const keyIngredientEntries = useMemo(
    () =>
      normalizedIngredientEntries.filter(
        (entry) => entry.ingredient.ingredientType === "keyIngredient"
      ),
    [normalizedIngredientEntries]
  );
  const pantryStapleEntries = useMemo(
    () =>
      normalizedIngredientEntries.filter(
        (entry) => entry.ingredient.ingredientType === "pantryStaple"
      ),
    [normalizedIngredientEntries]
  );
  const hasIngredients = normalizedIngredientEntries.length > 0;
  const handleToggleIngredientDeleteMode = useCallback(() => {
    if (!hasIngredients) {
      return;
    }
    setIsIngredientDeleteMode((prev) => !prev);
  }, [hasIngredients]);

  const handleToggleIngredientType = useCallback(
    (index: number) => {
      updateField(
        "ingredients",
        (form.ingredients ?? []).map((ingredient, i) => {
          if (i !== index) {
            return ingredient;
          }
          const normalized = normalizeIngredientValue(
            ingredient as IngredientValue
          );
          return normalized ? toggleIngredientType(normalized) : ingredient;
        })
      );
    },
    [form.ingredients, updateField]
  );

  const handleAutoFillPress = useCallback(async () => {
    clearError();
    if (!isEditMode) {
      setAddMealStep("autofill-loading");
    }
    const outcome = await requestAutoFill();
    if (!outcome.ok) {
      if (!isEditMode) {
        setAddMealStep("entry");
      }
      return;
    }

    setCompletedLoadingSteps(3);

    const normalizedDifficulty =
      typeof outcome.data.difficulty === "number"
        ? snapToLevelValue(outcome.data.difficulty, DIFFICULTY_LEVELS)
        : undefined;
    const normalizedExpense =
      typeof outcome.data.expense === "number"
        ? snapToLevelValue(outcome.data.expense, EXPENSE_LEVELS)
        : undefined;

    const normalizedIngredients = Array.isArray(outcome.data.ingredients)
      ? (outcome.data.ingredients as IngredientValue[])
          .map(normalizeIngredientValue)
          .filter(isIngredient)
      : [];

    setAutoFillDraft({
      title: outcome.data.title?.trim() ?? "",
      ingredients: normalizedIngredients,
      difficulty: normalizedDifficulty,
      expense: normalizedExpense,
      prepNotes: outcome.data.prepNotes?.trim() ?? "",
    });
    setNewAutoFillIngredient("");
    setNewAutoFillPantryIngredient("");
    setIsAutoFillIngredientDeleteMode(false);
    if (!isEditMode) {
      setAddMealStep("manual");
    }
    setIsAutoFillPreviewVisible(true);
  }, [clearError, isEditMode, requestAutoFill]);

  useEffect(() => {
    if (!autoFillOnOpen) {
      return;
    }
    if (autoFillTriggeredRef.current) {
      return;
    }
    if (!isAutoFillEnabled) {
      return;
    }
    if (!form.recipeUrl?.trim()) {
      return;
    }
    autoFillTriggeredRef.current = true;
    handleAutoFillPress();
  }, [autoFillOnOpen, form.recipeUrl, handleAutoFillPress, isAutoFillEnabled]);

  const closeAutoFillPreview = useCallback(() => {
    setIsAutoFillPreviewVisible(false);
    setAutoFillDraft(null);
    setNewAutoFillIngredient("");
    setNewAutoFillPantryIngredient("");
    setIsAutoFillIngredientDeleteMode(false);
    resetAutoFill();
    if (!isEditMode) {
      setAddMealStep("entry");
    }
  }, [isEditMode, resetAutoFill]);

  const createMealFromValues = useCallback(
    (values: MealFormValues, prepNotesValue: string) => {
      const trimmedTitle = values.title.trim();
      if (!trimmedTitle) {
        setShowTitleRequiredError(true);
        return false;
      }

      const { id: _, updatedAt: __, createdAt: ___, ...rest } = values;
      const sanitizedIngredients = (rest.ingredients ?? [])
        .map((ingredient) =>
          normalizeIngredientValue(ingredient as IngredientValue)
        )
        .filter(isIngredient);
      const sanitizedPrepNotes = prepNotesValue.trim();
      const normalizedFamilyRatings =
        rest.familyRatings && Object.keys(rest.familyRatings).length > 0
          ? rest.familyRatings
          : undefined;

      onCreateMeal({
        ...rest,
        title: trimmedTitle,
        recipeUrl: rest.recipeUrl?.trim() ?? "",
        ingredients: sanitizedIngredients,
        prepNotes: sanitizedPrepNotes,
        familyRatings: normalizedFamilyRatings,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      onClose();
      return true;
    },
    [onClose, onCreateMeal]
  );

  const handleConfirmAutoFill = useCallback(() => {
    if (!autoFillDraft) {
      return;
    }

    const nextForm: MealFormValues = { ...form };
    let nextPrepNotesDraft = prepNotesDraft;

    if (autoFillDraft.title.trim()) {
      nextForm.title = autoFillDraft.title.trim();
      const nextEmoji = suggestEmojiForTitle(autoFillDraft.title);
      if (nextEmoji) {
        nextForm.emoji = nextEmoji;
      }
    }

    const cleanedIngredients = autoFillDraft.ingredients
      .map((ingredient) => normalizeIngredientValue(ingredient as IngredientValue))
      .filter(isIngredient);
    if (cleanedIngredients.length > 0) {
      nextForm.ingredients = cleanedIngredients;
    }

    if (typeof autoFillDraft.difficulty === "number") {
      nextForm.difficulty = autoFillDraft.difficulty;
    }

    if (typeof autoFillDraft.expense === "number") {
      nextForm.expense = autoFillDraft.expense;
    }

    if (autoFillDraft.prepNotes.trim()) {
      nextForm.prepNotes = autoFillDraft.prepNotes.trim();
      nextPrepNotesDraft = autoFillDraft.prepNotes.trim();
    }

    if (!isEditMode) {
      if (!createMealFromValues(nextForm, nextPrepNotesDraft)) {
        return;
      }
      closeAutoFillPreview();
      return;
    }

    setForm(nextForm);
    setPrepNotesDraft(nextPrepNotesDraft);
    closeAutoFillPreview();
  }, [
    autoFillDraft,
    closeAutoFillPreview,
    createMealFromValues,
    form,
    isEditMode,
    prepNotesDraft,
  ]);

  const isCreateDirty = useMemo(() => {
    if (isEditMode) {
      return false;
    }
    const initial = normalizeMeal(initialMeal);
    return (
      form.title.trim().length > 0 ||
      (form.recipeUrl ?? "").trim().length > 0 ||
      (form.ingredients ?? []).length > 0 ||
      (prepNotesDraft ?? "").trim().length > 0 ||
      form.emoji !== initial.emoji ||
      form.rating !== initial.rating ||
      form.difficulty !== initial.difficulty ||
      form.expense !== initial.expense ||
      Boolean(form.isFavorite) !== Boolean(initial.isFavorite)
    );
  }, [form, initialMeal, isEditMode, prepNotesDraft]);
  const hasAutoFillSelection = useMemo(
    () =>
      Boolean(
        autoFillDraft?.title.trim() ||
          autoFillDraft?.ingredients.length ||
          autoFillDraft?.difficulty ||
          autoFillDraft?.expense ||
          autoFillDraft?.prepNotes.trim()
      ),
    [autoFillDraft]
  );
  const trimmedRecipeUrl = form.recipeUrl?.trim() ?? "";
  const isAutoFillButtonDisabled =
    !trimmedRecipeUrl.length || isAutoFillLoading;
  const autoFillPreviewEmoji = useMemo(
    () =>
      autoFillDraft?.title
        ? suggestEmojiForTitle(autoFillDraft.title) ?? form.emoji
        : form.emoji,
    [autoFillDraft?.title, form.emoji]
  );
  const autoFillIngredientEntries = useMemo(
    () =>
      (autoFillDraft?.ingredients ?? [])
        .map((ingredient, index) => ({
          ingredient: normalizeIngredientValue(ingredient as IngredientValue),
          index,
        }))
        .filter(
          (
            entry
          ): entry is {
            ingredient: Ingredient;
            index: number;
          } => Boolean(entry.ingredient)
        ),
    [autoFillDraft?.ingredients]
  );
  const autoFillKeyIngredientEntries = useMemo(
    () =>
      autoFillIngredientEntries.filter(
        (entry) => entry.ingredient.ingredientType === "keyIngredient"
      ),
    [autoFillIngredientEntries]
  );
  const autoFillPantryStapleEntries = useMemo(
    () =>
      autoFillIngredientEntries.filter(
        (entry) => entry.ingredient.ingredientType === "pantryStaple"
      ),
    [autoFillIngredientEntries]
  );

  const updateAutoFillDraft = useCallback(
    <K extends keyof AutoFillPreviewDraft>(
      key: K,
      value: AutoFillPreviewDraft[K]
    ) => {
      setAutoFillDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    []
  );

  const handleAddAutoFillIngredient = useCallback(() => {
    const trimmed = newAutoFillIngredient.trim();
    if (!trimmed) {
      return;
    }
    setAutoFillDraft((prev) =>
      prev
        ? {
            ...prev,
            ingredients: [...prev.ingredients, createManualIngredient(trimmed)],
          }
        : prev
    );
    setNewAutoFillIngredient("");
    setIsAutoFillIngredientDeleteMode(false);
  }, [newAutoFillIngredient]);

  const handleAddAutoFillPantryIngredient = useCallback(() => {
    const trimmed = newAutoFillPantryIngredient.trim();
    if (!trimmed) {
      return;
    }
    setAutoFillDraft((prev) =>
      prev
        ? {
            ...prev,
            ingredients: [
              ...prev.ingredients,
              createManualIngredient(trimmed, "pantryStaple"),
            ],
          }
        : prev
    );
    setNewAutoFillPantryIngredient("");
    setIsAutoFillIngredientDeleteMode(false);
  }, [newAutoFillPantryIngredient]);

  const handleRemoveAutoFillIngredient = useCallback((index: number) => {
    setAutoFillDraft((prev) =>
      prev
        ? {
            ...prev,
            ingredients: prev.ingredients.filter((_, i) => i !== index),
          }
        : prev
    );
  }, []);

  const handleToggleAutoFillIngredientType = useCallback((index: number) => {
    setAutoFillDraft((prev) =>
      prev
        ? {
            ...prev,
            ingredients: prev.ingredients.map((ingredient, i) => {
              if (i !== index) {
                return ingredient;
              }
              const normalized = normalizeIngredientValue(
                ingredient as IngredientValue
              );
              return normalized ? toggleIngredientType(normalized) : ingredient;
            }),
          }
        : prev
    );
  }, []);

  const scrollAutoFillNotesIntoView = useCallback(() => {
    setTimeout(() => {
      autoFillScrollRef.current?.scrollTo({
        y: Math.max(autoFillNotesSectionOffsetRef.current - theme.space.lg, 0),
        animated: true,
      });
    }, Platform.OS === "ios" ? 260 : 120);
  }, [theme.space.lg]);

  const handleSubmit = useCallback(() => {
    if (isEditMode) {
      return;
    }

    createMealFromValues(form, prepNotesDraft);
  }, [createMealFromValues, form, isEditMode, prepNotesDraft]);

  const handleHeaderBack = useCallback(() => {
    if (!isEditMode && addMealStep === "manual") {
      setAddMealStep("entry");
      return;
    }
    onClose();
  }, [addMealStep, isEditMode, onClose]);

  const handleRecipeUrlChange = useCallback(
    (value: string) => {
      if (autoFillError) {
        clearError();
      }
      if (autoFillResult) {
        resetAutoFill();
        setAutoFillDraft(null);
        setIsAutoFillPreviewVisible(false);
      }
      updateField("recipeUrl", value);
    },
    [autoFillError, autoFillResult, clearError, resetAutoFill, updateField]
  );

  const renderHeader = (loading = false) => (
    <View style={styles.headerRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={loading ? "Cancel auto-fill" : "Back"}
        onPress={loading ? onClose : handleHeaderBack}
        style={styles.backButton}
      >
        <MaterialCommunityIcons
          name={loading ? "close" : "arrow-left"}
          size={24}
          color={theme.color.subtleInk}
        />
      </Pressable>
      {!loading && !isEditMode && addMealStep === "entry" ? (
        <Text style={styles.headerTitle}>Add Meal</Text>
      ) : null}
      <View style={styles.headerSpacer} />
    </View>
  );

  if (!isEditMode && addMealStep === "entry") {
    return (
      <View style={styles.container}>
        {renderHeader()}
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.entryContent}
        >
          <View style={styles.recipeEntryCard}>
            <View style={styles.recipeEntryHeadingRow}>
              <View style={styles.recipeEntryIcon}>
                <MaterialCommunityIcons
                  name="link-variant"
                  size={26}
                  color={theme.color.accent}
                />
              </View>
              <View style={styles.recipeEntryHeadingText}>
                <Text style={styles.recipeEntryTitle}>
                  Add from a recipe link
                </Text>
                <Text style={styles.recipeEntryDescription}>
                  Paste a recipe and we’ll fill in the meal details and
                  ingredients for you.
                </Text>
              </View>
            </View>
            <View style={styles.entryUrlInput}>
              <MaterialCommunityIcons
                name="link-variant"
                size={18}
                color={theme.color.subtleInk}
              />
              <TextInput
                accessibilityLabel="Recipe URL"
                placeholder="Paste recipe URL…"
                placeholderTextColor={theme.color.subtleInk}
                style={styles.linkTextInput}
                value={form.recipeUrl}
                onChangeText={handleRecipeUrlChange}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.entryAutoFillButton,
                isAutoFillButtonDisabled && styles.autoFillButtonDisabled,
                pressed && !isAutoFillButtonDisabled &&
                  styles.entryButtonPressed,
              ]}
              disabled={isAutoFillButtonDisabled}
              onPress={handleAutoFillPress}
              accessibilityRole="button"
              accessibilityLabel="Auto-Fill Meal"
            >
              <MaterialCommunityIcons
                name="creation"
                size={18}
                color={theme.mode === "dark" ? theme.color.ink : theme.color.bg}
              />
              <Text style={styles.entryAutoFillButtonText}>Auto-Fill Meal</Text>
            </Pressable>
            {autoFillError ? (
              <View style={styles.entryError}>
                <Text style={styles.entryErrorText} accessibilityRole="alert">
                  We couldn’t read that recipe. Check the link and try again.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Try recipe auto-fill again"
                  onPress={handleAutoFillPress}
                  disabled={isAutoFillButtonDisabled}
                >
                  <Text style={styles.entryErrorAction}>Try Again</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <View style={styles.entryDividerRow}>
            <View style={styles.entryDividerLine} />
            <Text style={styles.entryDividerText}>or</Text>
            <View style={styles.entryDividerLine} />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Enter meal manually"
            onPress={() => setAddMealStep("manual")}
            style={({ pressed }) => [
              styles.manualEntryCard,
              pressed && styles.entryButtonPressed,
            ]}
          >
            <View style={styles.manualEntryIcon}>
              <MaterialCommunityIcons
                name="pencil-outline"
                size={24}
                color={theme.color.subtleInk}
              />
            </View>
            <View style={styles.manualEntryText}>
              <Text style={styles.manualEntryTitle}>Enter meal manually</Text>
              <Text style={styles.manualEntryDescription}>
                Add all the meal details yourself.
              </Text>
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={26}
              color={theme.color.subtleInk}
            />
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  if (!isEditMode && addMealStep === "autofill-loading") {
    const loadingItems = [
      "Finding the recipe",
      "Adding ingredients",
      "Organizing your grocery list",
    ];
    return (
      <View style={styles.container}>
        {renderHeader(true)}
        <View style={styles.loadingContent}>
          <View style={styles.loadingMagicIcon}>
            <MaterialCommunityIcons
              name="magic-staff"
              size={58}
              color={theme.color.accent}
            />
          </View>
          <Text style={styles.loadingTitle}>Creating your meal…</Text>
          <View style={styles.loadingChecklist}>
            {loadingItems.map((label, index) => {
              const complete = completedLoadingSteps > index;
              return (
                <View style={styles.loadingRow} key={label}>
                  <MaterialCommunityIcons
                    name={complete ? "check-circle" : "circle-outline"}
                    size={21}
                    color={complete ? theme.color.accent : theme.color.border}
                  />
                  <Text style={styles.loadingRowText}>{label}</Text>
                </View>
              );
            })}
          </View>
          <View style={styles.loadingTrack}>
            <View
              style={[
                styles.loadingProgress,
                { width: `${Math.max(12, completedLoadingSteps * 33.333)}%` },
              ]}
            />
          </View>
          <Text style={styles.loadingHelper}>This may take a few seconds</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 80}
      >
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            onPress={handleHeaderBack}
            style={styles.backButton}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={theme.color.subtleInk}
            />
          </Pressable>

          {isEditMode ? (
            <View style={styles.headerSpacer} />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save meal"
              onPress={handleSubmit}
              style={({ pressed }) => [
                styles.addIconButton,
                isCreateDirty && styles.addIconButtonDirty,
                pressed && styles.addIconButtonPressed,
              ]}
            >
              <MaterialCommunityIcons
                name="plus-circle"
                size={24}
                color={
                  isCreateDirty ? theme.color.accent : theme.color.subtleInk
                }
              />
            </Pressable>
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Meal Icon</Text>
            <View style={styles.emojiRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.emojiPreview,
                  pressed && styles.emojiPreviewPressed,
                ]}
                onPress={handleOpenEmojiPicker}
                accessibilityRole="button"
                accessibilityLabel="Choose meal icon"
              >
                <Text style={styles.emojiPreviewGlyph}>{form.emoji}</Text>
                <Text style={styles.emojiPreviewHint}>Tap to change</Text>
              </Pressable>
              {showEmojiSuggestion ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.emojiSuggestionButton,
                    pressed && styles.emojiSuggestionButtonPressed,
                  ]}
                  onPress={handleApplySuggestedEmoji}
                  accessibilityRole="button"
                  accessibilityLabel="Use suggested meal icon"
                >
                  <Text style={styles.emojiSuggestionText}>
                    Try {suggestedEmoji}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Meal Title</Text>
            <TextInput
              placeholder="e.g. Chicken Stir Fry"
              placeholderTextColor={theme.color.subtleInk}
              style={[
                styles.input,
                showTitleRequiredError && styles.inputError,
              ]}
              value={form.title}
              onChangeText={(value) => {
                const formattedValue = capitalizeMealTitleWords(value);
                if (showTitleRequiredError && formattedValue.trim()) {
                  setShowTitleRequiredError(false);
                }
                updateField("title", formattedValue);
              }}
            />
            {showTitleRequiredError ? (
              <Text style={styles.fieldErrorText} accessibilityRole="alert">
                Meal Title is required.
              </Text>
            ) : null}
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
                  handleRecipeUrlChange(value);
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
            <Text style={styles.sectionLabel}>KEY INGREDIENTS</Text>
            <View style={styles.ingredientsWrapper}>
              {!hasIngredients ? (
                <Text style={styles.ingredientsEmpty}>
                  Add a few highlights for this meal.
                </Text>
              ) : (
                keyIngredientEntries.map(({ ingredient, index }) => {
                  const ingredientName = ingredient.name;
                  return (
                    <Pressable
                      key={`${ingredientName}-${index}`}
                      style={({ pressed }) => [
                        styles.chip,
                        isIngredientDeleteMode && styles.chipDeleteMode,
                        pressed && isIngredientDeleteMode && styles.chipPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isIngredientDeleteMode
                          ? `Remove ${ingredientName}`
                          : `Move ${ingredientName} to Pantry Staples`
                      }
                      accessibilityHint={
                        isIngredientDeleteMode
                          ? "Double tap to remove ingredient"
                          : "Double tap to move this ingredient to Pantry Staples"
                      }
                      onPress={() => {
                        if (isIngredientDeleteMode) {
                          handleRemoveIngredient(index);
                          return;
                        }
                        handleToggleIngredientType(index);
                      }}
                    >
                      <Text style={styles.chipText}>{ingredientName}</Text>
                    </Pressable>
                  );
                })
              )}
            </View>
            <View style={styles.addIngredientRow}>
              <TextInput
                placeholder="Add ingredient"
                placeholderTextColor={theme.color.subtleInk}
                style={styles.ingredientInput}
                value={newIngredient}
                onChangeText={setNewIngredient}
                onFocus={() => setIsIngredientDeleteMode(false)}
                onSubmitEditing={handleAddIngredient}
                returnKeyType="done"
              />
              <Pressable
                onPress={handleToggleIngredientDeleteMode}
                disabled={!hasIngredients}
                accessibilityRole="button"
                accessibilityLabel={
                  isIngredientDeleteMode
                    ? "Exit ingredient delete mode"
                    : "Delete ingredients"
                }
                style={({ pressed }) => [
                  styles.ingredientTrashButton,
                  pressed && hasIngredients && styles.ingredientTrashButtonPressed,
                  isIngredientDeleteMode && styles.ingredientTrashButtonActive,
                  !hasIngredients && styles.ingredientTrashButtonDisabled,
                ]}
              >
                <MaterialCommunityIcons
                  name={
                    isIngredientDeleteMode ? "trash-can" : "trash-can-outline"
                  }
                  size={18}
                  color={
                    !hasIngredients
                      ? theme.color.border
                      : isIngredientDeleteMode
                      ? theme.color.ink
                      : theme.color.subtleInk
                  }
                />
              </Pressable>
            </View>
            {pantryStapleEntries.length ? (
              <>
                <Text style={[styles.sectionLabel, styles.pantrySectionLabel]}>
                  PANTRY STAPLES
                </Text>
                <View style={styles.ingredientsWrapper}>
                  {pantryStapleEntries.map(({ ingredient, index }) => {
                    const ingredientName = ingredient.name;
                    return (
                      <Pressable
                        key={`${ingredientName}-${index}`}
                        style={({ pressed }) => [
                          styles.chip,
                          styles.pantryChip,
                          isIngredientDeleteMode && styles.chipDeleteMode,
                          pressed &&
                            isIngredientDeleteMode &&
                            styles.chipPressed,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={
                          isIngredientDeleteMode
                            ? `Remove ${ingredientName}`
                            : `Move ${ingredientName} to Key Ingredients`
                        }
                        accessibilityHint={
                          isIngredientDeleteMode
                            ? "Double tap to remove ingredient"
                            : "Double tap to move this ingredient to Key Ingredients"
                        }
                        onPress={() => {
                          if (isIngredientDeleteMode) {
                            handleRemoveIngredient(index);
                            return;
                          }
                          handleToggleIngredientType(index);
                        }}
                      >
                        <Text style={[styles.chipText, styles.pantryChipText]}>
                          {ingredientName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.addIngredientRow}>
                  <TextInput
                    placeholder="Add ingredient"
                    placeholderTextColor={theme.color.subtleInk}
                    style={styles.ingredientInput}
                    value={newPantryIngredient}
                    onChangeText={setNewPantryIngredient}
                    onFocus={() => setIsIngredientDeleteMode(false)}
                    onSubmitEditing={handleAddPantryIngredient}
                    returnKeyType="done"
                  />
                  <Pressable
                    onPress={handleToggleIngredientDeleteMode}
                    disabled={!hasIngredients}
                    accessibilityRole="button"
                    accessibilityLabel={
                      isIngredientDeleteMode
                        ? "Exit ingredient delete mode"
                        : "Delete ingredients"
                    }
                    style={({ pressed }) => [
                      styles.ingredientTrashButton,
                      pressed &&
                        hasIngredients &&
                        styles.ingredientTrashButtonPressed,
                      isIngredientDeleteMode &&
                        styles.ingredientTrashButtonActive,
                      !hasIngredients && styles.ingredientTrashButtonDisabled,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={
                        isIngredientDeleteMode
                          ? "trash-can"
                          : "trash-can-outline"
                      }
                      size={18}
                      color={
                        !hasIngredients
                          ? theme.color.border
                          : isIngredientDeleteMode
                          ? theme.color.ink
                          : theme.color.subtleInk
                      }
                    />
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Rating</Text>
            <FlexGrid.Row justifyContent="center">
              {hasFamilyMembers ? (
                <FamilyRatingIcons
                  ratings={form.familyRatings}
                  onChange={handleFamilyRatingChange}
                />
              ) : (
                <RatingStars
                  value={form.rating ?? 0}
                  size={32}
                  onChange={(next) => updateField("rating", next)}
                  gap={theme.space.xl}
                />
              )}
            </FlexGrid.Row>
            {hasFamilyMembers && familyAverageStars !== null ? (
              <Text style={styles.familyScore}>
                ⭐ {familyAverageStars.toFixed(1)} — rated by {familyCount}{" "}
                family {familyCount === 1 ? "member" : "members"}
              </Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Served Count</Text>
            <Text style={styles.servedCountValue}>
              Served {form.servedCount ?? 0}{" "}
              {form.servedCount === 1 ? "time" : "times"}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Difficulty</Text>
            <View style={styles.levelChipRow}>
              {DIFFICULTY_LEVELS.map(({ label, value, colorKey }) => {
                const isSelected = form.difficulty === value;
                const levelColor = theme.color[colorKey];
                return (
                  <Pressable
                    key={label}
                    style={[
                      styles.levelChip,
                      {
                        borderColor: levelColor,
                        backgroundColor: isSelected
                          ? levelColor
                          : theme.color.surface,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`Set difficulty to ${label}`}
                    onPress={() => updateField("difficulty", value)}
                  >
                    <View style={styles.levelChipContent}>
                      {!isSelected ? (
                        <View
                          style={[
                            styles.levelChipDot,
                            { backgroundColor: levelColor },
                          ]}
                        />
                      ) : null}
                      <Text
                        style={[
                          styles.levelChipText,
                          { color: isSelected ? theme.color.ink : levelColor },
                        ]}
                      >
                        {label}
                      </Text>
                    </View>
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

          <View
            style={styles.section}
            onLayout={({ nativeEvent }) => {
              notesSectionOffsetRef.current = nativeEvent.layout.y;
            }}
          >
            <Text style={styles.sectionLabel}>Prep Notes</Text>
            <TextInput
              placeholder="Add reminders or prep steps"
              placeholderTextColor={theme.color.subtleInk}
              style={styles.notesInput}
              multiline
              value={prepNotesDraft}
              onChangeText={setPrepNotesDraft}
              onFocus={() => {
                const y = Math.max(
                  notesSectionOffsetRef.current - theme.space.xl,
                  0
                );
                scrollRef.current?.scrollTo({
                  y,
                  animated: true,
                });
              }}
              blurOnSubmit
              returnKeyType="done"
              onSubmitEditing={() => {
                updateField("prepNotes", prepNotesDraft);
                Keyboard.dismiss();
              }}
              onBlur={() => updateField("prepNotes", prepNotesDraft)}
            />
          </View>
        </ScrollView>

        <Modal
          transparent
          animationType="fade"
          visible={isAutoFillPreviewVisible && Boolean(autoFillDraft)}
          onRequestClose={closeAutoFillPreview}
        >
          <KeyboardAvoidingView
            style={styles.autoFillModalBackdrop}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}
          >
            <View style={styles.autoFillModalContent}>
              <View style={styles.autoFillModalHeader}>
                <View style={styles.autoFillEmojiPreview}>
                  <Text style={styles.autoFillEmojiGlyph}>
                    {autoFillPreviewEmoji}
                  </Text>
                </View>
                <View style={styles.autoFillHeaderText}>
                  <Text style={styles.autoFillModalTitle}>
                    Recipe found ✨
                  </Text>
                  <Text style={styles.autoFillModalDescription}>
                    Make any changes before adding this meal.
                  </Text>
                </View>
              </View>

              <ScrollView
                ref={autoFillScrollRef}
                style={styles.autoFillModalScroll}
                contentContainerStyle={[
                  styles.autoFillModalScrollContent,
                  autoFillKeyboardHeight > 0 && {
                    paddingBottom:
                      autoFillKeyboardHeight + theme.space["2xl"],
                  },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.autoFillEditorSection}>
                  <Text style={styles.autoFillFieldLabel}>Meal Title</Text>
                  <TextInput
                    placeholder="Meal title"
                    placeholderTextColor={theme.color.subtleInk}
                    style={styles.autoFillInput}
                    value={autoFillDraft?.title ?? ""}
                    onChangeText={(value) => updateAutoFillDraft("title", value)}
                  />
                </View>

                <View style={styles.autoFillEditorSection}>
                  <Text style={styles.autoFillFieldLabel}>
                    KEY INGREDIENTS
                  </Text>
                  <View style={styles.ingredientsWrapper}>
                    {!autoFillIngredientEntries.length ? (
                      <Text style={styles.ingredientsEmpty}>
                        Add a few highlights for this meal.
                      </Text>
                    ) : (
                      autoFillKeyIngredientEntries.map(
                        ({ ingredient, index }) => {
                          const ingredientName = ingredient.name;
                          return (
                            <Pressable
                              key={`${ingredientName}-${index}`}
                              style={({ pressed }) => [
                                styles.autoFillIngredientChip,
                                isAutoFillIngredientDeleteMode &&
                                  styles.chipDeleteMode,
                                pressed &&
                                  isAutoFillIngredientDeleteMode &&
                                  styles.chipPressed,
                              ]}
                              accessibilityRole="button"
                              accessibilityLabel={
                                isAutoFillIngredientDeleteMode
                                  ? `Remove ${ingredientName}`
                                  : `Move ${ingredientName} to Pantry Staples`
                              }
                              onPress={() => {
                                if (isAutoFillIngredientDeleteMode) {
                                  handleRemoveAutoFillIngredient(index);
                                  return;
                                }
                                handleToggleAutoFillIngredientType(index);
                              }}
                            >
                              <Text style={styles.autoFillIngredientChipText}>
                                {ingredientName}
                              </Text>
                            </Pressable>
                          );
                        }
                      )
                    )}
                  </View>
                  <View style={styles.addIngredientRow}>
                    <TextInput
                      placeholder="Add ingredient"
                      placeholderTextColor={theme.color.subtleInk}
                      style={styles.autoFillIngredientInput}
                      value={newAutoFillIngredient}
                      onChangeText={setNewAutoFillIngredient}
                      onFocus={() => setIsAutoFillIngredientDeleteMode(false)}
                      onSubmitEditing={handleAddAutoFillIngredient}
                      returnKeyType="done"
                    />
                    <Pressable
                      onPress={() => {
                        if (!autoFillDraft?.ingredients.length) {
                          return;
                        }
                        setIsAutoFillIngredientDeleteMode((prev) => !prev);
                      }}
                      disabled={!autoFillDraft?.ingredients.length}
                      accessibilityRole="button"
                      accessibilityLabel={
                        isAutoFillIngredientDeleteMode
                          ? "Exit ingredient delete mode"
                          : "Delete ingredients"
                      }
                      style={({ pressed }) => [
                        styles.ingredientTrashButton,
                        pressed &&
                          Boolean(autoFillDraft?.ingredients.length) &&
                          styles.ingredientTrashButtonPressed,
                        isAutoFillIngredientDeleteMode &&
                          styles.ingredientTrashButtonActive,
                        !autoFillDraft?.ingredients.length &&
                          styles.ingredientTrashButtonDisabled,
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          isAutoFillIngredientDeleteMode
                            ? "trash-can"
                            : "trash-can-outline"
                        }
                        size={18}
                        color={
                          !autoFillDraft?.ingredients.length
                            ? theme.color.border
                            : isAutoFillIngredientDeleteMode
                            ? theme.color.ink
                            : theme.color.subtleInk
                        }
                      />
                    </Pressable>
                  </View>
                  {autoFillPantryStapleEntries.length ? (
                    <>
                      <Text
                        style={[
                          styles.autoFillFieldLabel,
                          styles.pantrySectionLabel,
                        ]}
                      >
                        PANTRY STAPLES
                      </Text>
                      <View style={styles.ingredientsWrapper}>
                        {autoFillPantryStapleEntries.map(
                          ({ ingredient, index }) => {
                            const ingredientName = ingredient.name;
                            return (
                              <Pressable
                                key={`${ingredientName}-${index}`}
                                style={({ pressed }) => [
                                  styles.autoFillIngredientChip,
                                  styles.autoFillPantryChip,
                                  isAutoFillIngredientDeleteMode &&
                                    styles.chipDeleteMode,
                                  pressed &&
                                    isAutoFillIngredientDeleteMode &&
                                    styles.chipPressed,
                                ]}
                                accessibilityRole="button"
                                accessibilityLabel={
                                  isAutoFillIngredientDeleteMode
                                    ? `Remove ${ingredientName}`
                                    : `Move ${ingredientName} to Key Ingredients`
                                }
                                onPress={() => {
                                  if (isAutoFillIngredientDeleteMode) {
                                    handleRemoveAutoFillIngredient(index);
                                    return;
                                  }
                                  handleToggleAutoFillIngredientType(index);
                                }}
                              >
                                <Text
                                  style={[
                                    styles.autoFillIngredientChipText,
                                    styles.autoFillPantryChipText,
                                  ]}
                                >
                                  {ingredientName}
                                </Text>
                              </Pressable>
                            );
                          }
                        )}
                      </View>
                      <View style={styles.addIngredientRow}>
                        <TextInput
                          placeholder="Add ingredient"
                          placeholderTextColor={theme.color.subtleInk}
                          style={styles.autoFillIngredientInput}
                          value={newAutoFillPantryIngredient}
                          onChangeText={setNewAutoFillPantryIngredient}
                          onFocus={() =>
                            setIsAutoFillIngredientDeleteMode(false)
                          }
                          onSubmitEditing={handleAddAutoFillPantryIngredient}
                          returnKeyType="done"
                        />
                        <Pressable
                          onPress={() => {
                            if (!autoFillDraft?.ingredients.length) {
                              return;
                            }
                            setIsAutoFillIngredientDeleteMode((prev) => !prev);
                          }}
                          disabled={!autoFillDraft?.ingredients.length}
                          accessibilityRole="button"
                          accessibilityLabel={
                            isAutoFillIngredientDeleteMode
                              ? "Exit ingredient delete mode"
                              : "Delete ingredients"
                          }
                          style={({ pressed }) => [
                            styles.ingredientTrashButton,
                            pressed &&
                              Boolean(autoFillDraft?.ingredients.length) &&
                              styles.ingredientTrashButtonPressed,
                            isAutoFillIngredientDeleteMode &&
                              styles.ingredientTrashButtonActive,
                            !autoFillDraft?.ingredients.length &&
                              styles.ingredientTrashButtonDisabled,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name={
                              isAutoFillIngredientDeleteMode
                                ? "trash-can"
                                : "trash-can-outline"
                            }
                            size={18}
                            color={
                              !autoFillDraft?.ingredients.length
                                ? theme.color.border
                                : isAutoFillIngredientDeleteMode
                                ? theme.color.ink
                                : theme.color.subtleInk
                            }
                          />
                        </Pressable>
                      </View>
                    </>
                  ) : null}
                </View>

                <View style={styles.autoFillEditorSection}>
                  <Text style={styles.autoFillFieldLabel}>Difficulty</Text>
                  <View style={styles.levelChipRow}>
                    {DIFFICULTY_LEVELS.map(({ label, value }) => {
                      const isSelected = autoFillDraft?.difficulty === value;
                      return (
                        <Pressable
                          key={label}
                          style={[
                            styles.levelChip,
                            styles.autoFillLevelChip,
                            isSelected && styles.autoFillLevelChipSelected,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          accessibilityLabel={`Set imported difficulty to ${label}`}
                          onPress={() =>
                            updateAutoFillDraft("difficulty", value)
                          }
                        >
                          <View style={styles.levelChipContent}>
                            <Text
                              style={[
                                styles.levelChipText,
                                isSelected &&
                                  styles.autoFillLevelChipTextSelected,
                              ]}
                            >
                              {label}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.autoFillEditorSection}>
                  <Text style={styles.autoFillFieldLabel}>Expense</Text>
                  <View style={styles.levelChipRow}>
                    {EXPENSE_LEVELS.map(({ label, value }) => {
                      const isSelected = autoFillDraft?.expense === value;
                      return (
                        <Pressable
                          key={label}
                          style={[
                            styles.levelChip,
                            styles.autoFillLevelChip,
                            isSelected && styles.autoFillLevelChipSelected,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                          accessibilityLabel={`Set imported expense to ${label}`}
                          onPress={() => updateAutoFillDraft("expense", value)}
                        >
                          <Text
                            style={[
                              styles.levelChipText,
                              isSelected &&
                                styles.autoFillLevelChipTextSelected,
                            ]}
                          >
                            {label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View
                  style={styles.autoFillEditorSection}
                  onLayout={({ nativeEvent }) => {
                    autoFillNotesSectionOffsetRef.current =
                      nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.autoFillFieldLabel}>Prep Notes</Text>
                  <TextInput
                    placeholder="Add reminders or prep steps"
                    placeholderTextColor={theme.color.subtleInk}
                    style={styles.autoFillNotesInput}
                    multiline
                    value={autoFillDraft?.prepNotes ?? ""}
                    onChangeText={(value) =>
                      updateAutoFillDraft("prepNotes", value)
                    }
                    onFocus={scrollAutoFillNotesIntoView}
                  />
                </View>
              </ScrollView>

              <View style={styles.autoFillModalActions}>
                <Pressable
                  style={styles.autoFillModalButton}
                  onPress={closeAutoFillPreview}
                  accessibilityRole="button"
                  accessibilityLabel="Go back without adding auto-filled details"
                >
                  <Text style={styles.autoFillModalButtonText}>Back</Text>
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
                  accessibilityLabel="Add meal with the reviewed recipe details"
                >
                  <Text
                    style={[
                      styles.autoFillModalButtonText,
                      styles.autoFillModalButtonTextPrimary,
                      !hasAutoFillSelection &&
                        styles.autoFillModalButtonTextDisabled,
                    ]}
                  >
                    Add Meal
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
        <EmojiPickerModal
          visible={isEmojiPickerVisible}
          selectedEmoji={form.emoji ?? DEFAULT_MEAL_EMOJI}
          suggestedEmoji={showEmojiSuggestion ? suggestedEmoji : undefined}
          onPick={handlePickEmoji}
          onClose={handleCloseEmojiPicker}
        />
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
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.space.md,
    },
    headerSpacer: {
      width: 44,
      height: 44,
    },
    headerTitle: {
      flex: 1,
      marginLeft: theme.space.lg,
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
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
    addIconButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    addIconButtonDirty: {
      borderColor: theme.color.accent,
      backgroundColor: theme.color.focus,
    },
    addIconButtonPressed: {
      opacity: 0.85,
    },
    headerFreezerCol: {
      alignItems: "flex-end",
      paddingRight: theme.space.md,
    },
    freezerToggleButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
      paddingHorizontal: theme.space.sm,
      paddingVertical: 6,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    freezerToggleButtonPressed: {
      opacity: 0.85,
    },
    scrollContent: {
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space["2xl"],
      paddingBottom: theme.space["2xl"] + theme.space.xl,
      gap: theme.space["2xl"],
    },
    entryContent: {
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space.xl,
      paddingBottom: theme.space["2xl"],
      gap: theme.space.xl,
    },
    recipeEntryCard: {
      padding: theme.space.lg,
      gap: theme.space.lg,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
    },
    recipeEntryHeadingRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.space.md,
    },
    recipeEntryIcon: {
      width: 52,
      height: 52,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.focus,
    },
    recipeEntryHeadingText: {
      flex: 1,
      gap: theme.space.xs,
    },
    recipeEntryTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    recipeEntryDescription: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      lineHeight: 22,
    },
    entryUrlInput: {
      minHeight: theme.component.input.height,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.space.md,
      gap: theme.space.sm,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      backgroundColor: theme.color.surface,
    },
    entryAutoFillButton: {
      minHeight: theme.component.button.height,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.color.accent,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.sm,
    },
    entryAutoFillButtonText: {
      color: theme.mode === "dark" ? theme.color.ink : theme.color.bg,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    entryButtonPressed: {
      opacity: 0.82,
    },
    entryError: {
      gap: theme.space.sm,
    },
    entryErrorText: {
      color: theme.color.danger,
      fontSize: theme.type.size.sm,
      lineHeight: 20,
    },
    entryErrorAction: {
      color: theme.color.accent,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    entryDividerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
      paddingHorizontal: theme.space.xl,
    },
    entryDividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.color.border,
    },
    entryDividerText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    manualEntryCard: {
      minHeight: 92,
      padding: theme.space.lg,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      backgroundColor: theme.color.surface,
    },
    manualEntryIcon: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
    },
    manualEntryText: {
      flex: 1,
      gap: theme.space.xs,
    },
    manualEntryTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    manualEntryDescription: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      lineHeight: 20,
    },
    loadingContent: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.space["2xl"],
      paddingBottom: 72,
    },
    loadingMagicIcon: {
      width: 96,
      height: 96,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: theme.space.lg,
    },
    loadingTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h1,
      fontWeight: theme.type.weight.bold,
      marginBottom: theme.space.xl,
      textAlign: "center",
    },
    loadingChecklist: {
      width: "100%",
      maxWidth: 320,
      gap: theme.space.lg,
      marginBottom: theme.space.xl,
    },
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
    },
    loadingRowText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    loadingTrack: {
      width: "100%",
      maxWidth: 320,
      height: 7,
      overflow: "hidden",
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
    },
    loadingProgress: {
      height: "100%",
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.accent,
    },
    loadingHelper: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      marginTop: theme.space.md,
    },
    section: {
      gap: theme.space.md,
    },
    emojiRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
    },
    emojiPreview: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.space.sm,
      paddingHorizontal: theme.space.lg,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
      minWidth: 96,
    },
    emojiPreviewPressed: {
      opacity: 0.8,
    },
    emojiPreviewGlyph: {
      fontSize: 40,
    },
    emojiPreviewHint: {
      marginTop: theme.space.xs / 2,
      fontSize: theme.type.size.xs,
      color: theme.color.subtleInk,
    },
    emojiSuggestionButton: {
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
    },
    emojiSuggestionButtonPressed: {
      opacity: 0.85,
    },
    emojiSuggestionText: {
      fontSize: theme.type.size.base,
      color: theme.color.ink,
      fontWeight: theme.type.weight.medium,
    },
    sectionLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    servedCountValue: {
      marginTop: theme.space.xs,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    input: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.md,
      paddingVertical: theme.space.md,
      paddingHorizontal: theme.space.lg,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    inputError: {
      borderWidth: 1,
      borderColor: theme.color.danger,
    },
    fieldErrorText: {
      color: theme.color.danger,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
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
    pantrySectionLabel: {
      color: theme.color.subtleInk,
      marginTop: theme.space.sm,
    },
    chip: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.md,
      paddingVertical: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    pantryChip: {
      backgroundColor: theme.color.surfaceAlt,
      borderColor: theme.color.cardOutline,
    },
    chipDeleteMode: {
      borderColor: theme.color.danger,
      backgroundColor: theme.color.surfaceAlt,
    },
    chipPressed: {
      opacity: 0.75,
    },
    chipText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    pantryChipText: {
      color: theme.color.subtleInk,
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
    ingredientTrashButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
    },
    ingredientTrashButtonPressed: {
      opacity: 0.7,
    },
    ingredientTrashButtonActive: {
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.accent,
    },
    ingredientTrashButtonDisabled: {
      opacity: 0.5,
    },
    notesInput: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.md,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      minHeight: 120,
      textAlignVertical: "top",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
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
    levelChipContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
    },
    levelChipDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radius.full,
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
      color: theme.color.bg,
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
      maxHeight: "86%",
      borderRadius: theme.radius.xl,
      backgroundColor: theme.color.surface,
      padding: theme.space.xl,
      gap: theme.space.lg,
    },
    autoFillModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
    },
    autoFillEmojiPreview: {
      width: 52,
      height: 52,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
    },
    autoFillEmojiGlyph: {
      fontSize: 29,
    },
    autoFillHeaderText: {
      flex: 1,
      gap: theme.space.xs,
    },
    autoFillModalTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
    },
    autoFillModalDescription: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      lineHeight: 19,
    },
    autoFillModalScroll: {
      flexGrow: 0,
    },
    autoFillModalScrollContent: {
      gap: theme.space.xl,
      paddingBottom: theme.space.sm,
    },
    autoFillEditorSection: {
      gap: theme.space.sm,
    },
    autoFillInput: {
      backgroundColor: theme.color.surfaceAlt,
      borderRadius: theme.radius.md,
      paddingVertical: theme.space.md,
      paddingHorizontal: theme.space.md,
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.medium,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    autoFillIngredientChip: {
      maxWidth: "100%",
      backgroundColor: theme.color.surfaceAlt,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.xs + 1,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    autoFillIngredientChipText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      lineHeight: 19,
    },
    autoFillPantryChip: {
      backgroundColor: theme.color.bg,
      borderColor: theme.color.cardOutline,
    },
    autoFillPantryChipText: {
      color: theme.color.subtleInk,
    },
    autoFillIngredientInput: {
      flex: 1,
      paddingVertical: theme.space.xs,
      paddingHorizontal: theme.space.sm,
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border,
    },
    autoFillLevelChip: {
      backgroundColor: theme.color.surfaceAlt,
      borderColor: theme.color.border,
    },
    autoFillLevelChipSelected: {
      backgroundColor: alpha(theme.color.accent, 0.14),
      borderColor: theme.color.accent,
    },
    autoFillLevelChipTextSelected: {
      color: theme.color.ink,
      fontWeight: theme.type.weight.bold,
    },
    autoFillNotesInput: {
      backgroundColor: theme.color.surfaceAlt,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      minHeight: 104,
      textAlignVertical: "top",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
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
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.7,
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
      gap: theme.space.md,
      paddingTop: theme.space.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border,
    },
    autoFillModalButton: {
      flex: 1,
      minHeight: theme.component.button.height,
      paddingHorizontal: theme.space.lg,
      borderRadius: theme.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      backgroundColor: theme.color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
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
      color: theme.mode === "dark" ? theme.color.ink : theme.color.bg,
      fontWeight: theme.type.weight.bold,
    },
    autoFillModalButtonTextDisabled: {
      color: theme.color.subtleInk,
    },
    familyScore: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
      marginTop: theme.space.sm,
    },
  });
