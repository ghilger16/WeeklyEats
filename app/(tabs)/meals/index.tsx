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
import MealTabs, { type MealTabKey } from "../../../components/meals/MealTabs";
import MealModalOverlay from "../../../components/meals/MealModalOverlay";
import TabParent from "../../../components/tab-parent/TabParent";
import { useMeals } from "../../../hooks/useMeals";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import { Meal, MealDraft, createMealId } from "../../../types/meals";

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

  const data = activeTab === "all" ? meals : favorites;

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

  const renderMeal: ListRenderItem<Meal> = useCallback(
    ({ item }) => (
      <MealListItem
        meal={item}
        onPress={() => onOpenMeal(item)}
        onDelete={() => deleteMeal(item.id)}
      />
    ),
    [deleteMeal, onOpenMeal]
  );

  const keyExtractor = useCallback((item: Meal) => item.id, []);

  const listEmpty = useMemo(
    () => (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No meals yet</Text>
        <Text style={styles.emptySubtitle}>
          Add dinners to see them listed here.
        </Text>
      </View>
    ),
    []
  );

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

  return (
    <>
      <TabParent
        backgroundColor={theme.color.bg}
        title="Meals"
        addBtn={{
          onPress: handleAddMeal,
          testID: "add-meal-button",
          accessibilityLabel: "Add meal",
        }}
        menuBtn={{
          onPress: handleOpenMenu,
          testID: "meals-more-button",
          accessibilityLabel: "Open meals menu",
        }}
      >
        <View style={styles.tabsHeader}>
          <MealTabs activeTab={activeTab} onChange={handleTabChange} />
        </View>
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
      paddingTop: 15,
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
