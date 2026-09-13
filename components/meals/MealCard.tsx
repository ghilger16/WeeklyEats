import { IngredientValue, getIngredientName, normalizeIngredientValue, isIngredient, prepareRecipeMealDraft } from "../../utils/recipeMealDraft";
import RecipeAutoFillProgress from "./RecipeAutoFillProgress";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import MealEmoji from "../emoji/MealEmoji";
import * as Haptics from "expo-haptics";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
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
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useThemeController } from "../../providers/theme/ThemeController";
import { alpha, WeeklyTheme } from "../../styles/theme";
import { FlexGrid } from "../../styles/flex-grid";
import {
  FamilyRatingValue,
  Ingredient,
  IngredientType,
  Meal,
  MealDraft,
} from "../../types/meals";
import { useFeatureFlag } from "../../hooks/useFeatureFlags";
import { useRecipeAutoFill } from "../../hooks/useRecipeAutoFill";
import { supportsRecipeAutoFill } from "../../utils/recipeAutoFillCapability";
import RatingStars from "./RatingStars";
import FamilyRatingRow from "./FamilyRatingRow";
import FamilyRatingAchievements from "./FamilyRatingAchievements";
import EmojiPickerModal from "../emoji/EmojiPickerModal";
import CuisineSelectorModal from "./CuisineSelectorModal";
import { CuisineType, getCuisineLabel } from "../../types/cuisine";
import { formatFreezerMealAmount, getFreezerMealAmount } from "../../utils/freezerMealAmount";
import {
  DEFAULT_MEAL_EMOJI,
  suggestEmojiForTitle,
} from "../../utils/emojiCatalog";
import { useFamilyMembers } from "../../hooks/useFamilyMembers";
import { useRatingDisplayMode } from "../../hooks/useRatingDisplayMode";
import {
  getFamilyRatingSummary,
  setFamilyRatingValue,
} from "../../utils/familyRatings";
import {
  classifyIngredientType,
  normalizeIngredientClassificationName,
  setIngredientClassificationPreference,
} from "../../utils/ingredientClassification";

type MealCardProps = {
  mode: "create" | "edit";
  initialMeal: MealDraft | Meal;
  autoFillOnOpen?: boolean;
  autoFillApplyMode?: "create" | "details";
  isGalaxyMeal?: boolean;
  onClose: () => void;
  onCreateMeal: (draft: MealDraft) => void;
  onUpdateMeal: (meal: Meal) => void;
  onLaunchRecipeAutoFill?: (recipeUrl: string) => void;
};

type MealFormValues = MealDraft;

type AddMealStep = "entry" | "manual" | "autofill-loading";

const SLIDER_STEPS = 5;

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

const triggerMealSaveHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

type AutoFillPreviewDraft = {
  title: string;
  ingredients: Ingredient[];
  cuisine?: CuisineType | null;
  difficulty?: number;
  expense?: number;
  prepNotes: string;
  preferredSides?: string[];
};

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
  preferredSides: Array.isArray(meal.preferredSides)
    ? [...meal.preferredSides]
    : [],
  difficulty:
    typeof meal.difficulty === "number"
      ? snapToLevelValue(meal.difficulty, DIFFICULTY_LEVELS)
      : undefined,
  expense:
    typeof meal.expense === "number"
      ? clampSliderValue(meal.expense)
      : undefined,
  cuisine: meal.cuisine ?? undefined,
  prepNotes: meal.prepNotes ?? "",
  freezerAmount:
    "freezerAmount" in meal && meal.freezerAmount !== undefined
      ? meal.freezerAmount ?? ""
      : meal.freezerQuantity ?? "",
  freezerUnit: meal.freezerUnit ?? "",
  freezerMealAmount: meal.freezerMealAmount,
  freezerAddedAt: meal.freezerAddedAt,
  createdAt: meal.createdAt,
  updatedAt: meal.updatedAt,
});

