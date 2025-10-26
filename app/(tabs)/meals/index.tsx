import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  ActionSheetIOS,
  Alert,
  Animated,
  Easing,
  FlatList,
  ListRenderItem,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useMemo, useRef, useState } from "react";
import MealListItem from "../../../components/meals/MealListItem";
import MealTabs, {
  type MealTabKey,
} from "../../../components/meals/MealTabs";
import { useMeals } from "../../../hooks/useMeals";
import { darkTheme } from "../../../styles/theme";
import { Meal } from "../../../types/meals";
import { FlexGrid } from "../../../styles/flex-grid";

const theme = darkTheme;

export default function MealsScreen() {
  const router = useRouter();
  const {
    meals,
    favorites,
    refresh,
    isRefreshing,
    toggleFavorite,
    toggleLock,
    deleteMeal,
  } = useMeals();
  const [activeTab, setActiveTab] = useState<MealTabKey>("meals");
  const contentProgress = useRef(new Animated.Value(0)).current;

  const animateContent = useCallback(
    (tab: MealTabKey) => {
      Animated.timing(contentProgress, {
        toValue: tab === "meals" ? 0 : 1,
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

  const data = activeTab === "meals" ? meals : favorites;

  const onOpenMeal = useCallback(
    (meal: Meal) => {
      router.push({
        pathname: "/modals/meal-editor",
        params: { mealId: meal.id },
      });
    },
    [router]
  );

  const onQuickActions = useCallback(
    (meal: Meal) => {
      const toggleLockLabel = meal.locked ? "Unlock" : "Lock";
      const favoriteLabel = meal.isFavorite ? "Unfavorite" : "Favorite";

      if (Platform.OS === "ios") {
        ActionSheetIOS.showActionSheetWithOptions(
          {
            options: [toggleLockLabel, favoriteLabel, "Delete", "Cancel"],
            destructiveButtonIndex: 2,
            cancelButtonIndex: 3,
          },
          (buttonIndex) => {
            if (buttonIndex === 0) {
              toggleLock(meal.id);
            } else if (buttonIndex === 1) {
              toggleFavorite(meal.id);
            } else if (buttonIndex === 2) {
              deleteMeal(meal.id);
            }
          }
        );
        return;
      }

      Alert.alert("Meal actions", meal.title, [
        {
          text: toggleLockLabel,
          onPress: () => toggleLock(meal.id),
        },
        {
          text: favoriteLabel,
          onPress: () => toggleFavorite(meal.id),
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteMeal(meal.id),
        },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [deleteMeal, toggleFavorite, toggleLock]
  );

  const renderMeal: ListRenderItem<Meal> = useCallback(
    ({ item }) => (
      <MealListItem
        meal={item}
        onPress={() => onOpenMeal(item)}
        onLongPress={() => onQuickActions(item)}
      />
    ),
    [onOpenMeal, onQuickActions]
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

  const translateX = contentProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 16],
  });
  const opacity = contentProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.92],
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <Animated.View
        style={[styles.listWrapper, { opacity, transform: [{ translateX }] }]}
      >
        <FlatList
          testID="meals-list"
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderMeal}
          ListHeaderComponent={
            <FlexGrid gutterWidth={theme.space.lg} padding={{ bottom: theme.space["2xl"] }}>
              <FlexGrid.Row wrap={false}>
                <FlexGrid.Col span={12}>
                  <Text style={styles.heading}>Weekly Eats</Text>
                </FlexGrid.Col>
              </FlexGrid.Row>
              <FlexGrid.Row alignItems="center" justifyContent="space-between">
                <FlexGrid.Col grow={1}>
                  <MealTabs activeTab={activeTab} onChange={handleTabChange} />
                </FlexGrid.Col>
                <FlexGrid.Col grow={0} alignSelf="stretch">
                  <PressableIcon />
                </FlexGrid.Col>
              </FlexGrid.Row>
            </FlexGrid>
          }
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
    </SafeAreaView>
  );
}

const PressableIcon = () => (
  <Pressable
    style={styles.filterButton}
    hitSlop={theme.space.sm}
    accessibilityRole="button"
    accessibilityLabel="Filter meals"
  >
    <MaterialCommunityIcons name="tune" size={20} color={theme.color.ink} />
  </Pressable>
);

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.color.bg,
  },
  listContent: {
    paddingHorizontal: theme.space.xl,
    paddingBottom: theme.space["2xl"],
    paddingTop: theme.space["2xl"],
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
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.color.border,
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
