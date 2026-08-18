import {
  Alert,
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  FlatList,
  Keyboard,
  ListRenderItem,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import {
  GestureHandlerRootView,
  RectButton,
  Swipeable,
} from "react-native-gesture-handler";
import MealListItem from "../../../components/meals/MealListItem";
import FreezerAmountModal from "../../../components/meals/FreezerAmountModal";
import DisplayOnCardsSheet from "../../../components/meals/DisplayOnCardsSheet";
import MealSearchModal from "../../../components/meals/MealSearchModal";
import MealTabs, { type MealTabKey } from "../../../components/meals/MealTabs";
import MealModalOverlay from "../../../components/meals/MealModalOverlay";
import MealCompletionCard from "../../../components/meals/MealCompletionCard";
import PlannedMealDeletionModal from "../../../components/meals/PlannedMealDeletionModal";
import MealSearchInput, {
  type MealSortSelection,
} from "../../../components/meals/MealSearchInput";
import DayPlannedToast from "../../../components/plan-week/planned-meals/DayPlannedToast";
import TabParent from "../../../components/tab-parent/TabParent";
import { useMeals } from "../../../hooks/useMeals";
import { useFamilyMembers } from "../../../hooks/useFamilyMembers";
import { useWeekStartController } from "../../../providers/week-start/WeekStartController";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import { Ingredient, Meal, MealDraft, createMealId } from "../../../types/meals";
import {
  addSavedMealIdeaToWeekPlan,
  clearWeekPlanData,
  snapshotMealTitleInWeekPlanHistory,
} from "../../../stores/weekPlanStorage";
import { snapshotServedMealTitle } from "../../../stores/servedMealsStorage";
import { getNextWeekStartForDate } from "../../../utils/weekDays";
import {
  getActivePlannedMealOccurrences,
  PlannedMealOccurrence,
} from "../../../utils/plannedMealDeletion";
import {
  getPendingRecipeImports,
  removePendingRecipeImport,
  type PendingRecipeImport,
} from "../../../utils/pendingRecipeImports";
import {
  isMealIncomplete,
  mergeConfirmedIngredients,
} from "../../../utils/mealCompletion";
import {
  isFamilyRatingsEligible,
  useRatingDisplayMode,
} from "../../../hooks/useRatingDisplayMode";
import { getGalaxyMealId } from "../../../utils/galaxyMeal";
import { getFamilyRatingSummary } from "../../../utils/familyRatings";
import { CUISINE_OPTIONS } from "../../../types/cuisine";
import { mealHasIngredientInformation } from "../../../utils/missingPlannedIngredients";

const getMealRatingValue = (meal: Meal, familyMemberIds: string[]) => {
  const calculatedRating =
    familyMemberIds.length > 1
      ? getFamilyRatingSummary(meal.familyRatings, familyMemberIds)
      : null;
  if (calculatedRating) return calculatedRating.average;
  return typeof meal.rating === "number" ? meal.rating : 0;
};

const getMealCostTier = (meal: Meal) => {
  if (typeof meal.expense === "number") {
    if (meal.expense <= 2) {
      return 1;
    }
    if (meal.expense >= 4) {
      return 3;
    }
    return 2;
  }
  const planned = meal.plannedCostTier ?? 2;
  return Math.min(Math.max(planned, 1), 3);
};

const getMealRecencyTimestamp = (meal: Meal) => {
  if (meal.updatedAt) {
    const time = Date.parse(meal.updatedAt);
    if (!Number.isNaN(time)) {
      return time;
    }
  }
  if (meal.createdAt) {
    const time = Date.parse(meal.createdAt);
    if (!Number.isNaN(time)) {
      return time;
    }
  }
  return 0;
};

const getMealCreatedTimestamp = (meal: Meal) => {
  if (meal.createdAt) {
    const time = Date.parse(meal.createdAt);
    if (!Number.isNaN(time)) {
      return time;
    }
  }
  return getMealRecencyTimestamp(meal);
};

const getMealDifficultyValue = (meal: Meal) => {
  if (typeof meal.difficulty === "number") {
    return meal.difficulty;
  }
  return 3;
};

const getMealServedCount = (meal: Meal) => {
  if (typeof meal.servedCount === "number") {
    return meal.servedCount;
  }
  return 0;
};

type IngredientSearchResult = {
  name: string;
  normalizedName: string;
  mealCount: number;
};

const normalizeIngredientName = (name: string) =>
  name.trim().replace(/\s+/g, " ").toLowerCase();

const getMealIngredientNames = (meal: Meal) =>
  (meal.ingredients ?? [])
    .map((ingredient) =>
      typeof ingredient === "string" ? ingredient : ingredient.name
    )
    .map((name) => name.trim())
    .filter(Boolean);

const mealContainsIngredient = (meal: Meal, normalizedIngredient: string) =>
  getMealIngredientNames(meal).some(
    (name) => normalizeIngredientName(name) === normalizedIngredient
  );

const getIngredientSearchResults = (
  scopedMeals: Meal[],
  query: string
): IngredientSearchResult[] => {
  const normalizedQuery = normalizeIngredientName(query);
  if (!normalizedQuery) return [];

  const index = new Map<
    string,
    { name: string; mealIds: Set<string> }
  >();

  scopedMeals.forEach((meal) => {
    const seenInMeal = new Set<string>();
    getMealIngredientNames(meal).forEach((name) => {
      const normalizedName = normalizeIngredientName(name);
      if (!normalizedName.includes(normalizedQuery) || seenInMeal.has(normalizedName)) {
        return;
      }
      seenInMeal.add(normalizedName);
      const current = index.get(normalizedName) ?? { name, mealIds: new Set<string>() };
      current.mealIds.add(meal.id);
      index.set(normalizedName, current);
    });
  });

  const matchStrength = (name: string) => {
    if (name === normalizedQuery) return 0;
    if (name.startsWith(normalizedQuery)) return 1;
    if (name.split(" ").some((word) => word.startsWith(normalizedQuery))) return 2;
    return 3;
  };

  return Array.from(index, ([normalizedName, entry]) => ({
    name: entry.name,
    normalizedName,
    mealCount: entry.mealIds.size,
  })).sort((a, b) =>
    matchStrength(a.normalizedName) - matchStrength(b.normalizedName) ||
    b.mealCount - a.mealCount ||
    a.name.localeCompare(b.name)
  );
};

const parseSharedRecipeUrl = (incomingUrl: string) => {
  try {
    const parsed = new URL(incomingUrl);
    const host = parsed.host.toLowerCase();
    const path = parsed.pathname.replace(/^\/+/, "").toLowerCase();
    if (!["share", "meals"].includes(host) && !["share", "meals"].includes(path)) {
      return null;
    }
    const shared = parsed.searchParams.get("url");
    return shared && shared.trim().length > 0 ? shared : null;
  } catch (error) {
    return null;
  }
};

const getRecipeSourceLabel = (recipeUrl: string) => {
  try {
    const hostname = new URL(recipeUrl).hostname
      .toLowerCase()
      .replace(/^www\./, "");
    return hostname || "link";
  } catch (error) {
    return "link";
  }
};

const normalizeRecipeUrl = (recipeUrl?: string | null) => {
  if (!recipeUrl) {
    return "";
  }
  try {
    const parsed = new URL(recipeUrl.trim());
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch (error) {
    return recipeUrl.trim().replace(/\/$/, "").toLowerCase();
  }
};

const AnimatedCount = ({ value, style }: { value: number; style: object }) => {
  const [displayValue, setDisplayValue] = useState(value);
  const progress = useRef(new Animated.Value(1)).current;
  const reduceMotionRef = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      reduceMotionRef.current = enabled;
    });
  }, []);

  useEffect(() => {
    if (value === displayValue) return;
    if (reduceMotionRef.current) {
      setDisplayValue(value);
      return;
    }
    Animated.timing(progress, {
      toValue: 0,
      duration: 110,
      useNativeDriver: true,
    }).start(() => {
      setDisplayValue(value);
      Animated.timing(progress, {
        toValue: 1,
        duration: 170,
        useNativeDriver: true,
      }).start();
    });
  }, [displayValue, progress, value]);

  return (
    <Animated.Text
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [5, 0],
              }),
            },
            {
              scale: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [0.94, 1],
              }),
            },
          ],
        },
      ]}
    >
      {displayValue}
    </Animated.Text>
  );
};