export default function MealCard({
  mode,
  initialMeal,
  autoFillOnOpen = false,
  autoFillApplyMode = "create",
  isGalaxyMeal = false,
  onClose,
  onCreateMeal,
  onUpdateMeal,
  onLaunchRecipeAutoFill,
}: MealCardProps) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const safeAreaInsets = useSafeAreaInsets();
  const stableTopInset = Math.max(
    safeAreaInsets.top,
    initialWindowMetrics?.insets.top ?? 0,
  );
  const stableBottomInset = Math.max(
    safeAreaInsets.bottom,
    initialWindowMetrics?.insets.bottom ?? 0,
  );
  const scrollRef = useRef<ScrollView | null>(null);
  const autoFillScrollRef = useRef<ScrollView | null>(null);
  const notesSectionOffsetRef = useRef(0);
  const autoFillNotesSectionOffsetRef = useRef(0);
  const detailIngredientInputRef = useRef<TextInput>(null);
  const detailIngredientEditInputRef = useRef<TextInput>(null);
  const detailScrollOffsetRef = useRef(0);
  const detailKeyboardTopRef = useRef<number | null>(null);
  const autoFillIngredientInputRef = useRef<TextInput>(null);
  const prevMealKeyRef = useRef<string | undefined>(undefined);
  const prevMealIdentityRef = useRef<string | undefined>(undefined);
  const [form, setForm] = useState<MealFormValues>(() =>
    normalizeMeal(initialMeal)
  );
  const [prepNotesDraft, setPrepNotesDraft] = useState(
    () => form.prepNotes ?? ""
  );
  const [newIngredient, setNewIngredient] = useState("");
  const [isIngredientDeleteMode, setIsIngredientDeleteMode] = useState(false);
  const isEditMode = mode === "edit";
  const autoFillFeatureFlag = useFeatureFlag("recipeAutoFillEnabled");
  const isAutoFillSupported = useMemo(() => supportsRecipeAutoFill(), []);
  const isAutoFillEnabled = autoFillFeatureFlag && isAutoFillSupported;
  const { members } = useFamilyMembers();
  const { mode: ratingDisplayMode } = useRatingDisplayMode();
  const showRatings = ratingDisplayMode !== "off";
  const useFamilyRatings =
    ratingDisplayMode === "family" && members.length > 1;
  const familyRatingSummary = useMemo(
    () => getFamilyRatingSummary(
      form.familyRatings,
      members.map((member) => member.id)
    ),
    [form.familyRatings, members]
  );
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
  const [newAutoFillIngredient, setNewAutoFillIngredient] = useState("");
  const [
    isAutoFillIngredientDeleteMode,
    setIsAutoFillIngredientDeleteMode,
  ] = useState(false);
  const autoFillTriggeredRef = useRef(false);
  const [isEmojiPickerVisible, setEmojiPickerVisible] = useState(false);
  const [isCuisineSelectorVisible, setCuisineSelectorVisible] = useState(false);
  const [isAutoFillCuisineSelectorVisible, setAutoFillCuisineSelectorVisible] =
    useState(false);
  const [showTitleRequiredError, setShowTitleRequiredError] = useState(false);
  const [addMealStep, setAddMealStep] = useState<AddMealStep>(
    mode === "edit" ? "manual" : "entry"
  );
  const [isDetailIngredientsExpanded, setDetailIngredientsExpanded] =
    useState(false);
  const [isDetailIngredientsEditing, setDetailIngredientsEditing] =
    useState(false);
  const [detailIngredientDraft, setDetailIngredientDraft] = useState("");
  const [editingDetailIngredientIndex, setEditingDetailIngredientIndex] = useState<number | null>(null);
  const [editingDetailIngredientDraft, setEditingDetailIngredientDraft] = useState("");
  const [isDetailTitleEditing, setDetailTitleEditing] = useState(false);
  const [detailTitleDraft, setDetailTitleDraft] = useState(() => form.title);
  const [isDetailNotesEditing, setDetailNotesEditing] = useState(false);
  const [isDetailRecipeExpanded, setDetailRecipeExpanded] = useState(false);
  const [detailRecipeUrlDraft, setDetailRecipeUrlDraft] = useState("");
  const [detailRecipeUrlError, setDetailRecipeUrlError] = useState<string | null>(null);
  const [isDetailAutoFillRequested, setDetailAutoFillRequested] = useState(false);
  const detailAutoFillInFlightRef = useRef(false);
  const [detailNotesDraft, setDetailNotesDraft] = useState(
    () => form.prepNotes ?? ""
  );

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

    const mealIdentity = `${mode}-${initialMeal.id ?? "draft"}`;
    const isSameMeal = prevMealIdentityRef.current === mealIdentity;
    prevMealIdentityRef.current = mealIdentity;
    prevMealKeyRef.current = mealKey;
    const normalized = normalizeMeal(initialMeal);
    setForm(normalized);
    setPrepNotesDraft(normalized.prepNotes ?? "");
    setNewIngredient("");
    setShowTitleRequiredError(false);
    autoFillTriggeredRef.current = false;
    setAddMealStep(mode === "edit" ? "manual" : "entry");
    if (!isSameMeal) {
      setDetailIngredientsExpanded(false);
      setDetailIngredientsEditing(false);
      setDetailIngredientDraft("");
      setEditingDetailIngredientIndex(null);
      setEditingDetailIngredientDraft("");
      setDetailTitleEditing(false);
      setDetailTitleDraft(normalized.title);
      setDetailNotesEditing(false);
      setDetailNotesDraft(normalized.prepNotes ?? "");
      setDetailRecipeExpanded(false);
      setDetailRecipeUrlDraft("");
      setDetailRecipeUrlError(null);
      setDetailAutoFillRequested(false);
      detailAutoFillInFlightRef.current = false;
    }
  }, [initialMeal, mode]);

  useEffect(() => {
    setPrepNotesDraft((prev) => {
      const next = form.prepNotes ?? "";
      return prev === next ? prev : next;
    });
  }, [form.prepNotes]);

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

  const handleManualTitleChange = useCallback((value: string) => {
    const formattedValue = capitalizeMealTitleWords(value);
    if (formattedValue.trim()) setShowTitleRequiredError(false);
    setForm((current) => {
      const previousSuggestion = suggestEmojiForTitle(current.title);
      const nextSuggestion = suggestEmojiForTitle(formattedValue);
      const currentEmoji = current.emoji ?? DEFAULT_MEAL_EMOJI;
      const canApplySuggestion =
        currentEmoji === DEFAULT_MEAL_EMOJI ||
        (Boolean(previousSuggestion) && currentEmoji === previousSuggestion);

      return {
        ...current,
        title: formattedValue,
        ...(canApplySuggestion
          ? { emoji: nextSuggestion ?? DEFAULT_MEAL_EMOJI }
          : {}),
      };
    });
    return formattedValue;
  }, []);

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

  const handleAddIngredient = useCallback(async () => {
    const trimmed = newIngredient.trim();
    if (!trimmed) {
      return;
    }

    const ingredientType = await classifyIngredientType(trimmed);
    updateField("ingredients", [
      ...(form.ingredients ?? []),
      createManualIngredient(trimmed, ingredientType),
    ]);
    setNewIngredient("");
  }, [form.ingredients, newIngredient, updateField]);

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
      const current = normalizeIngredientValue(
        (form.ingredients ?? [])[index] as IngredientValue,
      );
      if (current) {
        const nextType: IngredientType =
          current.ingredientType === "pantryStaple"
            ? "keyIngredient"
            : "pantryStaple";
        void setIngredientClassificationPreference(current.name, nextType);
      }
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
    setAddMealStep("autofill-loading");
    const outcome = await requestAutoFill();
    if (!outcome.ok) {
      if (detailAutoFillInFlightRef.current) {
        detailAutoFillInFlightRef.current = false;
        setDetailRecipeUrlError(outcome.error);
        updateField("recipeUrl", "");
        setDetailRecipeExpanded(true);
      }
      setAddMealStep(isEditMode ? "manual" : "entry");
      return;
    }
    detailAutoFillInFlightRef.current = false;

    setAutoFillDraft(await prepareRecipeMealDraft(outcome.data));
    setNewAutoFillIngredient("");
    setIsAutoFillIngredientDeleteMode(false);
    setAddMealStep("manual");
    setIsAutoFillPreviewVisible(true);
  }, [autoFillOnOpen, clearError, isEditMode, requestAutoFill, updateField]);

  useEffect(() => {
    if (!isDetailAutoFillRequested || !form.recipeUrl?.trim()) return;
    setDetailAutoFillRequested(false);
    void handleAutoFillPress();
  }, [form.recipeUrl, handleAutoFillPress, isDetailAutoFillRequested]);

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
      triggerMealSaveHaptic();
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
    nextForm.cuisine = autoFillDraft.cuisine ?? undefined;

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
    if (autoFillDraft.preferredSides?.length) {
      nextForm.preferredSides = autoFillDraft.preferredSides;
    }

    if (!isEditMode) {
      if (!createMealFromValues(nextForm, nextPrepNotesDraft)) {
        return;
      }
      closeAutoFillPreview();
      return;
    }

    if (autoFillOnOpen && "id" in initialMeal) {
      onUpdateMeal({
        ...initialMeal,
        ...nextForm,
        prepNotes: nextPrepNotesDraft,
        updatedAt: new Date().toISOString(),
      } as Meal);
      closeAutoFillPreview();
      onClose();
      return;
    }

    const updatedMeal: Meal = {
      ...(form as Meal),
      ...nextForm,
      id: form.id!,
      prepNotes: nextPrepNotesDraft,
      updatedAt: new Date().toISOString(),
    };
    setForm(updatedMeal);
    setPrepNotesDraft(nextPrepNotesDraft);
    onUpdateMeal(updatedMeal);
    triggerMealSaveHaptic();
    closeAutoFillPreview();
  }, [
    autoFillDraft,
    closeAutoFillPreview,
    createMealFromValues,
    form,
    autoFillOnOpen,
    initialMeal,
    isEditMode,
    onClose,
    onUpdateMeal,
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
      form.cuisine !== initial.cuisine ||
      Boolean(form.isFavorite) !== Boolean(initial.isFavorite)
    );
  }, [form, initialMeal, isEditMode, prepNotesDraft]);
  const hasAutoFillSelection = useMemo(
    () =>
      Boolean(
        autoFillDraft?.title.trim() ||
          autoFillDraft?.ingredients.length ||
          autoFillDraft?.cuisine ||
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
  const autoFillDifficultyLevel = DIFFICULTY_LEVELS.find(
    (level) => level.value === autoFillDraft?.difficulty,
  );
  const autoFillDifficultyLabel = autoFillDifficultyLevel?.label ?? "Not set";
  const autoFillDifficultyColor = autoFillDifficultyLevel
    ? theme.color[autoFillDifficultyLevel.colorKey]
    : undefined;
  const autoFillExpenseLabel =
    typeof autoFillDraft?.expense === "number"
      ? "$".repeat(
          autoFillDraft.expense >= 4 ? 3 : autoFillDraft.expense <= 2 ? 1 : 2,
        )
      : "Not set";
  const autoFillCuisineLabel =
    getCuisineLabel(autoFillDraft?.cuisine) ?? "Not set";
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

  const openAutoFillCuisineSelector = useCallback(() => {
    Keyboard.dismiss();
    setAutoFillCuisineSelectorVisible(true);
  }, []);

  const closeAutoFillCuisineSelector = useCallback(() => {
    setAutoFillCuisineSelectorVisible(false);
  }, []);

  const handleAddAutoFillIngredient = useCallback(async () => {
    const trimmed = newAutoFillIngredient.trim();
    if (!trimmed) {
      return;
    }
    const normalizedName = normalizeIngredientClassificationName(trimmed);
    const duplicate = (autoFillDraft?.ingredients ?? []).some(
      (ingredient) =>
        normalizeIngredientClassificationName(
          getIngredientName(ingredient as IngredientValue),
        ) === normalizedName,
    );
    if (duplicate) {
      setNewAutoFillIngredient("");
      requestAnimationFrame(() => autoFillIngredientInputRef.current?.focus());
      return;
    }
    const ingredientType = await classifyIngredientType(trimmed);
    setAutoFillDraft((prev) =>
      prev
        ? {
            ...prev,
            ingredients: [
              ...prev.ingredients,
              createManualIngredient(trimmed, ingredientType),
            ],
          }
        : prev
    );
    setNewAutoFillIngredient("");
    requestAnimationFrame(() => autoFillIngredientInputRef.current?.focus());
  }, [autoFillDraft?.ingredients, newAutoFillIngredient]);

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
        ? (() => {
            const current = normalizeIngredientValue(
              prev.ingredients[index] as IngredientValue,
            );
            if (current) {
              const nextType: IngredientType =
                current.ingredientType === "pantryStaple"
                  ? "keyIngredient"
                  : "pantryStaple";
              void setIngredientClassificationPreference(
                current.name,
                nextType,
              );
            }
            return {
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
            };
          })()
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

  const persistDetailIngredients = useCallback(
    (ingredients: Ingredient[]) => {
      if (!isEditMode) {
        setForm((current) => ({ ...current, ingredients }));
        return;
      }
      if (!form.id) return;
      const nextMeal: Meal = {
        ...(form as Meal),
        id: form.id,
        ingredients,
        updatedAt: new Date().toISOString(),
      };
      setForm(nextMeal);
      onUpdateMeal(nextMeal);
      triggerMealSaveHaptic();
    },
    [form, isEditMode, onUpdateMeal]
  );

  const handleRemoveDetailIngredient = useCallback(
    (index: number) => {
      const next = (form.ingredients ?? [])
        .filter((_, ingredientIndex) => ingredientIndex !== index)
        .map((ingredient) => normalizeIngredientValue(ingredient as IngredientValue))
        .filter(isIngredient);
      persistDetailIngredients(next);
    },
    [form.ingredients, persistDetailIngredients]
  );

  const ensureDetailIngredientInputVisible = useCallback(() => {
    const keyboardTop = detailKeyboardTopRef.current;
    if (keyboardTop === null || !detailIngredientInputRef.current?.isFocused()) {
      return;
    }
    requestAnimationFrame(() => {
      detailIngredientInputRef.current?.measureInWindow((_x, y, _width, height) => {
        const overlap = y + height + 16 - keyboardTop;
        if (overlap > 0) {
          scrollRef.current?.scrollTo({
            y: Math.max(0, detailScrollOffsetRef.current + overlap),
            animated: true,
          });
        }
      });
    });
  }, []);

  useEffect(() => {
    const showSubscription = Keyboard.addListener("keyboardDidShow", (event) => {
      detailKeyboardTopRef.current = event.endCoordinates.screenY;
      ensureDetailIngredientInputVisible();
    });
    const hideSubscription = Keyboard.addListener("keyboardDidHide", () => {
      detailKeyboardTopRef.current = null;
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [ensureDetailIngredientInputVisible]);

  const handleAddDetailIngredient = useCallback(async () => {
    const name = detailIngredientDraft.trim();
    if (!name) return;
    const normalizedName = normalizeIngredientClassificationName(name);
    const duplicate = (form.ingredients ?? []).some(
      (ingredient) =>
        normalizeIngredientClassificationName(
          getIngredientName(ingredient as IngredientValue),
        ) === normalizedName,
    );
    if (duplicate) {
      setDetailIngredientDraft("");
      requestAnimationFrame(() => {
        detailIngredientInputRef.current?.focus();
        ensureDetailIngredientInputVisible();
      });
      return;
    }
    const existing = (form.ingredients ?? [])
      .map((ingredient) => normalizeIngredientValue(ingredient as IngredientValue))
      .filter(isIngredient);
    const ingredientType = await classifyIngredientType(name);
    persistDetailIngredients([
      ...existing,
      createManualIngredient(name, ingredientType),
    ]);
    setDetailIngredientDraft("");
    requestAnimationFrame(() => {
      detailIngredientInputRef.current?.focus();
      setTimeout(ensureDetailIngredientInputVisible, 50);
    });
  }, [
    detailIngredientDraft,
    ensureDetailIngredientInputVisible,
    form.ingredients,
    persistDetailIngredients,
  ]);

  useEffect(() => {
    if (!isDetailIngredientsEditing || !detailIngredientInputRef.current?.isFocused()) {
      return;
    }
    const timeout = setTimeout(ensureDetailIngredientInputVisible, 50);
    return () => clearTimeout(timeout);
  }, [
    ensureDetailIngredientInputVisible,
    form.ingredients?.length,
    isDetailIngredientsEditing,
  ]);

  const handleMoveDetailIngredient = useCallback(
    (index: number) => {
      const next = (form.ingredients ?? [])
        .map((ingredient, ingredientIndex) => {
          const normalized = normalizeIngredientValue(
            ingredient as IngredientValue,
          );
          if (!normalized || ingredientIndex !== index) return normalized;
          const moved = toggleIngredientType(normalized);
          void setIngredientClassificationPreference(
            moved.name,
            moved.ingredientType,
          );
          return moved;
        })
        .filter(isIngredient);
      persistDetailIngredients(next);
    },
    [form.ingredients, persistDetailIngredients],
  );

  const saveEditedDetailIngredient = useCallback(() => {
    const index = editingDetailIngredientIndex;
    if (index === null) return;
    const name = editingDetailIngredientDraft.trim();
    if (name) {
      const next = (form.ingredients ?? [])
        .map((ingredient, ingredientIndex) => {
          const normalized = normalizeIngredientValue(ingredient as IngredientValue);
          return normalized && ingredientIndex === index
            ? { ...normalized, name }
            : normalized;
        })
        .filter(isIngredient);
      persistDetailIngredients(next);
    }
    setEditingDetailIngredientIndex(null);
    setEditingDetailIngredientDraft("");
  }, [editingDetailIngredientDraft, editingDetailIngredientIndex, form.ingredients, persistDetailIngredients]);

  const startEditingDetailIngredient = useCallback((index: number, name: string) => {
    setDetailIngredientsExpanded(true);
    setDetailIngredientsEditing(true);
    setEditingDetailIngredientIndex(index);
    setEditingDetailIngredientDraft(name);
    requestAnimationFrame(() => detailIngredientEditInputRef.current?.focus());
  }, []);

  const endDetailIngredientEditing = useCallback(() => {
    saveEditedDetailIngredient();
    Keyboard.dismiss();
    setDetailIngredientsEditing(false);
    setDetailIngredientsExpanded(false);
    setDetailIngredientDraft("");
    setEditingDetailIngredientIndex(null);
    setEditingDetailIngredientDraft("");
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, [saveEditedDetailIngredient]);

  const handleDetailFamilyRatingChange = useCallback(
    (memberId: string, rating: FamilyRatingValue) => {
      if (!isEditMode) {
        setForm((current) => ({
          ...current,
          familyRatings: setFamilyRatingValue(
            current.familyRatings,
            memberId,
            rating
          ),
        }));
        return;
      }
      if (!form.id) return;
      const nextMeal: Meal = {
        ...(form as Meal),
        id: form.id,
        familyRatings: setFamilyRatingValue(
          form.familyRatings,
          memberId,
          rating
        ),
        updatedAt: new Date().toISOString(),
      };
      setForm(nextMeal);
      onUpdateMeal(nextMeal);
      triggerMealSaveHaptic();
    },
    [form, isEditMode, onUpdateMeal]
  );

  const persistDetailPatch = useCallback(
    (patch: Partial<Meal>) => {
      if (!isEditMode) {
        setForm((current) => ({ ...current, ...patch }));
        return;
      }
      if (!form.id) return;
      const nextMeal: Meal = {
        ...(form as Meal),
        ...patch,
        id: form.id,
        updatedAt: new Date().toISOString(),
      };
      setForm(nextMeal);
      onUpdateMeal(nextMeal);
      triggerMealSaveHaptic();
    },
    [form, isEditMode, onUpdateMeal]
  );

  const handleSaveDetailTitle = useCallback(() => {
    const title = detailTitleDraft.trim();
    setDetailTitleEditing(false);
    if (!title) {
      setDetailTitleDraft(form.title);
      return;
    }
    if (title !== form.title) persistDetailPatch({ title });
    setDetailTitleDraft(title);
  }, [detailTitleDraft, form.title, persistDetailPatch]);

  const handleSaveDetailNotes = useCallback(() => {
    const prepNotes = detailNotesDraft.trim();
    setDetailNotesEditing(false);
    if (prepNotes !== (form.prepNotes ?? "")) {
      persistDetailPatch({ prepNotes });
    }
    setDetailNotesDraft(prepNotes);
  }, [detailNotesDraft, form.prepNotes, persistDetailPatch]);

  const handleFocusDetailNotes = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, Platform.OS === "ios" ? 280 : 140);
  }, []);

  const handleDetailPickEmoji = useCallback(
    (emoji: string) => {
      persistDetailPatch({ emoji });
    },
    [persistDetailPatch]
  );

  const handleCycleDifficulty = useCallback(() => {
    const current = form.difficulty;
    persistDetailPatch({
      difficulty:
        typeof current !== "number"
          ? 1
          : current <= 1
          ? 3
          : current <= 3
          ? 5
          : 1,
    });
  }, [form.difficulty, persistDetailPatch]);

  const handleCycleExpense = useCallback(() => {
    const current = form.expense;
    persistDetailPatch({
      expense:
        typeof current !== "number"
          ? 1
          : current <= 1
          ? 3
          : current <= 3
          ? 5
          : 1,
    });
  }, [form.expense, persistDetailPatch]);

  const handleCloseManualCreate = useCallback(() => {
    if (!isCreateDirty) {
      onClose();
      return;
    }
    Keyboard.dismiss();
    Alert.alert(
      "Discard this meal?",
      "This meal and the information you entered won’t be saved.",
      [
        { text: "Keep Editing", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: onClose },
      ],
    );
  }, [isCreateDirty, onClose]);

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

  const validateDetailRecipeUrl = useCallback((value: string) => {
    try {
      const url = new URL(value.trim());
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("protocol");
      setDetailRecipeUrlError(null);
      return url.toString();
    } catch {
      setDetailRecipeUrlError("That link doesn’t look right. Check the URL and try again.");
      return null;
    }
  }, []);

  const handleSaveDetailRecipeLink = useCallback(() => {
    const recipeUrl = validateDetailRecipeUrl(detailRecipeUrlDraft);
    if (!recipeUrl) return;
    persistDetailPatch({ recipeUrl });
    setDetailRecipeExpanded(false);
  }, [detailRecipeUrlDraft, persistDetailPatch, validateDetailRecipeUrl]);

  const handleDetailRecipeAutoFill = useCallback(() => {
    const recipeUrl = validateDetailRecipeUrl(detailRecipeUrlDraft);
    if (!recipeUrl) return;
    if (onLaunchRecipeAutoFill) {
      Keyboard.dismiss();
      onLaunchRecipeAutoFill(recipeUrl);
      return;
    }
    detailAutoFillInFlightRef.current = true;
    updateField("recipeUrl", recipeUrl);
    setDetailAutoFillRequested(true);
  }, [detailRecipeUrlDraft, onLaunchRecipeAutoFill, updateField, validateDetailRecipeUrl]);

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

  const isManualCreate =
    !isEditMode && addMealStep === "manual" && !isAutoFillPreviewVisible;

  if (isEditMode || isManualCreate) {
    const difficultyLevel = DIFFICULTY_LEVELS.find(
      (level) => level.value === form.difficulty
    );
    const difficultyLabel = difficultyLevel?.label ?? "—";
    const difficultyColor = difficultyLevel
      ? theme.color[difficultyLevel.colorKey]
      : undefined;
    const hasExpense = typeof form.expense === "number";
    const expenseLabel = hasExpense
      ? "$".repeat(form.expense! >= 4 ? 3 : form.expense! <= 2 ? 1 : 2)
      : "—";
    const cuisineLabel = getCuisineLabel(form.cuisine) ?? "—";
    const freezerValue = getFreezerMealAmount(form as Meal);
    const isFamilyStar =
      useFamilyRatings && familyRatingSummary?.isUnanimousHeart === true;
    const visibleKeyIngredients =
      isDetailIngredientsExpanded || isDetailIngredientsEditing
        ? keyIngredientEntries
        : keyIngredientEntries.slice(0, 3);
    const hiddenIngredientCount =
      Math.max(0, keyIngredientEntries.length - 3) +
      pantryStapleEntries.length;

    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isManualCreate ? "Close without saving" : "Back"
            }
            onPress={isManualCreate ? handleCloseManualCreate : handleHeaderBack}
            style={styles.backButton}
          >
            <MaterialCommunityIcons
              name={isManualCreate ? "close" : "arrow-left"}
              size={24}
              color={theme.color.subtleInk}
            />
          </Pressable>
          <View style={styles.headerSpacer} />
          {isManualCreate ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Add meal"
              onPress={() => {
                if (!form.title.trim()) {
                  setShowTitleRequiredError(true);
                  setDetailTitleEditing(true);
                  return;
                }
                createMealFromValues(form, form.prepNotes ?? "");
              }}
              style={({ pressed }) => [
                styles.addIconButton,
                Boolean(form.title.trim()) && styles.addIconButtonDirty,
                pressed && styles.addIconButtonPressed,
              ]}
            >
              <MaterialCommunityIcons
                name="plus-circle"
                size={24}
                color={form.title.trim() ? theme.color.accent : theme.color.subtleInk}
              />
            </Pressable>
          ) : null}
        </View>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={styles.detailContent}
          onScroll={({ nativeEvent }) => {
            detailScrollOffsetRef.current = nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          <View style={styles.detailHero}>
            <Pressable
              style={styles.detailEmojiWrap}
              onPress={handleOpenEmojiPicker}
              accessibilityRole="button"
              accessibilityLabel="Meal icon"
              accessibilityHint="Double tap to change meal icon"
            >
              <MealEmoji value={form.emoji} size={54} />
            </Pressable>
            <View style={styles.detailHeroText}>
              {isDetailTitleEditing ? (
                <TextInput
                  value={detailTitleDraft}
                  onChangeText={(value) => {
                    const formattedValue = isManualCreate
                      ? handleManualTitleChange(value)
                      : capitalizeMealTitleWords(value);
                    setDetailTitleDraft(formattedValue);
                  }}
                  onBlur={handleSaveDetailTitle}
                  onSubmitEditing={() => Keyboard.dismiss()}
                  autoFocus
                  selectTextOnFocus
                  autoCapitalize="words"
                  returnKeyType="done"
                  style={[
                    styles.detailTitleInput,
                    !detailTitleDraft && styles.detailTitlePlaceholder,
                  ]}
                  accessibilityLabel="Meal title"
                  placeholder="Meal Title"
                  placeholderTextColor={theme.color.subtleInk}
                />
              ) : (
                <Pressable
                  onPress={() => {
                    setDetailTitleDraft(form.title);
                    setDetailTitleEditing(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Meal title, ${form.title}`}
                  accessibilityHint="Double tap to edit meal title"
                >
                  <Text
                    style={[
                      styles.detailTitle,
                      !form.title && styles.detailTitlePlaceholder,
                    ]}
                  >
                    {form.title || "Meal title"}
                  </Text>
                </Pressable>
              )}
              {showTitleRequiredError ? (
                <Text style={styles.fieldErrorText} accessibilityRole="alert">
                  Meal Title is required.
                </Text>
              ) : null}
              {showRatings && isGalaxyMeal ? (
                <View style={styles.galaxyMealTitleRow}>
                  <MaterialCommunityIcons name="creation" size={18} color="#8B5CF6" />
                  <Text style={styles.galaxyMealTitle}>Galaxy Meal</Text>
                </View>
              ) : showRatings && isFamilyStar ? (
                <Text style={styles.familyStarTitle}>⭐ Family Star</Text>
              ) : showRatings && useFamilyRatings && familyRatingSummary ? (
                <Text style={styles.detailRatingText}>
                  ⭐ {familyRatingSummary.average.toFixed(1)}
                </Text>
              ) : showRatings && useFamilyRatings ? (
                <Text style={styles.detailMutedText}>Not yet rated</Text>
              ) : showRatings && (form.rating ?? 0) > 0 ? (
                <RatingStars value={form.rating} size={18} gap={2} />
              ) : showRatings ? (
                <Text style={styles.detailMutedText}>Not yet rated</Text>
              ) : null}
              <Text style={styles.detailMutedText}>
                Served {form.servedCount ?? 0} {(form.servedCount ?? 0) === 1 ? "time" : "times"}
              </Text>
            </View>
          </View>

          {form.recipeUrl?.trim() ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="View original recipe"
              onPress={() => Linking.openURL(form.recipeUrl!.trim())}
              style={({ pressed }) => [styles.recipeAction, pressed && styles.detailPressed]}
            >
              <MaterialCommunityIcons name="link-variant" size={20} color={theme.color.accent} />
              <Text style={styles.recipeActionText}>View original recipe</Text>
              <MaterialCommunityIcons name="open-in-new" size={18} color={theme.color.subtleInk} />
            </Pressable>
          ) : (
            <View style={styles.detailRecipeSection}>
              <Text style={styles.detailSectionLabel}>Recipe Link</Text>
              <View style={[styles.detailRecipeCard, isDetailRecipeExpanded && styles.detailRecipeCardExpanded]}>
                <Pressable
                  onPress={() => setDetailRecipeExpanded((current) => !current)}
                  accessibilityRole="button"
                  accessibilityLabel={isDetailRecipeExpanded ? "Collapse recipe link" : "Add a recipe link"}
                  style={({ pressed }) => [styles.detailRecipeHeader, pressed && styles.detailPressed]}
                >
                  <MaterialCommunityIcons name="link-variant" size={20} color={theme.color.accent} />
                  <Text style={styles.detailRecipeHeaderText}>
                    {isDetailRecipeExpanded ? "Add a recipe link to this meal" : "Add a recipe link"}
                  </Text>
                  <MaterialCommunityIcons name={isDetailRecipeExpanded ? "chevron-up" : "chevron-down"} size={22} color={theme.color.subtleInk} />
                </Pressable>
                {isDetailRecipeExpanded ? (
                  <View style={styles.detailRecipeBody}>
                    <Text style={styles.detailRecipeHelper}>
                      Paste a recipe link below. You can save it now or use it to fill in this meal.
                    </Text>
                    <View style={[styles.detailRecipeInputRow, detailRecipeUrlError && styles.detailRecipeInputError]}>
                      <MaterialCommunityIcons name="link-variant" size={18} color={theme.color.subtleInk} />
                      <TextInput
                        value={detailRecipeUrlDraft}
                        onChangeText={(value) => {
                          setDetailRecipeUrlDraft(value);
                          setDetailRecipeUrlError(null);
                        }}
                        placeholder="https://www.example.com/recipe"
                        placeholderTextColor={theme.color.subtleInk}
                        autoCapitalize="none"
                        autoCorrect={false}
                        keyboardType="url"
                        returnKeyType="go"
                        onSubmitEditing={handleDetailRecipeAutoFill}
                        style={styles.detailRecipeInput}
                        accessibilityLabel="Recipe link"
                      />
                    </View>
                    {detailRecipeUrlError ? <Text style={styles.autoFillErrorText} accessibilityRole="alert">{detailRecipeUrlError}</Text> : null}
                    <Pressable
                      disabled={!detailRecipeUrlDraft.trim() || isAutoFillLoading}
                      onPress={handleDetailRecipeAutoFill}
                      accessibilityRole="button"
                      accessibilityLabel={`Auto Fill ${form.title} from recipe link`}
                      style={({ pressed }) => [styles.detailRecipePrimary, (!detailRecipeUrlDraft.trim() || isAutoFillLoading) && styles.autoFillButtonDisabled, pressed && styles.entryButtonPressed]}
                    >
                      <MaterialCommunityIcons name="creation" size={18} color={theme.color.ink} />
                      <Text style={styles.detailRecipePrimaryText}>Auto Fill Recipe</Text>
                    </Pressable>
                    <Pressable
                      disabled={!detailRecipeUrlDraft.trim() || isAutoFillLoading}
                      onPress={handleSaveDetailRecipeLink}
                      accessibilityRole="button"
                      accessibilityLabel={`Save recipe link for ${form.title}`}
                      style={({ pressed }) => [styles.detailRecipeSecondary, (!detailRecipeUrlDraft.trim() || isAutoFillLoading) && styles.autoFillButtonDisabled, pressed && styles.detailPressed]}
                    >
                      <MaterialCommunityIcons name="content-save-outline" size={18} color={theme.color.accent} />
                      <Text style={styles.detailRecipeSecondaryText}>Save Link for Later</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            </View>
          )}

          <View style={styles.detailSection}>
            <View style={styles.detailSectionHeader}>
              <Text style={styles.detailSectionLabel}>Key Ingredients</Text>
              <Pressable
                onPress={() => {
                  if (isDetailIngredientsEditing) {
                    endDetailIngredientEditing();
                  } else {
                    setDetailIngredientsExpanded(true);
                    setDetailIngredientsEditing(true);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`${isDetailIngredientsEditing ? "Done editing" : "Edit"} key ingredients`}
                hitSlop={8}
                style={({ pressed }) => pressed && styles.detailPressed}
              >
                <Text style={styles.detailSectionEditAction}>
                  {isDetailIngredientsEditing ? "Done" : "Edit"}
                </Text>
              </Pressable>
            </View>
            <View style={styles.detailIngredientList}>
              {visibleKeyIngredients.map(({ ingredient, index }) => (
                  <View
                    style={styles.detailIngredientListRow}
                    key={`${ingredient.name}-${index}`}
                  >
                    <Pressable
                      style={styles.detailIngredientDeleteTarget}
                      disabled={!isDetailIngredientsEditing}
                      onTouchStart={(event) => event.stopPropagation()}
                      onPress={() => handleRemoveDetailIngredient(index)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${ingredient.name}`}
                      hitSlop={6}
                    >
                      <MaterialCommunityIcons
                        name={
                          isDetailIngredientsEditing
                            ? "minus-circle-outline"
                            : "checkbox-blank-circle-outline"
                        }
                        size={18}
                        color={theme.color.accent}
                      />
                    </Pressable>
                    {editingDetailIngredientIndex === index ? (
                      <TextInput
                        ref={detailIngredientEditInputRef}
                        value={editingDetailIngredientDraft}
                        onChangeText={setEditingDetailIngredientDraft}
                        onTouchStart={(event) => event.stopPropagation()}
                        onSubmitEditing={saveEditedDetailIngredient}
                        onBlur={saveEditedDetailIngredient}
                        autoCapitalize="words"
                        returnKeyType="done"
                        selectTextOnFocus
                        style={[styles.detailIngredientTextTarget, styles.detailIngredientEditInput]}
                        accessibilityLabel={`Edit ${ingredient.name}`}
                      />
                    ) : (
                      <Pressable
                        onTouchStart={(event) => event.stopPropagation()}
                        disabled={!isDetailIngredientsEditing}
                        onPress={() => startEditingDetailIngredient(index, ingredient.name)}
                        style={styles.detailIngredientTextTarget}
                      >
                        <Text style={styles.detailIngredientListText} numberOfLines={1}>
                          {capitalizeMealTitleWords(ingredient.name)}
                        </Text>
                      </Pressable>
                    )}
                    {isDetailIngredientsEditing && pantryStapleEntries.length > 0 ? (
                      <Pressable
                        onTouchStart={(event) => event.stopPropagation()}
                        onPress={() => handleMoveDetailIngredient(index)}
                        accessibilityRole="button"
                        accessibilityLabel={`Move ${ingredient.name} to Pantry Staples`}
                        hitSlop={6}
                        style={styles.detailIngredientSwapTarget}
                      >
                        <MaterialCommunityIcons
                          name="arrow-down"
                          size={19}
                          color={theme.color.accent}
                        />
                      </Pressable>
                    ) : null}
                  </View>
              ))}

              {isDetailIngredientsEditing || visibleKeyIngredients.length === 0 ? (
              <View
                style={[
                  styles.detailAddIngredientRow,
                  styles.detailInlineIngredientRow,
                ]}
                onTouchStart={(event) => event.stopPropagation()}
              >
                <View style={styles.detailAddIngredientBulletSlot}>
                  <View style={styles.detailAddIngredientDot} />
                </View>
                <TextInput
                  ref={detailIngredientInputRef}
                  value={detailIngredientDraft}
                  onChangeText={setDetailIngredientDraft}
                  onSubmitEditing={handleAddDetailIngredient}
                  onFocus={() => {
                    setDetailIngredientsExpanded(true);
                    setDetailIngredientsEditing(true);
                    setTimeout(
                      ensureDetailIngredientInputVisible,
                      Platform.OS === "ios" ? 280 : 140,
                    );
                  }}
                  placeholder="Add Ingredient"
                  placeholderTextColor={theme.color.subtleInk}
                  autoCapitalize="words"
                  style={[
                    styles.detailAddIngredientInput,
                    styles.detailAddIngredientInputWithDot,
                  ]}
                  returnKeyType="next"
                  blurOnSubmit={false}
                />
                {detailIngredientDraft.trim() ? (
                <Pressable
                  onPress={handleAddDetailIngredient}
                  accessibilityRole="button"
                  accessibilityLabel="Add ingredient"
                  style={[
                    styles.detailAddIngredientButton,
                    styles.detailInlineIngredientButton,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="plus"
                    size={22}
                    color={theme.color.accent}
                  />
                </Pressable>
                ) : null}
              </View>
              ) : null}
            </View>

            {pantryStapleEntries.length > 0 &&
            (isDetailIngredientsEditing || isDetailIngredientsExpanded) ? (
              <View style={styles.detailPantrySection}>
                <Text style={styles.detailSectionLabel}>Pantry Staples</Text>
                {pantryStapleEntries.length ? (
                  <View style={styles.detailIngredientList}>
                    {pantryStapleEntries.map(({ ingredient, index }) => (
                      <View
                        style={styles.detailIngredientListRow}
                        key={`${ingredient.name}-${index}`}
                      >
                        <Pressable
                          style={styles.detailIngredientDeleteTarget}
                          disabled={!isDetailIngredientsEditing}
                          onTouchStart={(event) => event.stopPropagation()}
                          onPress={() => handleRemoveDetailIngredient(index)}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${ingredient.name}`}
                          hitSlop={6}
                        >
                          <MaterialCommunityIcons
                            name={
                              isDetailIngredientsEditing
                                ? "minus-circle-outline"
                                : "checkbox-blank-circle-outline"
                            }
                            size={18}
                            color={theme.color.accent}
                          />
                        </Pressable>
                        {editingDetailIngredientIndex === index ? (
                          <TextInput
                            ref={detailIngredientEditInputRef}
                            value={editingDetailIngredientDraft}
                            onChangeText={setEditingDetailIngredientDraft}
                            onTouchStart={(event) => event.stopPropagation()}
                            onSubmitEditing={saveEditedDetailIngredient}
                            onBlur={saveEditedDetailIngredient}
                            autoCapitalize="words"
                            returnKeyType="done"
                            selectTextOnFocus
                            style={[styles.detailIngredientTextTarget, styles.detailIngredientEditInput, styles.detailPantryChipText]}
                            accessibilityLabel={`Edit ${ingredient.name}`}
                          />
                        ) : (
                      <Pressable
                        onTouchStart={(event) => event.stopPropagation()}
                        disabled={!isDetailIngredientsEditing}
                        onPress={() => startEditingDetailIngredient(index, ingredient.name)}
                        style={styles.detailIngredientTextTarget}
                          >
                            <Text style={[styles.detailIngredientListText, styles.detailPantryChipText]} numberOfLines={1}>
                              {capitalizeMealTitleWords(ingredient.name)}
                            </Text>
                          </Pressable>
                        )}
                        {isDetailIngredientsEditing ? (
                          <Pressable
                            onTouchStart={(event) => event.stopPropagation()}
                            onPress={() => handleMoveDetailIngredient(index)}
                            accessibilityRole="button"
                            accessibilityLabel={`Move ${ingredient.name} to Key Ingredients`}
                            hitSlop={6}
                            style={styles.detailIngredientSwapTarget}
                          >
                            <MaterialCommunityIcons
                              name="arrow-up"
                              size={19}
                              color={theme.color.accent}
                            />
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            ) : null}

            {!isDetailIngredientsEditing && hiddenIngredientCount > 0 ? (
              <Pressable
                onPress={() => setDetailIngredientsExpanded((current) => !current)}
                accessibilityRole="button"
              >
                <Text style={styles.detailMoreIngredientsText}>
                  {isDetailIngredientsExpanded
                    ? "Show less"
                    : `+ ${hiddenIngredientCount} more ingredient${hiddenIngredientCount === 1 ? "" : "s"}`}
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.detailSection}>
            <Text style={styles.detailSectionLabel}>Details</Text>
            <View style={styles.detailGrid}>
              <Pressable
                onPress={handleCycleDifficulty}
                accessibilityRole="button"
                accessibilityLabel={`Difficulty, ${difficultyLabel}`}
                accessibilityHint="Double tap to change difficulty"
                style={({ pressed }) => [styles.detailTile, pressed && styles.detailPressed]}
              >
                <Text style={styles.detailTileLabel}>Difficulty</Text>
                <View style={styles.detailDifficultyValueRow}>
                  {difficultyColor ? (
                    <View style={[styles.detailDifficultyDot, { backgroundColor: difficultyColor }]} />
                  ) : null}
                  <Text style={[styles.detailTileValue, !difficultyLevel && styles.detailTileValueUnset]}>{difficultyLabel}</Text>
                  {!difficultyLevel ? <Text style={styles.detailTileAdd}>+</Text> : null}
                </View>
              </Pressable>
              <Pressable
                onPress={handleCycleExpense}
                accessibilityRole="button"
                accessibilityLabel={hasExpense ? `Expense, ${expenseLabel.length} dollar signs` : "Expense, not set"}
                accessibilityHint="Double tap to change expense"
                style={({ pressed }) => [styles.detailTile, pressed && styles.detailPressed]}
              ><Text style={styles.detailTileLabel}>Expense</Text><View style={styles.detailTileValueRow}><Text style={[styles.detailTileValue, !hasExpense && styles.detailTileValueUnset]}>{expenseLabel}</Text>{!hasExpense ? <Text style={styles.detailTileAdd}>+</Text> : null}</View></Pressable>
              <Pressable
                onPress={() => setCuisineSelectorVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={`Cuisine, ${cuisineLabel}`}
                accessibilityHint="Double tap to choose a cuisine"
                style={({ pressed }) => [styles.detailTile, pressed && styles.detailPressed]}
              >
                <Text style={styles.detailTileLabel}>Cuisine</Text>
                <View style={styles.detailTileValueRow}>
                  <Text style={[styles.detailTileValue, !form.cuisine && styles.detailTileValueUnset]}>{cuisineLabel}</Text>
                  {!form.cuisine ? <Text style={styles.detailTileAdd}>+</Text> : null}
                </View>
              </Pressable>
              {freezerValue ? (
                <View style={styles.detailTile}><Text style={styles.detailTileLabel}>Freezer</Text><Text style={styles.detailTileValue}>{formatFreezerMealAmount(freezerValue)}</Text></View>
              ) : null}
            </View>
          </View>

          {showRatings ? <View style={styles.detailSection}>
            <Text style={styles.detailSectionLabel}>
              {useFamilyRatings ? "Family Rating" : "Ratings"}
            </Text>
            {useFamilyRatings ? (
              <FamilyRatingAchievements
                isFamilyStar={isFamilyStar}
                isGalaxyMeal={Boolean(isGalaxyMeal)}
              />
            ) : null}
            <View
              style={[
                styles.familyDetailIcons,
                !useFamilyRatings && styles.ratingStarsCentered,
              ]}
            >
              {useFamilyRatings ? (
                <FamilyRatingRow
                  ratings={form.familyRatings}
                  onChange={handleDetailFamilyRatingChange}
                />
              ) : (
                <RatingStars
                  value={form.rating ?? 0}
                  size={32}
                  onChange={(rating) => persistDetailPatch({ rating })}
                />
              )}
            </View>
          </View> : null}

          <View style={styles.detailSection}>
            <Text style={styles.detailSectionLabel}>Prep Notes</Text>
            {isDetailNotesEditing ? (
              <TextInput
                value={detailNotesDraft}
                onChangeText={setDetailNotesDraft}
                onBlur={handleSaveDetailNotes}
                onFocus={handleFocusDetailNotes}
                onSubmitEditing={() => Keyboard.dismiss()}
                autoFocus
                multiline
                blurOnSubmit
                returnKeyType="done"
                style={styles.detailNotesInput}
                placeholder="Add prep note"
                placeholderTextColor={theme.color.subtleInk}
              />
            ) : form.prepNotes?.trim() ? (
              <Pressable
                onPress={() => {
                  setDetailNotesDraft(form.prepNotes ?? "");
                  setDetailNotesEditing(true);
                }}
                accessibilityRole="button"
                accessibilityHint="Double tap to edit prep notes"
                style={styles.detailNotesCard}
              ><Text style={styles.detailNotesText}>{form.prepNotes.trim()}</Text></Pressable>
            ) : (
              <Pressable
                onPress={() => {
                  setDetailNotesDraft("");
                  setDetailNotesEditing(true);
                }}
                accessibilityRole="button"
              ><Text style={styles.detailEditText}>+ Add prep note</Text></Pressable>
            )}
          </View>

        </ScrollView>
        <EmojiPickerModal
          visible={isEmojiPickerVisible}
          selectedEmoji={form.emoji ?? DEFAULT_MEAL_EMOJI}
          suggestedEmoji={showEmojiSuggestion ? suggestedEmoji : undefined}
          onPick={handleDetailPickEmoji}
          onClose={handleCloseEmojiPicker}
        />
        <CuisineSelectorModal
          visible={isCuisineSelectorVisible}
          selected={form.cuisine}
          mealTitle={form.title}
          mealEmoji={form.emoji}
          onSelect={(cuisine) => {
            persistDetailPatch({ cuisine });
          }}
          onClose={() => setCuisineSelectorVisible(false)}
        />
      </View>
    );
  }

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
            onPress={() => {
              setDetailTitleDraft(form.title);
              setDetailTitleEditing(true);
              setDetailIngredientsExpanded(true);
              setDetailIngredientsEditing(true);
              setAddMealStep("manual");
            }}
            style={({ pressed }) => [
              styles.manualEntryCard,
              pressed && styles.entryButtonPressed,
            ]}
          >
            <View style={styles.manualEntryIcon}>
              <MaterialCommunityIcons
                name="pencil-outline"
                size={24}
                color={theme.color.accent}
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

  if (addMealStep === "autofill-loading") {
    return (
      <View style={styles.container}>
        {renderHeader(true)}
        <RecipeAutoFillProgress complete={!isAutoFillLoading} />
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
                <MealEmoji value={form.emoji} size={42} />
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
              onChangeText={handleManualTitleChange}
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
            <View style={styles.detailSectionHeader}>
              <Text style={styles.sectionLabel}>KEY INGREDIENTS</Text>
              <Pressable
                onPress={handleToggleIngredientDeleteMode}
                disabled={!hasIngredients}
                accessibilityRole="button"
                accessibilityState={{ disabled: !hasIngredients }}
                accessibilityLabel={`${isIngredientDeleteMode ? "Done editing" : "Edit"} key ingredients`}
                hitSlop={8}
                style={({ pressed }) => pressed && hasIngredients && styles.detailPressed}
              >
                <Text
                  style={[
                    styles.detailSectionEditAction,
                    !hasIngredients && styles.ingredientEditActionDisabled,
                  ]}
                >
                  {isIngredientDeleteMode ? "Done" : "Edit"}
                </Text>
              </Pressable>
            </View>
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
                onSubmitEditing={handleAddIngredient}
                returnKeyType="done"
              />
            </View>
            <>
                <Text style={[styles.sectionLabel, styles.pantrySectionLabel]}>
                  PANTRY STAPLES
                </Text>
                {pantryStapleEntries.length ? (
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
                ) : (
                  <Text style={styles.ingredientsEmpty}>
                    Pantry staples added above will appear here.
                  </Text>
                )}
              </>
          </View>

          {showRatings ? <View style={styles.section}>
            <Text style={styles.sectionLabel}>Rating</Text>
            <FlexGrid.Row justifyContent="center">
              {useFamilyRatings ? (
                <FamilyRatingRow
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
          </View> : null}

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
          presentationStyle="overFullScreen"
          visible={isAutoFillPreviewVisible && Boolean(autoFillDraft)}
          onRequestClose={closeAutoFillPreview}
        >
          <View style={styles.autoFillModalBackdrop}>
            <View
              style={[
                styles.autoFillModalContent,
                {
                  paddingTop: stableTopInset + theme.space.md,
                  paddingBottom: stableBottomInset,
                },
              ]}
            >
              <View style={styles.autoFillModalHeader}>
                <View style={styles.autoFillEmojiPreview}>
                  <MealEmoji value={autoFillPreviewEmoji} size={46} />
                </View>
                <View style={styles.autoFillHeaderText}>
                  <Text style={styles.autoFillEyebrow}>RECIPE FOUND ✨</Text>
                  <TextInput
                    placeholder="Meal title"
                    placeholderTextColor={theme.color.subtleInk}
                    style={styles.autoFillHeroTitleInput}
                    value={autoFillDraft?.title ?? ""}
                    onChangeText={(value) => updateAutoFillDraft("title", value)}
                    autoCapitalize="words"
                    accessibilityLabel="Meal title"
                  />
                  <Text style={styles.autoFillModalDescription}>
                    Make any changes before {autoFillApplyMode === "details" ? "applying these details" : "adding this meal"}.
                  </Text>
                </View>
              </View>

              <ScrollView
                ref={autoFillScrollRef}
                style={styles.autoFillModalScroll}
                contentContainerStyle={styles.autoFillModalScrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                automaticallyAdjustKeyboardInsets
              >
                <View style={styles.detailSection}>
                  <View style={styles.detailSectionHeader}>
                    <Text style={styles.detailSectionLabel}>Key Ingredients</Text>
                    <Pressable
                      onPress={() => {
                        Keyboard.dismiss();
                        setIsAutoFillIngredientDeleteMode((current) => !current);
                        setNewAutoFillIngredient("");
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${isAutoFillIngredientDeleteMode ? "Done editing" : "Edit"} key ingredients`}
                      hitSlop={8}
                      style={({ pressed }) => pressed && styles.detailPressed}
                    >
                      <Text style={styles.detailSectionEditAction}>
                        {isAutoFillIngredientDeleteMode ? "Done" : "Edit"}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={styles.detailIngredientList}>
                    {autoFillKeyIngredientEntries.map(({ ingredient, index }) => (
                      <View key={`${ingredient.name}-${index}`} style={styles.detailIngredientListRow}>
                        <Pressable
                          disabled={!isAutoFillIngredientDeleteMode}
                          onPress={() => handleRemoveAutoFillIngredient(index)}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${ingredient.name}`}
                          hitSlop={6}
                          style={styles.detailIngredientDeleteTarget}
                        >
                          <MaterialCommunityIcons
                            name={isAutoFillIngredientDeleteMode ? "minus-circle-outline" : "checkbox-blank-circle-outline"}
                            size={18}
                            color={theme.color.accent}
                          />
                        </Pressable>
                        <View style={styles.detailIngredientTextTarget}>
                          <Text style={styles.detailIngredientListText} numberOfLines={1}>
                            {capitalizeMealTitleWords(ingredient.name)}
                          </Text>
                        </View>
                        {isAutoFillIngredientDeleteMode && autoFillPantryStapleEntries.length > 0 ? (
                          <Pressable
                            onPress={() => handleToggleAutoFillIngredientType(index)}
                            accessibilityRole="button"
                            accessibilityLabel={`Move ${ingredient.name} to Pantry Staples`}
                            hitSlop={6}
                            style={styles.detailIngredientSwapTarget}
                          >
                            <MaterialCommunityIcons name="arrow-down" size={19} color={theme.color.accent} />
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                    {isAutoFillIngredientDeleteMode || autoFillKeyIngredientEntries.length === 0 ? (
                      <View style={[styles.detailAddIngredientRow, styles.detailInlineIngredientRow]}>
                        <View style={styles.detailAddIngredientBulletSlot}>
                          <View style={styles.detailAddIngredientDot} />
                        </View>
                        <TextInput
                          ref={autoFillIngredientInputRef}
                          placeholder="Add Ingredient"
                          placeholderTextColor={theme.color.subtleInk}
                          style={[styles.detailAddIngredientInput, styles.detailAddIngredientInputWithDot]}
                          value={newAutoFillIngredient}
                          onChangeText={setNewAutoFillIngredient}
                          onSubmitEditing={handleAddAutoFillIngredient}
                          onFocus={() => setIsAutoFillIngredientDeleteMode(true)}
                          autoCapitalize="words"
                          returnKeyType="next"
                          blurOnSubmit={false}
                        />
                        {newAutoFillIngredient.trim() ? (
                          <Pressable
                            onPress={handleAddAutoFillIngredient}
                            accessibilityRole="button"
                            accessibilityLabel="Add ingredient"
                            style={[styles.detailAddIngredientButton, styles.detailInlineIngredientButton]}
                          >
                            <MaterialCommunityIcons name="plus" size={22} color={theme.color.accent} />
                          </Pressable>
                        ) : null}
                      </View>
                    ) : null}
                  </View>

                  {autoFillPantryStapleEntries.length > 0 ? (
                    <View style={styles.detailPantrySection}>
                      <Text style={styles.detailSectionLabel}>Pantry Staples</Text>
                        <View style={styles.detailIngredientList}>
                          {autoFillPantryStapleEntries.map(({ ingredient, index }) => (
                            <View key={`${ingredient.name}-${index}`} style={styles.detailIngredientListRow}>
                              <Pressable
                                disabled={!isAutoFillIngredientDeleteMode}
                                onPress={() => handleRemoveAutoFillIngredient(index)}
                                accessibilityRole="button"
                                accessibilityLabel={`Remove ${ingredient.name}`}
                                hitSlop={6}
                                style={styles.detailIngredientDeleteTarget}
                              >
                                <MaterialCommunityIcons
                                  name={isAutoFillIngredientDeleteMode ? "minus-circle-outline" : "checkbox-blank-circle-outline"}
                                  size={18}
                                  color={theme.color.accent}
                                />
                              </Pressable>
                              <View style={styles.detailIngredientTextTarget}>
                                <Text style={[styles.detailIngredientListText, styles.detailPantryChipText]} numberOfLines={1}>
                                  {capitalizeMealTitleWords(ingredient.name)}
                                </Text>
                              </View>
                              {isAutoFillIngredientDeleteMode ? (
                                <Pressable
                                  onPress={() => handleToggleAutoFillIngredientType(index)}
                                  accessibilityRole="button"
                                  accessibilityLabel={`Move ${ingredient.name} to Key Ingredients`}
                                  hitSlop={6}
                                  style={styles.detailIngredientSwapTarget}
                                >
                                  <MaterialCommunityIcons name="arrow-up" size={19} color={theme.color.accent} />
                                </Pressable>
                              ) : null}
                            </View>
                          ))}
                        </View>
                    </View>
                  ) : null}
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionLabel}>Details</Text>
                  <View style={styles.detailGrid}>
                    <Pressable
                      onPress={() =>
                        updateAutoFillDraft(
                          "difficulty",
                          typeof autoFillDraft?.difficulty !== "number"
                            ? 1
                            : autoFillDraft.difficulty <= 1
                              ? 3
                              : autoFillDraft.difficulty <= 3
                                ? 5
                                : 1,
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Difficulty, ${autoFillDifficultyLabel}`}
                      accessibilityHint="Double tap to change difficulty"
                      style={({ pressed }) => [
                        styles.detailTile,
                        pressed && styles.detailPressed,
                      ]}
                    >
                      <Text style={styles.detailTileLabel}>Difficulty</Text>
                      <View style={styles.detailDifficultyValueRow}>
                        {autoFillDifficultyColor ? (
                          <View
                            style={[
                              styles.detailDifficultyDot,
                              { backgroundColor: autoFillDifficultyColor },
                            ]}
                          />
                        ) : null}
                        <Text
                          style={[
                            styles.detailTileValue,
                            !autoFillDifficultyLevel && styles.detailTileValueUnset,
                          ]}
                        >
                          {autoFillDifficultyLabel}
                        </Text>
                        {!autoFillDifficultyLevel ? (
                          <Text style={styles.detailTileAdd}>+</Text>
                        ) : null}
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={() =>
                        updateAutoFillDraft(
                          "expense",
                          typeof autoFillDraft?.expense !== "number"
                            ? 1
                            : autoFillDraft.expense <= 1
                              ? 3
                              : autoFillDraft.expense <= 3
                                ? 5
                                : 1,
                        )
                      }
                      accessibilityRole="button"
                      accessibilityLabel={`Expense, ${autoFillExpenseLabel}`}
                      accessibilityHint="Double tap to change expense"
                      style={({ pressed }) => [
                        styles.detailTile,
                        pressed && styles.detailPressed,
                      ]}
                    >
                      <Text style={styles.detailTileLabel}>Expense</Text>
                      <View style={styles.detailTileValueRow}>
                        <Text
                          style={[
                            styles.detailTileValue,
                            typeof autoFillDraft?.expense !== "number" &&
                              styles.detailTileValueUnset,
                          ]}
                        >
                          {autoFillExpenseLabel}
                        </Text>
                        {typeof autoFillDraft?.expense !== "number" ? (
                          <Text style={styles.detailTileAdd}>+</Text>
                        ) : null}
                      </View>
                    </Pressable>
                    <Pressable
                      onPress={openAutoFillCuisineSelector}
                      accessibilityRole="button"
                      accessibilityLabel={`Cuisine, ${autoFillCuisineLabel}`}
                      accessibilityHint="Double tap to choose a cuisine"
                      style={({ pressed }) => [
                        styles.detailTile,
                        pressed && styles.detailPressed,
                      ]}
                    >
                      <Text style={styles.detailTileLabel}>Cuisine</Text>
                      <View style={styles.detailTileValueRow}>
                        <Text
                          style={[
                            styles.detailTileValue,
                            !autoFillDraft?.cuisine && styles.detailTileValueUnset,
                          ]}
                        >
                          {autoFillCuisineLabel}
                        </Text>
                        {!autoFillDraft?.cuisine ? (
                          <Text style={styles.detailTileAdd}>+</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  </View>
                </View>

                <View
                  style={styles.detailSection}
                  onLayout={({ nativeEvent }) => {
                    autoFillNotesSectionOffsetRef.current =
                      nativeEvent.layout.y;
                  }}
                >
                  <Text style={styles.detailSectionLabel}>Prep Notes</Text>
                  <TextInput
                    placeholder="Add reminders or prep steps"
                    placeholderTextColor={theme.color.subtleInk}
                    style={styles.detailNotesInput}
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
                  accessibilityLabel={autoFillApplyMode === "details" ? "Apply reviewed recipe details" : "Add meal with the reviewed recipe details"}
                >
                  <Text
                    style={[
                      styles.autoFillModalButtonText,
                      styles.autoFillModalButtonTextPrimary,
                      !hasAutoFillSelection &&
                        styles.autoFillModalButtonTextDisabled,
                    ]}
                  >
                    {autoFillApplyMode === "details" ? "Apply Details" : "Add Meal"}
                  </Text>
                </Pressable>
              </View>
            </View>
            <CuisineSelectorModal
              embedded
              visible={isAutoFillCuisineSelectorVisible}
              selected={autoFillDraft?.cuisine}
              mealTitle={autoFillDraft?.title ?? form.title}
              mealEmoji={autoFillPreviewEmoji}
              onSelect={(cuisine) => {
                updateAutoFillDraft("cuisine", cuisine);
              }}
              onClose={closeAutoFillCuisineSelector}
            />
          </View>
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
    detailContent: { paddingHorizontal: theme.space.xl, paddingTop: theme.space.xl, paddingBottom: theme.space["2xl"], gap: theme.space.xl },
    detailHero: { flexDirection: "row", alignItems: "center", gap: theme.space.lg, paddingVertical: theme.space.sm },
    detailEmojiWrap: { width: 76, height: 76, borderRadius: theme.radius.xl, alignItems: "center", justifyContent: "center", backgroundColor: theme.color.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.cardOutline },
    detailEmoji: { fontSize: 46 },
    detailHeroText: { flex: 1, gap: theme.space.xs },
    detailTitle: { color: theme.color.ink, fontSize: theme.type.size.h1, fontWeight: theme.type.weight.bold },
    detailTitleInput: { color: theme.color.ink, fontSize: theme.type.size.h1, fontWeight: theme.type.weight.bold, padding: 0, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.accent },
    detailTitlePlaceholder: { fontSize: theme.type.size.title },
    detailRatingText: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.medium },
    familyStarTitle: { color: "#FEC107", fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
    galaxyMealTitleRow: { flexDirection: "row", alignItems: "center", gap: theme.space.xs },
    galaxyMealTitle: { color: "#8B5CF6", fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
    detailMutedText: { color: theme.color.subtleInk, fontSize: theme.type.size.sm },
    recipeAction: { flexDirection: "row", alignItems: "center", gap: theme.space.sm, padding: theme.space.md, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceAlt },
    recipeActionText: { flex: 1, color: theme.color.accent, fontSize: theme.type.size.base, fontWeight: theme.type.weight.medium },
    detailRecipeSection: { gap: theme.space.sm },
    detailRecipeCard: { borderRadius: theme.radius.md, backgroundColor: alpha(theme.color.accent, theme.mode === "dark" ? 0.09 : 0.06), overflow: "hidden" },
    detailRecipeCardExpanded: { paddingBottom: theme.space.md },
    detailRecipeHeader: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: theme.space.sm, paddingHorizontal: theme.space.md },
    detailRecipeHeaderText: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold },
    detailRecipeBody: { gap: theme.space.sm, paddingHorizontal: theme.space.md },
    detailRecipeHelper: { color: theme.color.subtleInk, fontSize: theme.type.size.sm, lineHeight: 20 },
    detailRecipeInputRow: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: theme.space.sm, paddingHorizontal: theme.space.md, borderRadius: theme.radius.md, backgroundColor: theme.color.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
    detailRecipeInputError: { borderColor: theme.color.danger },
    detailRecipeInput: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.sm, paddingVertical: 0 },
    detailRecipePrimary: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm, borderRadius: theme.radius.md, backgroundColor: theme.color.accent },
    detailRecipePrimaryText: { color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold },
    detailRecipeSecondary: { minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.accent, backgroundColor: "transparent" },
    detailRecipeSecondaryText: { color: theme.color.accent, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold },
    detailSection: { gap: theme.space.md },
    detailSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    detailSectionEditAction: { color: theme.color.accent, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold },
    ingredientEditActionDisabled: { color: theme.color.border },
    detailSectionLabel: { color: theme.color.subtleInk, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.medium, textTransform: "uppercase", letterSpacing: 0.8 },
    detailEditText: { color: theme.color.accent, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold },
    detailIngredientList: { gap: theme.space.xs },
    detailIngredientListRow: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: theme.space.sm },
    detailIngredientDeleteTarget: { width: 32, minHeight: 38, alignItems: "center", justifyContent: "center" },
    detailIngredientSwapTarget: { width: 36, minHeight: 38, alignItems: "center", justifyContent: "center" },
    detailIngredientTextTarget: { flex: 1, minHeight: 38, justifyContent: "center" },
    detailIngredientListText: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.medium },
    detailIngredientEditInput: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.medium, textTransform: "capitalize", paddingVertical: 0, borderBottomWidth: 1, borderBottomColor: theme.color.accent },
    detailIngredientsGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.sm },
    detailChip: { width: "48.5%", height: 44, flexDirection: "row", alignItems: "center", gap: theme.space.sm, borderRadius: theme.radius.md, paddingHorizontal: theme.space.md, backgroundColor: theme.color.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
    detailChipEditing: { paddingRight: theme.space.sm },
    detailChipDot: { width: 7, height: 7, borderRadius: theme.radius.full, backgroundColor: theme.color.accent },
    detailChipText: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium },
    detailPantryChip: { backgroundColor: theme.color.surfaceAlt, borderColor: theme.color.cardOutline },
    detailPantryChipText: { color: theme.color.subtleInk },
    detailPantrySection: { gap: theme.space.md, paddingTop: theme.space.lg },
    detailEmptyText: { color: theme.color.subtleInk, fontSize: theme.type.size.sm },
    detailMoreIngredientsText: { color: theme.color.accent, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium },
    detailAddIngredientRow: { minHeight: 48, flexDirection: "row", alignItems: "center", borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
    detailInlineIngredientRow: { minHeight: 38, gap: theme.space.sm, borderRadius: 0, backgroundColor: "transparent", borderWidth: 0 },
    detailAddIngredientBulletSlot: { width: 32, minHeight: 38, alignItems: "center", justifyContent: "center" },
    detailAddIngredientDot: { width: 8, height: 8, borderRadius: theme.radius.full, backgroundColor: theme.color.accent },
    detailAddIngredientInput: { flex: 1, minHeight: 48, paddingHorizontal: theme.space.md, color: theme.color.ink, fontSize: theme.type.size.base },
    detailAddIngredientInputWithDot: { minHeight: 38, paddingHorizontal: 0 },
    detailAddIngredientButton: { width: 44, height: 44, marginRight: theme.space.xs, borderRadius: theme.radius.full, alignItems: "center", justifyContent: "center" },
    detailInlineIngredientButton: { width: 36, height: 38, marginRight: 0 },
    detailGrid: { flexDirection: "row", flexWrap: "wrap", gap: theme.space.md },
    detailTile: { minWidth: "46%", flexGrow: 1, gap: theme.space.xs, padding: theme.space.md, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceAlt },
    detailTileLabel: { color: theme.color.subtleInk, fontSize: theme.type.size.xs, textTransform: "uppercase", letterSpacing: 0.5 },
    detailDifficultyValueRow: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
    detailTileValueRow: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
    detailDifficultyDot: { width: 8, height: 8, borderRadius: theme.radius.full },
    detailTileValue: { color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
    detailTileValueUnset: { color: theme.color.subtleInk, fontWeight: theme.type.weight.medium },
    detailTileAdd: { marginLeft: "auto", color: theme.color.accent, fontSize: theme.type.size.title, fontWeight: theme.type.weight.medium },
    detailNotesCard: { padding: theme.space.lg, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceAlt },
    detailNotesText: { color: theme.color.ink, fontSize: theme.type.size.base, lineHeight: 23 },
    detailNotesInput: { minHeight: 104, padding: theme.space.lg, borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceAlt, color: theme.color.ink, fontSize: theme.type.size.base, lineHeight: 23, textAlignVertical: "top", borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.cardOutline },
    familyDetailCard: { borderRadius: theme.radius.md, backgroundColor: theme.color.surfaceAlt, paddingHorizontal: theme.space.lg },
    familyDetailIcons: { alignItems: "stretch", paddingVertical: theme.space.sm },
    ratingStarsCentered: { alignItems: "center" },
    familyDetailRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border },
    familyDetailName: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.medium },
    familyDetailReaction: { color: theme.color.subtleInk, fontSize: theme.type.size.title },
    detailPressed: { opacity: 0.82 },
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
      width: "100%",
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.space.xl,
    },
    entryDividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.color.border,
    },
    entryDividerText: {
      width: 44,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      lineHeight: 20,
      textAlign: "center",
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
      backgroundColor: theme.color.focus,
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
      backgroundColor: theme.color.bg,
    },
    autoFillModalContent: {
      width: "100%",
      flex: 1,
      backgroundColor: theme.color.bg,
      paddingTop: theme.space.md,
      gap: theme.space.md,
    },
    autoFillModalHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.lg,
      marginHorizontal: theme.space.xl,
      paddingVertical: theme.space.sm,
    },
    autoFillEmojiPreview: {
      width: 76,
      height: 76,
      borderRadius: theme.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
    },
    autoFillHeaderText: {
      flex: 1,
      gap: theme.space.xs,
    },
    autoFillEyebrow: {
      color: theme.color.accent,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.bold,
      letterSpacing: 0.8,
    },
    autoFillHeroTitleInput: {
      color: theme.color.ink,
      fontSize: theme.type.size.h1,
      fontWeight: theme.type.weight.bold,
      paddingHorizontal: 0,
      paddingVertical: 0,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.accent,
    },
    autoFillModalDescription: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      lineHeight: 19,
    },
    autoFillModalScroll: {
      flex: 1,
      minHeight: 0,
    },
    autoFillModalScrollContent: {
      gap: theme.space.xl,
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space.sm,
      paddingBottom: theme.space.lg,
    },
    autoFillModalActions: {
      flexDirection: "row",
      gap: theme.space.md,
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space.sm,
      paddingBottom: theme.space.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border,
      backgroundColor: theme.color.bg,
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
  });
