import { MaterialCommunityIcons } from "@expo/vector-icons";
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
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import MealListItem from "../../../components/meals/MealListItem";
import MealTabs, { type MealTabKey } from "../../../components/meals/MealTabs";
import MealModalOverlay from "../../../components/meals/MealModalOverlay";
import TabParent from "../../../components/tab-parent/TabParent";
import { useMeals } from "../../../hooks/useMeals";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import { Meal } from "../../../types/meals";
import { FlexGrid } from "../../../styles/flex-grid";

export default function MealsScreen() {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
  const [selectedMealId, setSelectedMealId] = useState<string | undefined>();
  const [isModalVisible, setModalVisible] = useState(false);
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

  const onOpenMeal = useCallback((meal: Meal) => {
    setSelectedMealId(meal.id);
    setModalVisible(true);
  }, []);

  const renderMeal: ListRenderItem<Meal> = useCallback(
    ({ item }) => <MealListItem meal={item} onPress={() => onOpenMeal(item)} />,
    [onOpenMeal]
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

  const header = (
    <FlexGrid
      gutterWidth={theme.space.lg}
      padding={{ bottom: theme.space["2xl"] }}
    >
      <FlexGrid.Row alignItems="center" justifyContent="space-between">
        <FlexGrid.Col>
          <MealTabs activeTab={activeTab} onChange={handleTabChange} />
        </FlexGrid.Col>
        <FlexGrid.Col alignSelf="center">
          <PressableIcon theme={theme} style={styles.filterButton} />
        </FlexGrid.Col>
      </FlexGrid.Row>
    </FlexGrid>
  );

  const handleDismissModal = useCallback(() => {
    setModalVisible(false);
    setSelectedMealId(undefined);
  }, []);

  return (
    <>
      <TabParent backgroundColor={theme.color.bg} title="Meals">
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
            ListHeaderComponent={header}
          />
        </Animated.View>
      </TabParent>
      <MealModalOverlay
        mealId={selectedMealId}
        visible={isModalVisible}
        onDismiss={handleDismissModal}
      />
    </>
  );
}

type PressableIconProps = {
  theme: WeeklyTheme;
  style: StyleProp<ViewStyle>;
};

const PressableIcon = ({ theme, style }: PressableIconProps) => (
  <Pressable
    style={({ pressed }) => [style, pressed ? { opacity: 0.9 } : null]}
    hitSlop={theme.space.sm}
    accessibilityRole="button"
    accessibilityLabel="Filter meals"
  >
    <MaterialCommunityIcons name="tune" size={20} color={theme.color.ink} />
  </Pressable>
);

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
      paddingTop: 0,
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
