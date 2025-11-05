import {
  Alert,
  Animated,
  Easing,
  FlatList,
  ListRenderItem,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MealListItem from "../../../components/meals/MealListItem";
import FreezerAmountModal from "../../../components/meals/FreezerAmountModal";
import MealTabs, { type MealTabKey } from "../../../components/meals/MealTabs";
import MealModalOverlay from "../../../components/meals/MealModalOverlay";
import MealSearchInput, {
  type MealSortSelection,
} from "../../../components/meals/MealSearchInput";
import TabParent from "../../../components/tab-parent/TabParent";
import { useMeals } from "../../../hooks/useMeals";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import { Meal, MealDraft, createMealId } from "../../../types/meals";

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

export default function MealsScreen() {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortSelection, setSortSelection] = useState<MealSortSelection | null>({
    id: "dateAdded",
    direction: "desc",
  });
  const [freezerModalMeal, setFreezerModalMeal] = useState<Meal | null>(null);
  const [isFreezerAddModalVisible, setFreezerAddModalVisible] = useState(false);
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

  const freezerCandidates = useMemo(
    () => meals.filter((meal) => !meal.isFavorite),
    [meals]
  );

  const openFreezerModal = useCallback((meal: Meal) => {
    setFreezerModalMeal(meal);
  }, []);

  const handleFreezerModalClose = useCallback(() => {
    setFreezerModalMeal(null);
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
            isFreezerTab
              ? () => handleRemoveFromFreezer(item.id)
              : undefined
          }
        />
      );
    },
    [activeTab, deleteMeal, handleRemoveFromFreezer, onOpenMeal, openFreezerModal]
  );

  const keyExtractor = useCallback((item: Meal) => item.id, []);

  const listEmpty = useMemo(() => {
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
  }, [activeTab, searchQuery, styles]);

  const opacity = contentProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.92],
  });

  const selectedMeal = useMemo(
    () => meals.find((meal) => meal.id === selectedMealId),
    [meals, selectedMealId]
  );

  const handleDismissModal = useCallback(() => {
    setModalVisible(false);
    setSelectedMealId(undefined);
    setModalMode("create");
  }, []);

  const handleCreateMeal = useCallback(
    (draft: MealDraft) => {
      const now = new Date().toISOString();
      const id = createMealId();
      addMeal({
        id,
        ...draft,
        createdAt: draft.createdAt ?? now,
        updatedAt: draft.updatedAt ?? now,
      });
    },
    [addMeal]
  );

  const handleUpdateMeal = useCallback(
    (meal: Meal) => {
      updateMeal(meal);
    },
    [updateMeal]
  );

  const handleOpenMenu = useCallback(() => {
    Alert.alert("Meals", "Menu actions coming soon.");
  }, []);

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
      setFreezerAddModalVisible(true);
      return;
    }
    handleAddMeal();
  }, [activeTab, freezerCandidates.length, handleAddMeal]);

  const isFreezerTab = activeTab === "favorites";

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

  const menuButtonConfig = useMemo(
    () =>
      isFreezerTab
        ? undefined
        : {
            onPress: handleOpenMenu,
            testID: "meals-more-button",
            accessibilityLabel: "Open meals menu",
          },
    [handleOpenMenu, isFreezerTab]
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
              Keep tabs on leftovers and meal prep you've already handled.
              Use this list as your personal freezer inventory.
            </Text>
          </View>
        ) : null}
        <Animated.View style={[styles.listWrapper, { opacity }]}>
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
        onDismiss={handleDismissModal}
        onCreateMeal={handleCreateMeal}
        onUpdateMeal={handleUpdateMeal}
      />
      <FreezerAmountModal
        mode="edit"
        visible={Boolean(freezerModalMeal)}
        initialMeal={freezerModalMeal ?? undefined}
        initialAmount={
          freezerModalMeal?.freezerAmount ??
          freezerModalMeal?.freezerQuantity ??
          ""
        }
        initialUnit={freezerModalMeal?.freezerUnit}
        initialAddedAt={freezerModalMeal?.freezerAddedAt}
        onDismiss={handleFreezerModalClose}
        onComplete={handleFreezerModalSave}
      />
      <FreezerAmountModal
        mode="add"
        visible={isFreezerAddModalVisible}
        meals={freezerCandidates}
        onDismiss={() => setFreezerAddModalVisible(false)}
        onComplete={(meal, amount, unit, addedAt) => {
          updateMeal({
            id: meal.id,
            isFavorite: true,
            freezerAmount: amount,
            freezerUnit: unit,
            freezerAddedAt: addedAt,
          });
          setFreezerAddModalVisible(false);
        }}
      />
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
    listWrapper: {
      flex: 1,
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