export default function MealsScreen() {
  const {
    url: sharedRecipeUrlParam,
    mealId: requestedMealIdParam,
    completeFromGrocery,
    plannedMissingMealIds,
  } = useLocalSearchParams<{
    url?: string | string[];
    mealId?: string | string[];
    completeFromGrocery?: string | string[];
    plannedMissingMealIds?: string | string[];
  }>();
  const requestedMealId = Array.isArray(requestedMealIdParam)
    ? requestedMealIdParam[0]
    : requestedMealIdParam;
  const { theme } = useThemeController();
  const { members } = useFamilyMembers();
  const familyMemberIds = useMemo(
    () => members.map((member) => member.id),
    [members],
  );
  const { mode: ratingDisplayMode, setMode: setRatingDisplayMode } = useRatingDisplayMode();
  const canUseFamilyRatings = isFamilyRatingsEligible(members.length);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { startDay, orderedDays } = useWeekStartController();
  const {
    meals,
    favorites,
    refresh,
    isRefreshing,
    addMeal,
    updateMeal,
    toggleFavorite,
    toggleLock,
    deleteMeal,
  } = useMeals();
  const [activeTab, setActiveTab] = useState<MealTabKey>("all");
  const [contextualPlannedMealIds, setContextualPlannedMealIds] = useState<
    string[]
  >([]);
  const mealsListRef = useRef<FlatList<Meal> | null>(null);
  const mealsListOffsetRef = useRef(0);
  const [selectedMealId, setSelectedMealId] = useState<string | undefined>();
  const openedRequestedMealRef = useRef<string | null>(null);
  const [isModalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [pendingSharedRecipeUrl, setPendingSharedRecipeUrl] = useState<
    string | null
  >(null);
  const [pendingSharedRecipeImportId, setPendingSharedRecipeImportId] =
    useState<string | null>(null);
  const [pendingImportQueue, setPendingImportQueue] = useState<
    PendingRecipeImport[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchSubmitted, setSearchSubmitted] = useState(false);
  const [activeIngredientFilter, setActiveIngredientFilter] = useState<
    IngredientSearchResult | null
  >(null);
  const [showAllIngredientResults, setShowAllIngredientResults] =
    useState(false);
  const [sortSelection, setSortSelection] = useState<MealSortSelection | null>({
    id: "dateAdded",
    direction: "desc",
  });
  const availableCuisineSortOptions = useMemo(() => {
    const availableCuisines = new Set(
      meals.flatMap((meal) => (meal.cuisine ? [meal.cuisine] : [])),
    );
    return CUISINE_OPTIONS.filter((option) =>
      availableCuisines.has(option.value),
    ).map((option) => ({ value: option.value, label: option.label }));
  }, [meals]);
  const [freezerModalMeal, setFreezerModalMeal] = useState<Meal | null>(null);
  const [isMealPickerVisible, setMealPickerVisible] = useState(false);
  const [selectedFreezerMeal, setSelectedFreezerMeal] = useState<Meal | null>(
    null
  );
  const [displayOptions, setDisplayOptions] = useState({
    showDifficulty: true,
    showExpense: true,
    ratingMode: ratingDisplayMode as
      | "family"
      | "summary"
      | "off",
    showServed: true,
    showEmoji: true,
  });
  const [isDisplaySheetOpen, setDisplaySheetOpen] = useState(false);
  const [suggestToastVisible, setSuggestToastVisible] = useState(false);
  const [pendingSuggestMeal, setPendingSuggestMeal] = useState<Meal | null>(
    null
  );
  const [plannedMealDeletion, setPlannedMealDeletion] = useState<{
    meal: Meal;
    occurrences: PlannedMealOccurrence[];
  } | null>(null);
  const contentProgress = useRef(new Animated.Value(0)).current;

  const animateContent = useCallback(
    (tab: MealTabKey) => {
      Animated.timing(contentProgress, {
        toValue: tab === "all" ? 0 : 1,
        duration: theme.motion.duration.normal,
        easing: Easing.bezier(0, 0, 0.2, 1),
        useNativeDriver: true,
      }).start();
    },
    [contentProgress]
  );

  const handleTabChange = useCallback(
    (tab: MealTabKey) => {
      if (tab !== "complete") setContextualPlannedMealIds([]);
      setActiveTab(tab);
      animateContent(tab);
    },
    [animateContent]
  );

  useEffect(() => {
    const source = Array.isArray(completeFromGrocery)
      ? completeFromGrocery[0]
      : completeFromGrocery;
    if (source !== "1") return;
    const idsValue = Array.isArray(plannedMissingMealIds)
      ? plannedMissingMealIds[0]
      : plannedMissingMealIds;
    const ids = (idsValue ?? "").split(",").filter(Boolean);
    setContextualPlannedMealIds(ids);
    setActiveTab("complete");
    animateContent("complete");
  }, [animateContent, completeFromGrocery, plannedMissingMealIds]);

  const filterMealsForSearch = useCallback(
    (sourceMeals: Meal[]) => {
      if (activeIngredientFilter) {
        return sourceMeals.filter((meal) =>
          mealContainsIngredient(meal, activeIngredientFilter.normalizedName)
        );
      }
      const normalizedQuery = searchQuery.trim().toLowerCase();
      if (!normalizedQuery) return sourceMeals;
      return sourceMeals.filter((meal) =>
        meal.title.toLowerCase().includes(normalizedQuery)
      );
    },
    [activeIngredientFilter, searchQuery]
  );

  const filteredMeals = useMemo(
    () => filterMealsForSearch(meals),
    [filterMealsForSearch, meals]
  );

  const filteredFavorites = useMemo(
    () => favorites,
    [favorites]
  );

  const sortMealsList = useCallback(
    (list: Meal[]) => {
      if (!sortSelection) {
        return list;
      }

      const filterByExpense = (meal: Meal) => {
        if (sortSelection?.id !== "expense") {
          return true;
        }
        switch (sortSelection.direction) {
          case "cheap":
            return getMealCostTier(meal) === 1;
          case "mediumCost":
            return getMealCostTier(meal) === 2;
          case "expensive":
            return getMealCostTier(meal) === 3;
          default:
            return true;
        }
      };

      const filterByDifficulty = (meal: Meal) => {
        if (sortSelection?.id !== "difficulty") {
          return true;
        }
        switch (sortSelection.direction) {
          case "easy":
            return getMealDifficultyValue(meal) <= 2;
          case "medium":
            return getMealDifficultyValue(meal) === 3;
          case "hard":
            return getMealDifficultyValue(meal) >= 4;
          default:
            return true;
        }
      };

      const filterByCuisine = (meal: Meal) =>
        sortSelection?.id !== "cuisine" ||
        meal.cuisine === sortSelection.direction;

      const filteredList = list
        .filter(filterByExpense)
        .filter(filterByDifficulty)
        .filter(filterByCuisine);

      const sorted = [...filteredList].sort((a, b) => {
        switch (sortSelection.id) {
          case "name":
            return sortSelection.direction === "asc"
              ? a.title.localeCompare(b.title)
              : b.title.localeCompare(a.title);
          case "rating": {
            const ratingA = getMealRatingValue(a, familyMemberIds);
            const ratingB = getMealRatingValue(b, familyMemberIds);
            if (ratingA === ratingB) {
              return a.title.localeCompare(b.title);
            }
            return sortSelection.direction === "asc"
              ? ratingA - ratingB
              : ratingB - ratingA;
          }
          case "expense": {
            const costA = getMealCostTier(a);
            const costB = getMealCostTier(b);
            if (sortSelection.direction === "asc") {
              if (costA === costB) {
                return a.title.localeCompare(b.title);
              }
              return costA - costB;
            }
            if (sortSelection.direction === "desc") {
              if (costA === costB) {
                return a.title.localeCompare(b.title);
              }
              return costB - costA;
            }
            const target =
              sortSelection.direction === "cheap"
                ? 1
                : sortSelection.direction === "mediumCost"
                ? 2
                : 3;
            const distanceA = Math.abs(costA - target);
            const distanceB = Math.abs(costB - target);
            if (distanceA === distanceB) {
              if (sortSelection.direction === "expensive") {
                return costB - costA;
              }
              if (sortSelection.direction === "cheap") {
                return costA - costB;
              }
              return a.title.localeCompare(b.title);
            }
            return distanceA - distanceB;
          }
          case "dateAdded": {
            const dateA = getMealCreatedTimestamp(a);
            const dateB = getMealCreatedTimestamp(b);
            if (dateA === dateB) {
              return a.title.localeCompare(b.title);
            }
            return sortSelection.direction === "asc"
              ? dateA - dateB
              : dateB - dateA;
          }
          case "difficulty": {
            const difficultyA = getMealDifficultyValue(a);
            const difficultyB = getMealDifficultyValue(b);
            if (sortSelection.direction === "asc") {
              if (difficultyA === difficultyB) {
                return a.title.localeCompare(b.title);
              }
              return difficultyA - difficultyB;
            }
            if (sortSelection.direction === "desc") {
              if (difficultyA === difficultyB) {
                return a.title.localeCompare(b.title);
              }
              return difficultyB - difficultyA;
            }
            const target =
              sortSelection.direction === "easy"
                ? 1
                : sortSelection.direction === "medium"
                ? 3
                : 5;
            const distanceA = Math.abs(difficultyA - target);
            const distanceB = Math.abs(difficultyB - target);
            if (distanceA === distanceB) {
              if (sortSelection.direction === "hard") {
                return difficultyB - difficultyA;
              }
              if (sortSelection.direction === "easy") {
                return difficultyA - difficultyB;
              }
              return a.title.localeCompare(b.title);
            }
            return distanceA - distanceB;
          }
          case "servedCount": {
            const servedA = getMealServedCount(a);
            const servedB = getMealServedCount(b);
            if (servedA === servedB) {
              return a.title.localeCompare(b.title);
            }
            return sortSelection.direction === "asc"
              ? servedA - servedB
              : servedB - servedA;
          }
          case "cuisine":
            return a.title.localeCompare(b.title);
          default:
            return 0;
        }
      });
      return sorted;
    },
    [familyMemberIds, sortSelection]
  );

  const sortedAllMeals = useMemo(
    () => sortMealsList(filteredMeals),
    [filteredMeals, sortMealsList]
  );

  const sortedFavorites = useMemo(
    () => sortMealsList(filteredFavorites),
    [filteredFavorites, sortMealsList]
  );

  const ingredientSearchScope = activeTab === "favorites" ? favorites : meals;
  const ingredientSearchResults = useMemo(
    () =>
      activeTab !== "all" || activeIngredientFilter
        ? []
        : getIngredientSearchResults(ingredientSearchScope, searchQuery),
    [activeIngredientFilter, activeTab, ingredientSearchScope, searchQuery]
  );
  const visibleIngredientResults = showAllIngredientResults
    ? ingredientSearchResults
    : ingredientSearchResults.slice(0, 6);
  const hiddenIngredientResultCount = Math.max(
    0,
    ingredientSearchResults.length - visibleIngredientResults.length
  );

  const incompleteMeals = useMemo(
    () => meals.filter(isMealIncomplete),
    [meals]
  );
  const sortedIncompleteMeals = useMemo(
    () => sortMealsList(incompleteMeals),
    [incompleteMeals, sortMealsList]
  );
  const contextualPlannedMeals = useMemo(
    () =>
      contextualPlannedMealIds.flatMap((mealId) => {
        const meal = sortedIncompleteMeals.find(
          (candidate) => candidate.id === mealId,
        );
        return meal && !mealHasIngredientInformation(meal) ? [meal] : [];
      }),
    [contextualPlannedMealIds, sortedIncompleteMeals],
  );
  const contextualPlannedMealIdSet = useMemo(
    () => new Set(contextualPlannedMeals.map((meal) => meal.id)),
    [contextualPlannedMeals],
  );
  const otherIncompleteMeals = useMemo(
    () =>
      sortedIncompleteMeals.filter(
        (meal) => !contextualPlannedMealIdSet.has(meal.id),
      ),
    [contextualPlannedMealIdSet, sortedIncompleteMeals],
  );
  const completeMeals = useMemo(
    () => [...contextualPlannedMeals, ...otherIncompleteMeals],
    [contextualPlannedMeals, otherIncompleteMeals],
  );
  const completedMealCount = Math.max(0, meals.length - incompleteMeals.length);

  const data =
    activeTab === "all"
      ? sortedAllMeals
      : activeTab === "complete"
      ? completeMeals
      : sortedFavorites;

  const scrollCompletionMealToTop = useCallback(
    (mealId: string) => {
      const index = completeMeals.findIndex((meal) => meal.id === mealId);
      if (index < 0) return;
      requestAnimationFrame(() => {
        mealsListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0,
        });
      });
    },
    [completeMeals]
  );

  const scrollCompletionInputAboveKeyboard = useCallback(
    (mealId: string) => {
      const index = completeMeals.findIndex(
        (meal) => meal.id === mealId,
      );
      if (index < 0) return;
      setTimeout(() => {
        mealsListRef.current?.scrollToIndex({
          index,
          animated: true,
          viewPosition: 0,
          viewOffset: theme.space.sm,
        });
      }, 200);
    },
    [completeMeals, theme.space.sm],
  );

  const handleSortChange = useCallback(
    (selection: MealSortSelection | null) => {
      setSortSelection(selection);
    },
    []
  );

  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
    setSearchSubmitted(false);
    setActiveIngredientFilter(null);
    setShowAllIngredientResults(false);
  }, []);

  const handleSubmitSearch = useCallback(() => {
    if (!searchQuery.trim()) return;
    setSearchSubmitted(true);
    Keyboard.dismiss();
  }, [searchQuery]);

  const handleSelectIngredient = useCallback(
    (ingredient: IngredientSearchResult) => {
      Keyboard.dismiss();
      setActiveIngredientFilter(ingredient);
      setSearchQuery("");
      setSearchSubmitted(false);
      setShowAllIngredientResults(false);
    },
    []
  );

  const handleClearIngredientFilter = useCallback(() => {
    setActiveIngredientFilter(null);
    setSearchQuery("");
    setSearchSubmitted(false);
    setShowAllIngredientResults(false);
  }, []);

  const onOpenMeal = useCallback((meal: Meal) => {
    Keyboard.dismiss();
    setModalMode("edit");
    setSelectedMealId(meal.id);
    setModalVisible(true);
  }, []);

  useEffect(() => {
    if (!requestedMealId) {
      openedRequestedMealRef.current = null;
      return;
    }
    if (
      isModalVisible ||
      openedRequestedMealRef.current === requestedMealId
    ) return;
    const requestedMeal = meals.find((meal) => meal.id === requestedMealId);
    if (requestedMeal) {
      openedRequestedMealRef.current = requestedMealId;
      onOpenMeal(requestedMeal);
    }
  }, [isModalVisible, meals, onOpenMeal, requestedMealId]);

  const handleAddMeal = useCallback(() => {
    setModalMode("create");
    setSelectedMealId(undefined);
    setModalVisible(true);
  }, []);

  const openSharedRecipeUrl = useCallback(
    (sharedUrl: string, importId?: string) => {
      setPendingSharedRecipeUrl(sharedUrl);
      setPendingSharedRecipeImportId(importId ?? null);
      setModalMode("create");
      setSelectedMealId(undefined);
      setModalVisible(true);
    },
    []
  );

  const handleIncomingUrl = useCallback(
    (incomingUrl: string) => {
      const sharedUrl = parseSharedRecipeUrl(incomingUrl);
      if (!sharedUrl) {
        return;
      }
      openSharedRecipeUrl(sharedUrl);
    },
    [openSharedRecipeUrl]
  );

  const loadPendingImports = useCallback(async () => {
    try {
      const imports = await getPendingRecipeImports();
      setPendingImportQueue(imports);
    } catch (error) {
      console.warn("Unable to load pending recipe imports", error);
    }
  }, []);

  const resetActivePendingImport = useCallback(() => {
    setPendingSharedRecipeImportId(null);
  }, []);

  const completeActivePendingImport = useCallback(() => {
    const importId = pendingSharedRecipeImportId;
    setPendingSharedRecipeImportId(null);

    if (!importId) {
      return;
    }

    setPendingImportQueue((prev) =>
      prev.filter((pendingImport) => pendingImport.id !== importId)
    );
    removePendingRecipeImport(importId).catch((error) => {
      console.warn("Unable to remove pending recipe import", error);
    });
  }, [pendingSharedRecipeImportId]);

  const freezerCandidates = useMemo(
    () => meals.filter((meal) => !meal.isFavorite),
    [meals]
  );

  const galaxyMealId = useMemo(() => {
    return getGalaxyMealId(
      meals,
      members.map((member) => member.id)
    );
  }, [meals, members]);

  const openFreezerModal = useCallback((meal: Meal) => {
    setSelectedFreezerMeal(null);
    setFreezerModalMeal(meal);
  }, []);

  const handleFreezerModalClose = useCallback(() => {
    setFreezerModalMeal(null);
    setSelectedFreezerMeal(null);
  }, []);

  const handleFreezerModalSave = useCallback(
    (meal: Meal, mealAmount: number, addedAt: string) => {
      updateMeal({
        id: meal.id,
        freezerMealAmount: mealAmount,
        freezerAmount: "",
        freezerQuantity: "",
        freezerUnit: "",
        freezerAddedAt: addedAt,
        isFavorite: true,
      });
      setFreezerModalMeal(null);
      setSelectedFreezerMeal(null);
    },
    [updateMeal]
  );

  const handleRemoveFromFreezer = useCallback(
    (mealId: string) => {
      updateMeal({
        id: mealId,
        isFavorite: false,
        freezerAmount: "",
        freezerMealAmount: undefined,
        freezerUnit: "",
        freezerQuantity: "",
        freezerAddedAt: undefined,
      });
    },
    [updateMeal]
  );

  const deleteMealNormally = useCallback(
    async (mealId: string) => {
      const meal = meals.find((candidate) => candidate.id === mealId);
      if (!meal) return;
      const isDeletingLastMeal = meals.length === 1 && meals[0]?.id === mealId;
      await Promise.all([
        snapshotMealTitleInWeekPlanHistory(meal.id, meal.title),
        snapshotServedMealTitle(meal.id, meal.title),
      ]);
      deleteMeal(mealId);
      if (isDeletingLastMeal) {
        await clearWeekPlanData();
      }
    },
    [deleteMeal, meals],
  );

  const handleDeleteMeal = useCallback(
    async (mealId: string) => {
      const meal = meals.find((candidate) => candidate.id === mealId);
      if (!meal) return;
      const occurrences = await getActivePlannedMealOccurrences({
        mealId,
        startDay,
        orderedDays,
      });
      if (occurrences.length > 0) {
        setPlannedMealDeletion({ meal, occurrences });
        return;
      }
      await deleteMealNormally(mealId);
    },
    [deleteMealNormally, meals, orderedDays, startDay],
  );

  const handleSuggestNextWeek = useCallback(
    (meal: Meal) => {
      setPendingSuggestMeal(meal);
    },
    [],
  );

  const handleCancelSuggestNextWeek = useCallback(() => {
    setPendingSuggestMeal(null);
  }, []);

  const handleConfirmSuggestNextWeek = useCallback(async () => {
    if (!pendingSuggestMeal) {
      return;
    }
    const meal = pendingSuggestMeal;
    setPendingSuggestMeal(null);
    const nextWeekStartISO = getNextWeekStartForDate(startDay)
      .toISOString()
      .slice(0, 10);
    await addSavedMealIdeaToWeekPlan(nextWeekStartISO, meal);
    setSuggestToastVisible(true);
  }, [pendingSuggestMeal, startDay]);

  const pendingSuggestMealTitle = pendingSuggestMeal?.title ?? "";

  const activePendingImport = useMemo(
    () =>
      pendingSharedRecipeImportId
        ? pendingImportQueue.find(
            (pendingImport) => pendingImport.id === pendingSharedRecipeImportId
          ) ?? null
        : null,
    [pendingImportQueue, pendingSharedRecipeImportId]
  );

  const handleOpenPendingImport = useCallback(
    (pendingImport: PendingRecipeImport) => {
      openSharedRecipeUrl(pendingImport.recipeUrl, pendingImport.id);
    },
    [openSharedRecipeUrl]
  );

  const handleRemovePendingImport = useCallback(
    (importId: string) => {
      setPendingImportQueue((prev) =>
        prev.filter((pendingImport) => pendingImport.id !== importId)
      );
      removePendingRecipeImport(importId).catch((error) => {
        console.warn("Unable to remove pending recipe import", error);
      });
    },
    []
  );

  const renderMeal: ListRenderItem<Meal> = useCallback(
    ({ item, index }) => {
      if (activeTab === "complete") {
        const handleApply = (confirmed: Ingredient[]) => {
          updateMeal({
            id: item.id,
            ingredients: mergeConfirmedIngredients(item.ingredients, confirmed),
            updatedAt: new Date().toISOString(),
          });
        };
        const handleUpdateDetails = (
          patch: Pick<Partial<Meal>, "difficulty" | "expense" | "cuisine">
        ) => {
          updateMeal({
            id: item.id,
            ...patch,
            updatedAt: new Date().toISOString(),
          });
        };
        const startsOtherMeals =
          contextualPlannedMeals.length > 0 &&
          index === contextualPlannedMeals.length;
        return (
          <View style={styles.completeMealGroup}>
            {startsOtherMeals ? (
              <View style={styles.completeSectionHeader}>
                <Text style={styles.completeSectionTitle}>
                  OTHER MEALS TO COMPLETE
                </Text>
              </View>
            ) : null}
            <MealCompletionCard
              meal={item}
              onApply={handleApply}
              onUpdateDetails={handleUpdateDetails}
              onExpand={() => scrollCompletionMealToTop(item.id)}
              onManualIngredientFocus={() =>
                scrollCompletionInputAboveKeyboard(item.id)
              }
              onManualIngredientNeedsScroll={(overlap) => {
                mealsListRef.current?.scrollToOffset({
                  offset: Math.max(0, mealsListOffsetRef.current + overlap),
                  animated: true,
                });
              }}
              isLastIncomplete={completeMeals.length === 1}
            />
          </View>
        );
      }
      const isFreezerTab = activeTab === "favorites";
      return (
        <MealListItem
          meal={item}
          onPress={() => onOpenMeal(item)}
          onDelete={() => void handleDeleteMeal(item.id)}
          isFreezer={isFreezerTab}
          onFreezerPress={
            isFreezerTab ? () => openFreezerModal(item) : undefined
          }
          onRemoveFromFreezer={
            isFreezerTab ? () => handleRemoveFromFreezer(item.id) : undefined
          }
          onSuggestNextWeek={
            isFreezerTab ? undefined : () => handleSuggestNextWeek(item)
          }
          isGalaxyMeal={item.id === galaxyMealId}
          displayOptions={displayOptions}
        />
      );
    },
    [
      activeTab,
      displayOptions,
      handleDeleteMeal,
      handleRemoveFromFreezer,
      onOpenMeal,
      openFreezerModal,
      galaxyMealId,
      completeMeals.length,
      contextualPlannedMeals.length,
      scrollCompletionMealToTop,
      scrollCompletionInputAboveKeyboard,
      styles,
      updateMeal,
    ]
  );

  const keyExtractor = useCallback((item: Meal) => item.id, []);

  const listEmpty = useMemo(() => {
    if (activeIngredientFilter) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No meals contain this ingredient</Text>
          <Pressable onPress={handleClearIngredientFilter} accessibilityRole="button">
            <Text style={styles.emptyAction}>Clear ingredient filter</Text>
          </Pressable>
        </View>
      );
    }
    if (
      activeTab === "all" &&
      pendingImportQueue.length > 0 &&
      !searchQuery.trim()
    ) {
      return null;
    }
    if (
      activeTab === "all" && searchQuery.trim()
    ) {
      if (ingredientSearchResults.length > 0) return null;
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No matches found</Text>
          <Text style={styles.emptySubtitle}>
            Try searching with a different name.
          </Text>
        </View>
      );
    }
    if (activeTab === "complete") {
      return (
        <View style={styles.completeEmptyState}>
          <Text style={styles.completeEmptySparkle}>✨</Text>
          <Text style={styles.completeEmptyTitle}>All caught up!</Text>
          <Text style={styles.completeEmptySubtitle}>
            Every meal has the details Weekly Eats needs.
          </Text>
          <Text style={styles.completeEmptyCount}>
            {completedMealCount} {completedMealCount === 1 ? "meal" : "meals"} complete ✓
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No meals yet</Text>
        <Text style={styles.emptySubtitle}>
          Add dinners to see them listed here.
        </Text>
      </View>
    );
  }, [activeIngredientFilter, activeTab, completedMealCount, handleClearIngredientFilter, ingredientSearchResults.length, pendingImportQueue.length, searchQuery, styles]);

  const opacity = contentProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.92],
  });

  const selectedMeal = useMemo(
    () => meals.find((meal) => meal.id === selectedMealId),
    [meals, selectedMealId]
  );
  const freezerAmountMeal = freezerModalMeal ?? selectedFreezerMeal;

  const handleDismissModal = useCallback(() => {
    resetActivePendingImport();
    setModalVisible(false);
    setSelectedMealId(undefined);
    setModalMode("create");
    setPendingSharedRecipeUrl(null);
  }, [resetActivePendingImport]);

  const handleCreateMeal = useCallback(
    (draft: MealDraft) => {
      const now = new Date().toISOString();
      const draftRecipeUrl = draft.recipeUrl?.trim() ?? "";
      const normalizedDraftUrl = normalizeRecipeUrl(draftRecipeUrl);
      const duplicateMeal = normalizedDraftUrl
        ? meals.find(
            (meal) => normalizeRecipeUrl(meal.recipeUrl) === normalizedDraftUrl
          )
        : null;
      const meal: Meal = duplicateMeal
        ? {
            ...duplicateMeal,
            ...draft,
            id: duplicateMeal.id,
            recipeUrl: draftRecipeUrl || duplicateMeal.recipeUrl,
            createdAt: duplicateMeal.createdAt ?? draft.createdAt ?? now,
            updatedAt: now,
          }
        : {
            id: createMealId(),
            ...draft,
            recipeUrl: draftRecipeUrl,
            createdAt: draft.createdAt ?? now,
            updatedAt: draft.updatedAt ?? now,
          };

      if (duplicateMeal) {
        updateMeal(meal);
      } else {
        addMeal(meal);
      }

      if (activePendingImport?.planForLater) {
        const nextWeekStartISO = getNextWeekStartForDate(startDay)
          .toISOString()
          .slice(0, 10);
        addSavedMealIdeaToWeekPlan(nextWeekStartISO, meal).catch((error) => {
          console.warn("Unable to save pending recipe as next week idea", error);
        });
      }

      completeActivePendingImport();
    },
    [
      activePendingImport,
      addMeal,
      completeActivePendingImport,
      meals,
      startDay,
      updateMeal,
    ]
  );

  const handleUpdateMeal = useCallback(
    (meal: Meal) => {
      updateMeal(meal);
    },
    [updateMeal]
  );

  useEffect(() => {
    let isActive = true;
    Linking.getInitialURL()
      .then((url) => {
        if (isActive && url) {
          handleIncomingUrl(url);
        }
      })
      .catch(() => {});

    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleIncomingUrl(url);
    });

    return () => {
      isActive = false;
      subscription.remove();
    };
  }, [handleIncomingUrl]);

  useEffect(() => {
    loadPendingImports();

    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        loadPendingImports();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [loadPendingImports]);

  useEffect(() => {
    const sharedUrl = Array.isArray(sharedRecipeUrlParam)
      ? sharedRecipeUrlParam[0]
      : sharedRecipeUrlParam;
    if (typeof sharedUrl === "string" && sharedUrl.trim().length > 0) {
      openSharedRecipeUrl(sharedUrl);
    }
  }, [openSharedRecipeUrl, sharedRecipeUrlParam]);

  useEffect(() => {
    if (
      modalMode === "edit" &&
      isModalVisible &&
      selectedMealId &&
      !selectedMeal
    ) {
      handleDismissModal();
    }
  }, [
    handleDismissModal,
    isModalVisible,
    modalMode,
    selectedMeal,
    selectedMealId,
  ]);

  const handleAddButtonPress = useCallback(() => {
    if (activeTab === "favorites") {
      if (freezerCandidates.length === 0) {
        Alert.alert(
          "No meals available",
          "Add meals to your collection first, then you can add them to the freezer."
        );
        return;
      }
      setMealPickerVisible(true);
      return;
    }
    handleAddMeal();
  }, [activeTab, freezerCandidates.length, handleAddMeal]);

  const handleSelectFreezerCandidate = useCallback((meal: Meal) => {
    setSelectedFreezerMeal(meal);
    setMealPickerVisible(false);
    setFreezerModalMeal(meal);
  }, []);

  const isFreezerTab = activeTab === "favorites";
  const shouldShowPendingImports =
    activeTab === "all" && pendingImportQueue.length > 0;

  const addButtonConfig = useMemo(
    () =>
      isFreezerTab
        ? {
            onPress: handleAddButtonPress,
            testID: "add-meal-button",
            accessibilityLabel: "Add meal to freezer",
            variant: "badge" as const,
            label: "Add to freezer",
          }
        : {
            onPress: handleAddButtonPress,
            testID: "add-meal-button",
            accessibilityLabel: "Add meal",
          },
    [handleAddButtonPress, isFreezerTab]
  );

  const toggleDisplayOption = useCallback(
    (key: keyof typeof displayOptions) => {
      setDisplayOptions((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    []
  );

  useEffect(() => {
    setDisplayOptions((prev) => ({ ...prev, ratingMode: ratingDisplayMode }));
  }, [ratingDisplayMode]);

  useEffect(() => {
    if (!canUseFamilyRatings) {
      setDisplayOptions((prev) =>
        prev.ratingMode === "family"
          ? (() => { setRatingDisplayMode("summary"); return { ...prev, ratingMode: "summary" as const }; })()
          : prev
      );
    }
  }, [canUseFamilyRatings, setRatingDisplayMode]);

  const displayOptionList = useMemo(
    () => [
      {
        id: "difficulty",
        label: "Difficulty",
        selected: displayOptions.showDifficulty,
        onPress: () => toggleDisplayOption("showDifficulty"),
      },
      {
        id: "expense",
        label: "Expense",
        selected: displayOptions.showExpense,
        onPress: () => toggleDisplayOption("showExpense"),
      },
      {
        id: "served",
        label: "Served Count",
        selected: displayOptions.showServed,
        onPress: () => toggleDisplayOption("showServed"),
      },
      {
        id: "emoji",
        label: "Meal icon",
        selected: displayOptions.showEmoji,
        onPress: () => toggleDisplayOption("showEmoji"),
      },
    ],
    [displayOptions, toggleDisplayOption]
  );

  const menuButtonConfig = useMemo(
    () =>
      isFreezerTab
        ? undefined
        : {
            onPress: () => setDisplaySheetOpen(true),
            testID: "meals-more-button",
            accessibilityLabel: "Open meals menu",
          },
    [isFreezerTab]
  );

  return (
    <>
      <TabParent
        backgroundColor={theme.color.bg}
        title="Meals"
        addBtn={addButtonConfig}
        menuBtn={menuButtonConfig}
      >
        <View style={styles.tabsHeader}>
          <MealTabs
            activeTab={activeTab}
            onChange={handleTabChange}
            incompleteCount={incompleteMeals.length}
            freezerCount={favorites.length}
          />
        </View>
        {isFreezerTab ? (
          <View style={styles.freezerHelper}>
            <Text style={styles.freezerHelperTitle}>Ready to serve</Text>
            <Text style={styles.freezerHelperSubtitle}>
              Keep tabs on leftovers and meal prep you've already handled. Use
              this list as your personal freezer inventory.
            </Text>
          </View>
        ) : null}
        <Animated.View style={[styles.listContainer, { opacity }]}>
          <FlatList
            ref={mealsListRef}
            testID="meals-list"
            style={styles.list}
            data={data}
            keyExtractor={keyExtractor}
            renderItem={renderMeal}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            onScroll={(event) => {
              mealsListOffsetRef.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            refreshControl={
              <RefreshControl
                testID="meals-refresh-control"
                tintColor={theme.color.accent}
                colors={[theme.color.accent]}
                refreshing={isRefreshing}
                onRefresh={refresh}
              />
            }
            onScrollToIndexFailed={({ index, averageItemLength }) => {
              mealsListRef.current?.scrollToOffset({
                offset: Math.max(0, index * averageItemLength),
                animated: true,
              });
              setTimeout(() => {
                mealsListRef.current?.scrollToIndex({
                  index,
                  animated: true,
                  viewPosition: 0,
                });
              }, 100);
            }}
            ListHeaderComponent={
              activeTab === "complete" ? (
                <View style={styles.completeDashboardHeader}>
                  <View style={styles.completeStatsCard}>
                    <View style={styles.completeStat}>
                      <View style={[styles.completeStatIcon, styles.completeStatIconPink]}>
                        <MaterialCommunityIcons name="clipboard-text-outline" size={22} color={theme.color.accent} />
                      </View>
                      <View style={styles.completeStatDetails}>
                        <AnimatedCount value={incompleteMeals.length} style={styles.completeStatNumber} />
                        <Text style={styles.completeStatLabel}>Needs attention</Text>
                      </View>
                    </View>
                    <View style={styles.completeStatDivider} />
                    <View style={styles.completeStat}>
                      <View style={[styles.completeStatIcon, styles.completeStatIconGreen]}>
                        <MaterialCommunityIcons name="check-circle-outline" size={22} color={theme.color.success} />
                      </View>
                      <View style={styles.completeStatDetails}>
                        <AnimatedCount value={completedMealCount} style={styles.completeStatNumber} />
                        <Text style={styles.completeStatLabel}>Meals complete</Text>
                      </View>
                    </View>
                  </View>

                  {incompleteMeals.length > 0 ? <View style={styles.completeSectionHeader}>
                    <Text style={styles.completeSectionTitle}>
                      {contextualPlannedMeals.length > 0
                        ? "PLANNED THIS WEEK"
                        : "Needs attention"}
                    </Text>
                  </View> : null}
                </View>
              ) : activeTab === "all" ? (
                <View style={styles.searchHeader}>
                  <MealSearchInput
                    value={searchQuery}
                    onChangeText={handleSearchQueryChange}
                    onSubmitEditing={handleSubmitSearch}
                    onSortChange={handleSortChange}
                    cuisineOptions={availableCuisineSortOptions}
                  />
                  {isSearchSubmitted && searchQuery.trim() && !activeIngredientFilter ? (
                    <View style={styles.activeIngredientFilterRow}>
                      <View style={styles.activeIngredientFilterChip}>
                        <MaterialCommunityIcons
                          name="magnify"
                          size={16}
                          color={theme.color.accent}
                        />
                        <Text style={styles.activeIngredientFilterText} numberOfLines={1}>
                          Search: {searchQuery.trim()}
                        </Text>
                        <Pressable
                          onPress={() => handleSearchQueryChange("")}
                          accessibilityRole="button"
                          accessibilityLabel="Clear meal search"
                          hitSlop={theme.space.sm}
                        >
                          <MaterialCommunityIcons
                            name="close"
                            size={17}
                            color={theme.color.accent}
                          />
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                  {activeIngredientFilter ? (
                    <View style={styles.activeIngredientFilterRow}>
                      <View style={styles.activeIngredientFilterChip}>
                        <View style={styles.ingredientDot} />
                        <Text style={styles.activeIngredientFilterText} numberOfLines={1}>
                          Ingredient: {activeIngredientFilter.name}
                        </Text>
                        <Pressable
                          onPress={handleClearIngredientFilter}
                          accessibilityRole="button"
                          accessibilityLabel={`Clear ${activeIngredientFilter.name} ingredient filter`}
                          hitSlop={theme.space.sm}
                        >
                          <MaterialCommunityIcons
                            name="close"
                            size={17}
                            color={theme.color.accent}
                          />
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                  {activeTab === "all" && shouldShowPendingImports ? (
                    <View style={styles.pendingImportsSection}>
                      <Text style={styles.pendingImportsTitle}>
                        Pending imports
                      </Text>
                      <View style={styles.pendingImportsList}>
                        {pendingImportQueue.map((pendingImport) => {
                          const sourceLabel = getRecipeSourceLabel(
                            pendingImport.recipeUrl
                          );
                          return (
                            <GestureHandlerRootView
                              key={pendingImport.id}
                              style={styles.pendingImportGestureRoot}
                            >
                              <Swipeable
                                friction={2}
                                rightThreshold={64}
                                renderRightActions={() => (
                                  <RectButton
                                    style={styles.pendingImportDeleteAction}
                                    onPress={() =>
                                      handleRemovePendingImport(
                                        pendingImport.id
                                      )
                                    }
                                    accessibilityRole="button"
                                    accessibilityLabel={`Delete recipe from ${sourceLabel}`}
                                  >
                                    <Text
                                      style={
                                        styles.pendingImportDeleteActionText
                                      }
                                    >
                                      Delete
                                    </Text>
                                  </RectButton>
                                )}
                              >
                                <Pressable
                                  accessibilityRole="button"
                                  accessibilityLabel={`Review recipe from ${sourceLabel}`}
                                  onPress={() =>
                                    handleOpenPendingImport(pendingImport)
                                  }
                                  style={({ pressed }) => [
                                    styles.pendingImportCard,
                                    pressed && styles.pendingImportCardPressed,
                                  ]}
                                >
                                  <View style={styles.pendingImportIcon}>
                                    <Text style={styles.pendingImportIconText}>
                                      URL
                                    </Text>
                                  </View>
                                  <View style={styles.pendingImportDetails}>
                                    <Text
                                      style={styles.pendingImportTitle}
                                      numberOfLines={1}
                                    >
                                      Recipe from {sourceLabel}
                                    </Text>
                                    <Text style={styles.pendingImportSubtitle}>
                                      Tap to review auto-fill
                                    </Text>
                                  </View>
                                </Pressable>
                              </Swipeable>
                            </GestureHandlerRootView>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null
            }
            ListFooterComponent={
              searchQuery.trim() && ingredientSearchResults.length > 0 ? (
                <View style={styles.ingredientResultsSection}>
                  <View style={styles.ingredientResultsHeader}>
                    <Text style={styles.ingredientResultsTitle}>
                      INGREDIENTS WITH “{searchQuery.trim().toUpperCase()}”
                    </Text>
                    {ingredientSearchResults.length > 6 ? (
                      <Pressable
                        onPress={() => setShowAllIngredientResults((current) => !current)}
                        accessibilityRole="button"
                      >
                        <Text style={styles.ingredientResultsAction}>
                          {showAllIngredientResults ? "Show less" : "See all"}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={styles.ingredientResultsGrid}>
                    {visibleIngredientResults.map((ingredient) => (
                      <Pressable
                        key={ingredient.normalizedName}
                        onPress={() => handleSelectIngredient(ingredient)}
                        accessibilityRole="button"
                        accessibilityLabel={`Show meals with ${ingredient.name}`}
                        style={({ pressed }) => [
                          styles.ingredientResultCard,
                          pressed && styles.ingredientResultCardPressed,
                        ]}
                      >
                        <View style={styles.ingredientResultNameRow}>
                          <View style={styles.ingredientDot} />
                          <Text style={styles.ingredientResultName} numberOfLines={2}>
                            {ingredient.name}
                          </Text>
                        </View>
                        <Text style={styles.ingredientResultCount}>
                          {ingredient.mealCount} {ingredient.mealCount === 1 ? "meal" : "meals"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  {!showAllIngredientResults && hiddenIngredientResultCount > 0 ? (
                    <Pressable
                      onPress={() => setShowAllIngredientResults(true)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.ingredientMoreText}>
                        + {hiddenIngredientResultCount} more ingredient{hiddenIngredientResultCount === 1 ? "" : "s"}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null
            }
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={listEmpty}
          />
        </Animated.View>
      </TabParent>
      <MealModalOverlay
        mode={modalMode}
        meal={modalMode === "edit" ? selectedMeal : undefined}
        visible={isModalVisible}
        draftOverrides={
          pendingSharedRecipeUrl
            ? {
                recipeUrl: pendingSharedRecipeUrl,
                createdAt: activePendingImport?.createdAt,
              }
            : undefined
        }
        autoFillOnOpen={Boolean(pendingSharedRecipeUrl)}
        isGalaxyMeal={modalMode === "edit" && selectedMeal?.id === galaxyMealId}
        onDismiss={handleDismissModal}
        onCreateMeal={handleCreateMeal}
        onUpdateMeal={handleUpdateMeal}
      />
      <FreezerAmountModal
        visible={Boolean(freezerAmountMeal)}
        initialMeal={freezerAmountMeal ?? undefined}
        initialAmount={
          freezerAmountMeal?.freezerAmount ??
          freezerAmountMeal?.freezerQuantity ??
          ""
        }
        initialAddedAt={freezerAmountMeal?.freezerAddedAt}
        onDismiss={handleFreezerModalClose}
        onComplete={handleFreezerModalSave}
      />
      <DisplayOnCardsSheet
        visible={isDisplaySheetOpen}
        options={displayOptionList}
        onClose={() => setDisplaySheetOpen(false)}
      />
      <MealSearchModal
        visible={isMealPickerVisible}
        meals={freezerCandidates}
        onDismiss={() => setMealPickerVisible(false)}
        onSelectMeal={handleSelectFreezerCandidate}
        title="Add to freezer"
        subtitle="Pick a meal to add to your freezer inventory."
      />
      <PlannedMealDeletionModal
        meal={plannedMealDeletion?.meal ?? null}
        occurrences={plannedMealDeletion?.occurrences ?? []}
        onClose={() => setPlannedMealDeletion(null)}
      />
      <Modal
        visible={Boolean(pendingSuggestMeal)}
        transparent
        animationType="fade"
        onRequestClose={handleCancelSuggestNextWeek}
      >
        <View style={styles.confirmBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            accessibilityRole="button"
            accessibilityLabel="Cancel saving meal for next week"
            onPress={handleCancelSuggestNextWeek}
          />
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Save for next week?</Text>
            <Text style={styles.confirmMessage}>
              {pendingSuggestMealTitle} will appear in Suggested by You during
              planning.
            </Text>
            <View style={styles.confirmActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cancel saving meal for next week"
                onPress={handleCancelSuggestNextWeek}
                style={({ pressed }) => [
                  styles.confirmButton,
                  styles.confirmCancelButton,
                  pressed && styles.confirmButtonPressed,
                ]}
              >
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save meal for next week"
                onPress={handleConfirmSuggestNextWeek}
                style={({ pressed }) => [
                  styles.confirmButton,
                  styles.confirmSaveButton,
                  pressed && styles.confirmButtonPressed,
                ]}
              >
                <Text style={styles.confirmSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {suggestToastVisible ? (
        <DayPlannedToast
          title="Added to Suggested by You"
          subtitle="Saved for next week's planning."
          onComplete={() => setSuggestToastVisible(false)}
        />
      ) : null}
    </>
  );
}
const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    parentContainer: {
      flex: 1,
    },
    parentContent: {
      flex: 1,
      padding: 0,
    },
    listContainer: {
      flex: 1,
      minHeight: 0,
    },
    list: {
      flex: 1,
    },
    listContent: {
      paddingHorizontal: theme.space.lg,
      paddingBottom: theme.space["2xl"],
      paddingTop: theme.space.lg,
    },
    heading: {
      color: theme.color.ink,
      fontSize: theme.type.size.h1,
      fontWeight: theme.type.weight.bold,
      marginBottom: theme.space.xl,
    },
    tabsHeader: {
      paddingTop: theme.space.lg,
    },
    separator: {
      height: theme.space.lg,
    },
    searchHeader: {
      paddingBottom: theme.space.lg,
      gap: theme.space.lg,
    },
    activeIngredientFilterRow: {
      flexDirection: "row",
    },
    activeIngredientFilterChip: {
      maxWidth: "100%",
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      paddingHorizontal: theme.space.md,
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.accent,
      backgroundColor: theme.mode === "dark" ? "rgba(255, 75, 145, 0.14)" : "#FFF0F6",
    },
    activeIngredientFilterText: {
      flexShrink: 1,
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textTransform: "capitalize",
    },
    ingredientResultsSection: {
      paddingTop: theme.space.xl,
      gap: theme.space.md,
    },
    ingredientResultsHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.space.md,
    },
    ingredientResultsTitle: {
      flex: 1,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      letterSpacing: 0.6,
    },
    ingredientResultsAction: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    ingredientResultsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.sm,
    },
    ingredientResultCard: {
      width: "48.5%",
      minHeight: 88,
      justifyContent: "center",
      gap: theme.space.xs,
      padding: theme.space.md,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
    },
    ingredientResultCardPressed: {
      opacity: 0.82,
    },
    ingredientResultNameRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    ingredientDot: {
      width: 7,
      height: 7,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.accent,
    },
    ingredientResultName: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
      textTransform: "capitalize",
    },
    ingredientResultCount: {
      marginLeft: 7 + theme.space.sm,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    ingredientMoreText: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    pendingImportsSection: {
      gap: theme.space.sm,
    },
    pendingImportsTitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    pendingImportsList: {
      gap: theme.space.sm,
    },
    pendingImportGestureRoot: {
      borderRadius: theme.radius.lg,
    },
    pendingImportCard: {
      minHeight: 72,
      borderRadius: theme.radius.lg,
      borderWidth: 1.5,
      borderColor: theme.color.accent,
      backgroundColor:
        theme.mode === "dark" ? "rgba(255, 75, 145, 0.14)" : "#FFF0F6",
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.md,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
    },
    pendingImportCardPressed: {
      opacity: 0.85,
    },
    pendingImportIcon: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.full,
      backgroundColor:
        theme.mode === "dark" ? "rgba(255, 75, 145, 0.22)" : "#FFE0EC",
      alignItems: "center",
      justifyContent: "center",
    },
    pendingImportIconText: {
      color: theme.color.accent,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.bold,
    },
    pendingImportDetails: {
      flex: 1,
      gap: theme.space.xs,
    },
    pendingImportTitle: {
      color: theme.color.ink,
      fontSize: 18,
      fontWeight: theme.type.weight.bold,
    },
    pendingImportSubtitle: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    pendingImportDeleteAction: {
      width: 104,
      borderRadius: theme.radius.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      marginLeft: theme.space.sm,
    },
    pendingImportDeleteActionText: {
      color: theme.color.danger,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    freezerHelper: {
      marginTop: theme.space.lg,
      marginHorizontal: theme.space.lg,
      backgroundColor: theme.color.surfaceAlt,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      gap: theme.space.xs,
    },
    freezerHelperTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    freezerHelperSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      lineHeight: theme.type.size.sm * 1.4,
    },
    completeDashboardHeader: {
      gap: theme.space.lg,
      paddingBottom: theme.space.lg,
    },
    completeStatsCard: {
      minHeight: 100,
      flexDirection: "row",
      alignItems: "stretch",
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surfaceAlt,
      overflow: "hidden",
    },
    completeStat: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.lg,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.md,
    },
    completeStatDetails: {
      flex: 1,
      alignItems: "center",
      gap: 2,
    },
    completeStatDivider: {
      width: StyleSheet.hairlineWidth,
      marginVertical: theme.space.md,
      backgroundColor: theme.color.accent,
    },
    completeStatIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
    },
    completeStatIconPink: {
      backgroundColor: theme.mode === "dark" ? "rgba(255, 75, 145, 0.14)" : "#FFF0F6",
    },
    completeStatIconGreen: {
      backgroundColor: theme.mode === "dark" ? "rgba(0, 255, 156, 0.14)" : "#E8F8F0",
    },
    completeStatNumber: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
    },
    completeStatLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      lineHeight: 16,
      textAlign: "center",
    },
    completeSectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.space.xs,
      paddingTop: theme.space.xs,
    },
    completeMealGroup: { gap: theme.space.md },
    completeSectionTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    completeEmptyState: {
      alignItems: "center",
      gap: theme.space.sm,
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space["2xl"],
      paddingBottom: theme.space["2xl"],
    },
    completeEmptySparkle: {
      fontSize: 30,
      marginBottom: theme.space.xs,
    },
    completeEmptyTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    completeEmptySubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      lineHeight: 22,
      textAlign: "center",
    },
    completeEmptyCount: {
      marginTop: theme.space.md,
      color: theme.color.success,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    confirmBackdrop: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.48)",
      paddingHorizontal: theme.space.xl,
    },
    confirmCard: {
      width: "100%",
      maxWidth: 360,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      padding: theme.space.xl,
      gap: theme.space.md,
    },
    confirmTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    confirmMessage: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      lineHeight: theme.type.size.base * 1.4,
    },
    confirmActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: theme.space.sm,
      marginTop: theme.space.sm,
    },
    confirmButton: {
      minHeight: 44,
      minWidth: 96,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.space.lg,
      borderWidth: StyleSheet.hairlineWidth,
    },
    confirmCancelButton: {
      backgroundColor: theme.color.surfaceAlt,
      borderColor: theme.color.cardOutline,
    },
    confirmSaveButton: {
      backgroundColor: theme.color.accent,
      borderColor: theme.color.accent,
    },
    confirmButtonPressed: {
      opacity: 0.85,
    },
    confirmCancelText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    confirmSaveText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.space["2xl"],
    },
    emptyTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
      marginBottom: theme.space.sm,
    },
    emptySubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
    },
    emptyAction: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
  });
