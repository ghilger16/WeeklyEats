import {
  Alert,
  Animated,
  AppState,
  Easing,
  FlatList,
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
import MealSearchInput, {
  type MealSortSelection,
} from "../../../components/meals/MealSearchInput";
import DayPlannedToast from "../../../components/plan-week/planned-meals/DayPlannedToast";
import TabParent from "../../../components/tab-parent/TabParent";
import { useMeals } from "../../../hooks/useMeals";
import { useWeekStartController } from "../../../providers/week-start/WeekStartController";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import { Meal, MealDraft, createMealId } from "../../../types/meals";
import { addSavedMealIdeaToWeekPlan } from "../../../stores/weekPlanStorage";
import { getNextWeekStartForDate } from "../../../utils/weekDays";
import {
  getPendingRecipeImports,
  removePendingRecipeImport,
  type PendingRecipeImport,
} from "../../../utils/pendingRecipeImports";

const getMealRatingValue = (meal: Meal) =>
  typeof meal.rating === "number" ? meal.rating : 0;

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

const getMealCreatedTimestamp = (meal: Meal) => {
  if (meal.createdAt) {
    const time = Date.parse(meal.createdAt);
    if (!Number.isNaN(time)) {
      return time;
    }
  }
  if (meal.updatedAt) {
    const time = Date.parse(meal.updatedAt);
    if (!Number.isNaN(time)) {
      return time;
    }
  }
  return 0;
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

export default function MealsScreen() {
  const { url: sharedRecipeUrlParam } = useLocalSearchParams<{
    url?: string | string[];
  }>();
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { startDay } = useWeekStartController();
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
  const [selectedMealId, setSelectedMealId] = useState<string | undefined>();
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
  const [sortSelection, setSortSelection] = useState<MealSortSelection | null>({
    id: "dateAdded",
    direction: "desc",
  });
  const [freezerModalMeal, setFreezerModalMeal] = useState<Meal | null>(null);
  const [isMealPickerVisible, setMealPickerVisible] = useState(false);
  const [selectedFreezerMeal, setSelectedFreezerMeal] = useState<Meal | null>(
    null
  );
  const [displayOptions, setDisplayOptions] = useState({
    showDifficulty: true,
    showExpense: true,
    ratingMode: "family" as "family" | "summary" | "off",
    showServed: true,
    showEmoji: true,
  });
  const [isDisplaySheetOpen, setDisplaySheetOpen] = useState(false);
  const [suggestToastVisible, setSuggestToastVisible] = useState(false);
  const [pendingSuggestMeal, setPendingSuggestMeal] = useState<Meal | null>(
    null
  );
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
      setActiveTab(tab);
      animateContent(tab);
    },
    [animateContent]
  );

  const filteredMeals = useMemo(() => {
    if (!searchQuery.trim()) {
      return meals;
    }
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return meals.filter((meal) =>
      meal.title.toLowerCase().includes(normalizedQuery)
    );
  }, [meals, searchQuery]);

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

      const filteredList = list
        .filter(filterByExpense)
        .filter(filterByDifficulty);

      const sorted = [...filteredList].sort((a, b) => {
        switch (sortSelection.id) {
          case "name":
            return sortSelection.direction === "asc"
              ? a.title.localeCompare(b.title)
              : b.title.localeCompare(a.title);
          case "rating": {
            const ratingA = getMealRatingValue(a);
            const ratingB = getMealRatingValue(b);
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
          default:
            return 0;
        }
      });
      return sorted;
    },
    [sortSelection]
  );

  const sortedAllMeals = useMemo(
    () => sortMealsList(filteredMeals),
    [filteredMeals, sortMealsList]
  );

  const sortedFavorites = useMemo(
    () => sortMealsList(favorites),
    [favorites, sortMealsList]
  );

  const data = activeTab === "all" ? sortedAllMeals : sortedFavorites;

  const handleSortChange = useCallback(
    (selection: MealSortSelection | null) => {
      setSortSelection(selection);
    },
    []
  );

  const onOpenMeal = useCallback((meal: Meal) => {
    setModalMode("edit");
    setSelectedMealId(meal.id);
    setModalVisible(true);
  }, []);

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

  const servedRankMap = useMemo(() => {
    const sorted = meals
      .filter((meal) => (meal.servedCount ?? 0) > 0)
      .sort((a, b) => (b.servedCount ?? 0) - (a.servedCount ?? 0));
    const map = new Map<string, number>();
    sorted.forEach((meal, index) => {
      map.set(meal.id, index + 1);
    });
    return map;
  }, [meals]);

  const openFreezerModal = useCallback((meal: Meal) => {
    setSelectedFreezerMeal(null);
    setFreezerModalMeal(meal);
  }, []);

  const handleFreezerModalClose = useCallback(() => {
    setFreezerModalMeal(null);
    setSelectedFreezerMeal(null);
  }, []);

  const handleFreezerModalSave = useCallback(
    (meal: Meal, amount: string, unit: string, addedAt: string) => {
      updateMeal({
        id: meal.id,
        freezerAmount: amount,
        freezerUnit: unit,
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
        freezerUnit: "",
        freezerQuantity: "",
        freezerAddedAt: undefined,
      });
    },
    [updateMeal]
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
    ({ item }) => {
      const isFreezerTab = activeTab === "favorites";
      return (
        <MealListItem
          meal={item}
          onPress={() => onOpenMeal(item)}
          onDelete={() => deleteMeal(item.id)}
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
          servedRank={servedRankMap.get(item.id)}
          displayOptions={displayOptions}
        />
      );
    },
    [
      activeTab,
      deleteMeal,
      displayOptions,
      handleRemoveFromFreezer,
      onOpenMeal,
      openFreezerModal,
      servedRankMap,
    ]
  );

  const keyExtractor = useCallback((item: Meal) => item.id, []);

  const listEmpty = useMemo(() => {
    if (
      activeTab === "all" &&
      pendingImportQueue.length > 0 &&
      !searchQuery.trim()
    ) {
      return null;
    }
    if (activeTab === "all" && searchQuery.trim()) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No matches found</Text>
          <Text style={styles.emptySubtitle}>
            Try searching with a different name.
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
  }, [activeTab, pendingImportQueue.length, searchQuery, styles]);

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

  const cycleRatingMode = useCallback(() => {
    setDisplayOptions((prev) => {
      const next =
        prev.ratingMode === "family"
          ? "summary"
          : prev.ratingMode === "summary"
          ? "off"
          : "family";
      return { ...prev, ratingMode: next };
    });
  }, []);

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
        id: "ratings",
        label:
          displayOptions.ratingMode === "family"
            ? "Family Ratings"
            : displayOptions.ratingMode === "summary"
            ? "Ratings Star"
            : "Ratings Off",
        selected: displayOptions.ratingMode !== "off",
        onPress: cycleRatingMode,
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
    [cycleRatingMode, displayOptions, toggleDisplayOption]
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
          <MealTabs activeTab={activeTab} onChange={handleTabChange} />
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
        <Animated.View style={{ opacity }}>
          <FlatList
            testID="meals-list"
            data={data}
            keyExtractor={keyExtractor}
            renderItem={renderMeal}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                testID="meals-refresh-control"
                tintColor={theme.color.accent}
                colors={[theme.color.accent]}
                refreshing={isRefreshing}
                onRefresh={refresh}
              />
            }
            ListHeaderComponent={
              activeTab === "all" ? (
                <View style={styles.searchHeader}>
                  <MealSearchInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSortChange={handleSortChange}
                  />
                  {shouldShowPendingImports ? (
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
                title: activePendingImport?.title,
                createdAt: activePendingImport?.createdAt,
              }
            : undefined
        }
        autoFillOnOpen={Boolean(pendingSharedRecipeUrl)}
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
        initialUnit={freezerAmountMeal?.freezerUnit}
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
  });
