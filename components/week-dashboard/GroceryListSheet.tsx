import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  GestureHandlerRootView,
  Swipeable,
} from "react-native-gesture-handler";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import {
  GroceryCategory,
  GroceryList,
  GroceryListItem,
  GroceryListViewMode,
} from "../../types/groceryList";
import { IngredientType } from "../../types/meals";
import { WeekPlanDay } from "../../hooks/useCurrentWeekPlan";
import {
  getGroceryListForWeek,
  getGroceryListViewMode,
  reconcileGroceryList,
  setGroceryListForWeek,
  setGroceryListViewMode,
} from "../../stores/groceryListStorage";
import MealEmoji from "../emoji/MealEmoji";

type Props = {
  visible: boolean;
  weekId: string;
  days: WeekPlanDay[];
  onDismiss: () => void;
};

type GroceryListContentProps = {
  weekId: string;
  days: WeekPlanDay[];
  isActive?: boolean;
  onDismiss?: () => void;
  showHeader?: boolean;
  useSafeArea?: boolean;
  weekNavigator?: ReactNode;
};

type GroceryTabLayout = {
  x: number;
  width: number;
};

type RawIngredient =
  | string
  | { name?: unknown; category?: unknown; ingredientType?: unknown };

const categoryOrder: GroceryCategory[] = [
  "meat",
  "seafood",
  "pastaAndRice",
  "produce",
  "dairy",
  "canned",
  "pantry",
  "condiments",
  "bakery",
  "deli",
  "frozen",
  "baking",
  "beverages",
  "snacks",
  "household",
  "other",
  "spices",
];

const categoryLabel: Record<GroceryCategory, string> = {
  meat: "🥩 Meat",
  seafood: "🐟 Seafood",
  pastaAndRice: "🍝 Pasta & Rice",
  produce: "🥬 Produce",
  dairy: "🥛 Dairy",
  canned: "🥫 Canned Goods",
  pantry: "🥣 Pantry",
  condiments: "🥫 Condiments & Sauces",
  bakery: "🍞 Bakery",
  deli: "🥪 Deli",
  frozen: "❄️ Frozen",
  baking: "🧁 Baking",
  beverages: "🥤 Beverages",
  snacks: "🍿 Snacks",
  household: "🧹 Household",
  other: "📦 Other",
  spices: "🌿 Spices & Seasonings",
};

const normalizeCategory = (value: unknown): GroceryCategory => {
  if (typeof value !== "string") {
    return "other";
  }
  return categoryOrder.includes(value as GroceryCategory)
    ? (value as GroceryCategory)
    : "other";
};

const normalizeIngredientType = (value: unknown): IngredientType =>
  value === "pantryStaple" ? "pantryStaple" : "keyIngredient";

const formatIngredientName = (name: string) =>
  name.replace(/\b\p{L}/gu, (character) => character.toLocaleUpperCase());

const normalizeIngredient = (
  ingredient: RawIngredient,
): {
  name: string;
  category: GroceryCategory;
  ingredientType: IngredientType;
} | null => {
  if (typeof ingredient === "string") {
    const name = ingredient.trim();
    return name
      ? { name, category: "other", ingredientType: "keyIngredient" }
      : null;
  }
  if (!ingredient || typeof ingredient !== "object") {
    return null;
  }
  const name =
    typeof ingredient.name === "string" ? ingredient.name.trim() : "";
  if (!name) {
    return null;
  }
  return {
    name,
    category: normalizeCategory(ingredient.category),
    ingredientType: normalizeIngredientType(ingredient.ingredientType),
  };
};

export const buildItemsFromPlan = (days: WeekPlanDay[]): GroceryListItem[] => {
  const items: GroceryListItem[] = [];
  days.forEach((day, dayIndex) => {
    const meal = day.meal;
    if (!meal?.ingredients?.length) {
      return;
    }
    (meal.ingredients as RawIngredient[]).forEach((ingredient, itemIndex) => {
      const normalized = normalizeIngredient(ingredient);
      if (!normalized) {
        return;
      }
      items.push({
        id: `${day.key}-${meal.id}-${itemIndex}-${normalized.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")}`,
        name: normalized.name,
        category: normalized.category,
        ingredientType: normalized.ingredientType,
        source: "planned",
        mealId: meal.id,
        mealTitle: meal.title,
        mealEmoji: meal.emoji,
        dayKey: day.key,
        dayLabel: day.label,
        dayName: day.displayName,
        sortIndex: dayIndex * 100 + itemIndex,
      });
    });
  });
  return items;
};

type MealProgressIndicatorProps = {
  checked: number;
  total: number;
  theme: WeeklyTheme;
  styles: ReturnType<typeof createStyles>;
};

function MealProgressIndicator({
  checked,
  total,
  theme,
  styles,
}: MealProgressIndicatorProps) {
  const state = checked === 0 ? 0 : checked === total ? 2 : 1;
  const animatedState = useRef(new Animated.Value(state)).current;

  useEffect(() => {
    Animated.timing(animatedState, {
      toValue: state,
      duration: theme.motion.duration.slow,
      easing: Easing.bezier(0, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, [animatedState, state, theme.motion.duration.slow]);

  const color = animatedState.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [
      theme.color.subtleInk,
      theme.color.accent,
      theme.color.success,
    ],
  });
  const checkOpacity = animatedState.interpolate({
    inputRange: [0, 1.8, 2],
    outputRange: [0, 0, 1],
    extrapolate: "clamp",
  });
  const checkWidth = animatedState.interpolate({
    inputRange: [0, 1.8, 2],
    outputRange: [0, 0, 16],
    extrapolate: "clamp",
  });

  return (
    <Animated.View style={styles.mealProgress}>
      <Animated.View
        style={[
          styles.mealProgressCheck,
          { opacity: checkOpacity, width: checkWidth },
        ]}
      >
        <Text style={styles.mealProgressCheckText}>✓</Text>
      </Animated.View>
      <Animated.Text style={[styles.mealProgressText, { color }]}>
        {`${checked}/${total}`}
      </Animated.Text>
    </Animated.View>
  );
}

export function GroceryListContent({
  weekId,
  days,
  isActive = true,
  onDismiss,
  showHeader = true,
  useSafeArea = true,
  weekNavigator,
}: GroceryListContentProps) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [list, setList] = useState<GroceryList | null>(null);
  const [viewMode, setViewMode] = useState<GroceryListViewMode>("meal");
  const [manualInput, setManualInput] = useState("");
  const [isAddingManualItem, setAddingManualItem] = useState(false);
  const [collapsedMealGroups, setCollapsedMealGroups] = useState<
    Record<string, boolean>
  >({});
  const [collapsedCategoryGroups, setCollapsedCategoryGroups] = useState<
    Record<string, boolean>
  >({});
  const [expandedPantryGroups, setExpandedPantryGroups] = useState<Record<string, boolean>>({});
  const [isCategoryPantryExpanded, setCategoryPantryExpanded] = useState(false);
  const [tabLayouts, setTabLayouts] = useState<
    Record<GroceryListViewMode, GroceryTabLayout>
  >({
    meal: { x: 0, width: 0 },
    category: { x: 0, width: 0 },
  });
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;
  const contentScrollRef = useRef<ScrollView>(null);
  const animationDuration = theme.motion.duration.normal;

  const animateIndicator = useCallback(
    (layout: GroceryTabLayout) => {
      Animated.parallel([
        Animated.timing(indicatorX, {
          toValue: layout.x,
          duration: animationDuration,
          easing: Easing.bezier(0, 0, 0.2, 1),
          useNativeDriver: false,
        }),
        Animated.timing(indicatorWidth, {
          toValue: layout.width,
          duration: animationDuration,
          easing: Easing.bezier(0, 0, 0.2, 1),
          useNativeDriver: false,
        }),
      ]).start();
    },
    [animationDuration, indicatorWidth, indicatorX],
  );

  useEffect(() => {
    animateIndicator(tabLayouts[viewMode]);
  }, [animateIndicator, tabLayouts, viewMode]);

  const onTabLayout = useCallback(
    (mode: GroceryListViewMode) =>
      (event: Parameters<NonNullable<View["props"]["onLayout"]>>[0]) => {
        const { x, width } = event.nativeEvent.layout;
        setTabLayouts((prev) => {
          const current = prev[mode];
          if (current.x === x && current.width === width) {
            return prev;
          }
          return { ...prev, [mode]: { x, width } };
        });
      },
    [],
  );

  const indicatorStyle = useMemo(
    () => [
      styles.tabIndicator,
      {
        left: indicatorX,
        width: indicatorWidth,
      },
    ],
    [indicatorWidth, indicatorX, styles.tabIndicator],
  );

  useEffect(() => {
    if (!isActive) {
      return;
    }
    let cancelled = false;
    Promise.all([getGroceryListForWeek(weekId), getGroceryListViewMode()]).then(
      async ([storedList, storedMode]) => {
        if (cancelled) {
          return;
        }
        setViewMode(storedMode);
        const generated = reconcileGroceryList(
          weekId,
          buildItemsFromPlan(days),
          storedList,
        );
        await setGroceryListForWeek(weekId, generated);
        if (!cancelled) {
          setList(generated);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [days, isActive, weekId]);

  const promotedPantrySet = useMemo(
    () => new Set(list?.promotedPantryItems ?? []),
    [list?.promotedPantryItems],
  );
  const pantryItems = useMemo(
    () => (list?.items ?? []).filter((item) => item.ingredientType === "pantryStaple"),
    [list?.items],
  );
  const shoppingItems = useMemo(
    () => [
      ...(list?.items ?? []).filter(
        (item) => item.ingredientType !== "pantryStaple" || promotedPantrySet.has(item.id),
      ),
      ...(list?.manualItems ?? []),
    ],
    [list?.items, list?.manualItems, promotedPantrySet],
  );
  const checkedSet = useMemo(
    () => new Set(list?.checkedItems ?? []),
    [list?.checkedItems],
  );
  const sharedIngredientUsage = useMemo(() => {
    const usage = new Map<
      string,
      { itemIds: string[]; meals: Map<string, string> }
    >();
    shoppingItems.forEach((item) => {
      const key = item.name.trim().toLocaleLowerCase();
      const entry = usage.get(key) ?? {
        itemIds: [] as string[],
        meals: new Map<string, string>(),
      };
      entry.itemIds.push(item.id);
      if (item.mealId) {
        entry.meals.set(item.mealId, item.mealTitle ?? "Planned meal");
      }
      usage.set(key, entry);
    });
    return usage;
  }, [shoppingItems]);

  const persistList = useCallback(
    async (nextList: GroceryList) => {
      setList(nextList);
      await setGroceryListForWeek(weekId, nextList);
    },
    [weekId],
  );

  const handleViewModeChange = (mode: GroceryListViewMode) => {
    setViewMode(mode);
    setGroceryListViewMode(mode);
  };

  const toggleItem = (itemId: string) => {
    if (!list) {
      return;
    }
    const isChecked = checkedSet.has(itemId);
    const nextChecked = isChecked
      ? list.checkedItems.filter((id) => id !== itemId)
      : [...list.checkedItems, itemId];
    persistList({ ...list, checkedItems: nextChecked });
  };

  const toggleItems = (itemIds: string[]) => {
    if (!list) {
      return;
    }
    const allChecked = itemIds.every((id) => checkedSet.has(id));
    const itemIdSet = new Set(itemIds);
    const nextChecked = allChecked
      ? list.checkedItems.filter((id) => !itemIdSet.has(id))
      : Array.from(new Set([...list.checkedItems, ...itemIds]));
    persistList({ ...list, checkedItems: nextChecked });
  };

  const togglePantryPromotion = (itemIds: string[]) => {
    if (!list) return;
    const allPromoted = itemIds.every((id) => promotedPantrySet.has(id));
    const ids = new Set(itemIds);
    const promotedPantryItems = allPromoted
      ? list.promotedPantryItems.filter((id) => !ids.has(id))
      : Array.from(new Set([...list.promotedPantryItems, ...itemIds]));
    persistList({
      ...list,
      promotedPantryItems,
      checkedItems: allPromoted
        ? list.checkedItems.filter((id) => !ids.has(id))
        : list.checkedItems,
    });
  };

  const handleAddManualItem = (keepAdding = false) => {
    if (!list) {
      return;
    }
    const name = manualInput.trim();
    if (!name) {
      return;
    }
    const item: GroceryListItem = {
      id: `manual-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
      name,
      category: "other",
      source: "manual",
      sortIndex: list.manualItems.length,
    };
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setManualInput("");
    if (!keepAdding) {
      setAddingManualItem(false);
    }
    persistList({
      ...list,
      manualItems: [...list.manualItems, item],
    });
  };

  const deleteManualItems = (itemIds: string[]) => {
    if (!list) {
      return;
    }
    const itemIdSet = new Set(itemIds);
    persistList({
      ...list,
      manualItems: list.manualItems.filter((item) => !itemIdSet.has(item.id)),
      checkedItems: list.checkedItems.filter((id) => !itemIdSet.has(id)),
    });
  };

  const withManualDelete = (
    key: string,
    manualItemIds: string[],
    row: ReactNode,
  ) => {
    if (manualItemIds.length === 0) {
      return row;
    }
    return (
      <GestureHandlerRootView key={key} style={styles.swipeRoot}>
        <Swipeable
          friction={2}
          rightThreshold={64}
          renderRightActions={() => (
            <Pressable
              onPress={() => deleteManualItems(manualItemIds)}
              accessibilityRole="button"
              accessibilityLabel="Delete manual grocery item"
              style={({ pressed }) => [
                styles.deleteAction,
                pressed && styles.deleteActionPressed,
              ]}
            >
              <MaterialCommunityIcons
                name="trash-can-outline"
                size={20}
                color={theme.color.ink}
              />
              <Text style={styles.deleteActionText}>Delete</Text>
            </Pressable>
          )}
        >
          {row}
        </Swipeable>
      </GestureHandlerRootView>
    );
  };

  const renderItem = (item: GroceryListItem) => {
    const sharedUsage = sharedIngredientUsage.get(
      item.name.trim().toLocaleLowerCase(),
    );
    const mealNames = sharedUsage
      ? Array.from(sharedUsage.meals.values())
      : [];
    const isShared = mealNames.length > 1;
    const checked = isShared
      ? sharedUsage!.itemIds.every((id) => checkedSet.has(id))
      : checkedSet.has(item.id);
    const row = (
      <Pressable
        onPress={() =>
          isShared ? toggleItems(sharedUsage!.itemIds) : toggleItem(item.id)
        }
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`${checked ? "Checked" : "Unchecked"} ${item.name}${isShared ? `, used in ${mealNames.join(" and ")}` : ""}`}
        style={({ pressed }) => [
          styles.itemRow,
          pressed && styles.itemRowPressed,
        ]}
      >
        <MaterialCommunityIcons
          name={
            checked ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"
          }
          size={20}
          color={checked ? theme.color.accent : theme.color.subtleInk}
        />
        <View style={styles.itemTextStack}>
          <Text
            style={[
              styles.itemText,
              styles.categoryItemText,
              checked && styles.itemTextChecked,
            ]}
            numberOfLines={1}
          >
            {formatIngredientName(item.name)}
            {isShared ? (
              <Text style={styles.sharedMealCount}>   ×{mealNames.length}</Text>
            ) : null}
          </Text>
          {isShared ? (
            <Text
              style={[
                styles.sharedMealNames,
                checked && styles.sharedMealNamesChecked,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {mealNames.join(" • ")}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
    return item.source === "manual"
      ? withManualDelete(item.id, [item.id], row)
      : <View key={item.id}>{row}</View>;
  };

  const itemsByMeal = useMemo(() => {
    const groups = new Map<
      string,
      {
        dayTitle: string;
        mealTitle: string;
        mealEmoji: string;
        items: GroceryListItem[];
        pantryItems: GroceryListItem[];
      }
    >();
    [...(list?.items ?? []), ...(list?.manualItems ?? [])].forEach((item) => {
      const key =
        item.source === "manual" ? "manual" : `${item.dayKey}-${item.mealId}`;
      const group =
        groups.get(key) ??
        (item.source === "manual"
          ? {
              dayTitle: "",
              mealTitle: "Your List",
              mealEmoji: "",
              items: [],
              pantryItems: [],
            }
          : {
              dayTitle: item.dayLabel ?? item.dayName ?? "",
              mealTitle: item.mealTitle ?? "",
              mealEmoji: item.mealEmoji ?? "",
              items: [],
              pantryItems: [],
            });
      if (item.ingredientType === "pantryStaple") group.pantryItems.push(item);
      if (item.ingredientType !== "pantryStaple" || promotedPantrySet.has(item.id)) group.items.push(item);
      groups.set(key, group);
    });
    if (!groups.has("manual")) {
      groups.set("manual", {
        dayTitle: "",
        mealTitle: "Your List",
        mealEmoji: "",
        items: [],
        pantryItems: [],
      });
    }
    return Array.from(groups.values());
  }, [list?.items, list?.manualItems, promotedPantrySet]);

  const itemsByCategory = useMemo(() => {
    const categoryRank = new Map(
      categoryOrder.map((category, index) => [category, index]),
    );
    const deduplicated = new Map<
      string,
      {
        item: GroceryListItem;
        itemIds: string[];
        manualItemIds: string[];
        meals: Map<string, string>;
      }
    >();

    [...shoppingItems]
      .sort(
        (a, b) =>
          (categoryRank.get(a.category) ?? categoryOrder.length) -
          (categoryRank.get(b.category) ?? categoryOrder.length),
      )
      .forEach((item) => {
        const normalizedName = item.name.trim().toLocaleLowerCase();
        const existing = deduplicated.get(normalizedName);
        if (existing) {
          existing.itemIds.push(item.id);
          if (item.source === "manual") {
            existing.manualItemIds.push(item.id);
          }
          if (item.mealId) {
            existing.meals.set(
              item.mealId,
              item.mealTitle ?? "Planned meal",
            );
          }
          return;
        }
        deduplicated.set(normalizedName, {
          item,
          itemIds: [item.id],
          manualItemIds: item.source === "manual" ? [item.id] : [],
          meals: new Map(
            item.mealId
              ? [[item.mealId, item.mealTitle ?? "Planned meal"]]
              : [],
          ),
        });
      });

    const consolidatedItems = Array.from(deduplicated.values());
    return categoryOrder
      .map((category) => ({
        category,
        title: categoryLabel[category],
        items: consolidatedItems
          .filter(({ item }) => item.category === category)
          .sort((a, b) =>
            a.item.name.localeCompare(b.item.name, undefined, {
              sensitivity: "base",
            }),
          ),
      }))
      .filter((group) => group.items.length > 0);
  }, [shoppingItems]);

  const renderCategoryItem = (
    entry: (typeof itemsByCategory)[number]["items"][number],
  ) => {
    const checked = entry.itemIds.every((id) => checkedSet.has(id));
    const mealNames = Array.from(entry.meals.values());
    const isShared = mealNames.length > 1;
    const row = (
      <Pressable
        key={`${entry.item.category}-${entry.item.name.toLocaleLowerCase()}`}
        onPress={() => toggleItems(entry.itemIds)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`${checked ? "Checked" : "Unchecked"} ${entry.item.name}${isShared ? `, used in ${mealNames.join(" and ")}` : ""}`}
        style={({ pressed }) => [
          styles.itemRow,
          pressed && styles.itemRowPressed,
        ]}
      >
        <MaterialCommunityIcons
          name={
            checked ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"
          }
          size={20}
          color={checked ? theme.color.accent : theme.color.subtleInk}
        />
        <View style={styles.itemTextStack}>
          <Text
            style={[
              styles.itemText,
              styles.categoryItemText,
              checked && styles.itemTextChecked,
            ]}
            numberOfLines={1}
          >
            {formatIngredientName(entry.item.name)}
            {isShared ? (
              <Text style={styles.sharedMealCount}>   ×{mealNames.length}</Text>
            ) : null}
          </Text>
          {isShared ? (
            <Text
              style={[
                styles.sharedMealNames,
                checked && styles.sharedMealNamesChecked,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {mealNames.join(" • ")}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
    return withManualDelete(
      `${entry.item.category}-${entry.item.name.toLocaleLowerCase()}`,
      entry.manualItemIds,
      row,
    );
  };

  const pantryEntries = useMemo(() => {
    const entries = new Map<string, { item: GroceryListItem; itemIds: string[]; meals: Map<string, string> }>();
    pantryItems.forEach((item) => {
      const key = item.name.trim().toLocaleLowerCase();
      const entry = entries.get(key) ?? { item, itemIds: [], meals: new Map<string, string>() };
      entry.itemIds.push(item.id);
      if (item.mealId) entry.meals.set(item.mealId, item.mealTitle ?? "Planned meal");
      entries.set(key, entry);
    });
    return entries;
  }, [pantryItems]);

  const renderPantryReminder = (item: GroceryListItem, showSources = false) => {
    const entry = pantryEntries.get(item.name.trim().toLocaleLowerCase());
    if (!entry) return null;
    const added = entry.itemIds.every((id) => promotedPantrySet.has(id));
    const mealNames = Array.from(entry.meals.values());
    return (
      <Pressable
        key={`pantry-${item.id}`}
        onPress={() => togglePantryPromotion(entry.itemIds)}
        accessibilityRole="button"
        accessibilityLabel={`${added ? "Remove" : "Add"} ${item.name} ${added ? "from" : "to"} grocery list`}
        style={({ pressed }) => [styles.pantryRow, pressed && styles.itemRowPressed]}
      >
        <View style={styles.itemTextStack}>
          <Text style={[styles.pantryItemText, added && styles.pantryItemAdded]} numberOfLines={1}>
            {formatIngredientName(item.name)}
            {entry.itemIds.length > 1 ? <Text style={styles.sharedMealCount}>   ×{entry.itemIds.length}</Text> : null}
          </Text>
          {showSources && mealNames.length > 1 ? <Text style={styles.sharedMealNames} numberOfLines={1}>{mealNames.join(" • ")}</Text> : null}
        </View>
        <View style={styles.pantryAction}>
          {added ? <MaterialCommunityIcons name="check" size={15} color={theme.color.success} /> : <MaterialCommunityIcons name="plus" size={15} color={theme.color.accent} />}
          <Text style={[styles.pantryActionText, added && styles.pantryActionAdded]}>{added ? "Added" : "Add"}</Text>
        </View>
      </Pressable>
    );
  };

  const content = (
    <KeyboardAvoidingView
      style={useSafeArea ? styles.sheetContent : styles.inlineContent}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={useSafeArea ? 0 : 96}
    >
      {showHeader ? (
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Grocery List</Text>
            <Text style={styles.subtitle}>Ingredients from your meal plan</Text>
          </View>
          {onDismiss ? (
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel="Close grocery list"
              style={styles.closeButton}
            >
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={theme.color.ink}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.groceryTabs}>
        {(["meal", "category"] as GroceryListViewMode[]).map((mode) => {
          const selected = viewMode === mode;
          return (
            <Pressable
              key={mode}
              onPress={() => handleViewModeChange(mode)}
              onLayout={onTabLayout(mode)}
              hitSlop={theme.space.sm}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.groceryTabButton,
                pressed && styles.groceryTabButtonPressed,
              ]}
            >
              <Text style={styles.groceryTabLabel}>
                {mode === "meal" ? "Meal" : "Category"}
              </Text>
            </Pressable>
          );
        })}
        <View style={styles.tabUnderline} />
        <Animated.View style={indicatorStyle} />
      </View>

      {weekNavigator}

      <ScrollView
        ref={contentScrollRef}
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (isAddingManualItem) {
            contentScrollRef.current?.scrollToEnd({ animated: true });
          }
        }}
      >
        {viewMode === "meal" ? (
          itemsByMeal.map((group) => {
            const groupKey = `${group.dayTitle}-${group.mealTitle}`;
            const collapsed =
              collapsedMealGroups[groupKey] ?? Boolean(group.dayTitle);
            const checkedCount = group.items.filter((item) =>
              checkedSet.has(item.id),
            ).length;
            return (
              <View key={groupKey} style={styles.mealGroup}>
                <Pressable
                  onPress={() =>
                    setCollapsedMealGroups((current) => ({
                      ...current,
                      [groupKey]: !collapsed,
                    }))
                  }
                  accessibilityRole="button"
                  accessibilityState={{ expanded: !collapsed }}
                  accessibilityLabel={`${collapsed ? "Expand" : "Collapse"} ${group.dayTitle ? `${group.dayTitle} ` : ""}${group.mealTitle}`}
                  style={({ pressed }) => [
                    styles.mealPlanRow,
                    pressed && styles.mealPlanRowPressed,
                  ]}
                >
                  <View style={styles.mealPlanDaySlot}>
                    {group.dayTitle ? (
                      <Text style={styles.mealPlanDay}>{group.dayTitle}</Text>
                    ) : (
                      <MaterialCommunityIcons
                        name="plus-circle-outline"
                        size={24}
                        color={theme.color.accent}
                      />
                    )}
                  </View>
                  <View style={styles.mealPlanMeal}>
                    {group.mealEmoji ? (
                      <MealEmoji value={group.mealEmoji} size={28} />
                    ) : null}
                    <Text
                      style={styles.mealPlanTitle}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {group.mealTitle}
                    </Text>
                  </View>
                  <MealProgressIndicator
                    checked={checkedCount}
                    total={group.items.length}
                    theme={theme}
                    styles={styles}
                  />
                  <MaterialCommunityIcons
                    name={collapsed ? "chevron-right" : "chevron-down"}
                    size={28}
                    color={theme.color.subtleInk}
                  />
                </Pressable>
                {!collapsed ? (
                  <View style={styles.group}>
                    {group.dayTitle && group.items.length > 0 ? (
                      <Text style={styles.shoppingSectionLabel}>NEED TO BUY · {group.items.length}</Text>
                    ) : null}
                    {group.items.map(renderItem)}
                    {group.dayTitle && group.pantryItems.length > 0 ? (
                      <View style={styles.pantrySection}>
                        <Pressable
                          onPress={() => setExpandedPantryGroups((current) => ({ ...current, [groupKey]: !current[groupKey] }))}
                          accessibilityRole="button"
                          accessibilityState={{ expanded: Boolean(expandedPantryGroups[groupKey]) }}
                          style={({ pressed }) => [styles.pantryHeader, pressed && styles.categoryHeaderPressed]}
                        >
                          <Text style={styles.pantryTitle}>CHECK YOUR PANTRY · {group.pantryItems.length}</Text>
                          <MaterialCommunityIcons name={expandedPantryGroups[groupKey] ? "chevron-down" : "chevron-right"} size={20} color={theme.color.subtleInk} />
                        </Pressable>
                        {expandedPantryGroups[groupKey] ? group.pantryItems.map((item) => renderPantryReminder(item)) : null}
                      </View>
                    ) : null}
                    {!group.dayTitle ? (
                      isAddingManualItem ? (
                        <View style={styles.inlineAddEditor}>
                          <View style={styles.inlineInputRow}>
                            <MaterialCommunityIcons
                              name="checkbox-blank-circle-outline"
                              size={20}
                              color={theme.color.subtleInk}
                            />
                            <TextInput
                              autoFocus
                              autoCapitalize="words"
                              value={manualInput}
                              onChangeText={setManualInput}
                              onFocus={() => {
                                setTimeout(() => {
                                  contentScrollRef.current?.scrollToEnd({
                                    animated: true,
                                  });
                                }, 180);
                              }}
                              onSubmitEditing={() => handleAddManualItem(true)}
                              placeholder="Grocery item..."
                              placeholderTextColor={theme.color.subtleInk}
                              returnKeyType="next"
                              blurOnSubmit={false}
                              style={styles.inlineManualInput}
                            />
                          </View>
                          <View style={styles.inlineAddActions}>
                            <Pressable
                              disabled={!manualInput.trim()}
                              onPress={() => handleAddManualItem(true)}
                              accessibilityRole="button"
                              accessibilityLabel="Add grocery item"
                              style={styles.inlineTextButton}
                            >
                              <Text
                                style={[
                                  styles.inlineAddText,
                                  !manualInput.trim() &&
                                    styles.inlineAddTextDisabled,
                                ]}
                              >
                                Add
                              </Text>
                            </Pressable>
                            <Pressable
                              onPress={() => {
                                LayoutAnimation.configureNext(
                                  LayoutAnimation.Presets.easeInEaseOut,
                                );
                                setManualInput("");
                                setAddingManualItem(false);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel="Done adding grocery items"
                              style={styles.inlineTextButton}
                            >
                              <Text style={styles.inlineAddText}>Done</Text>
                            </Pressable>
                          </View>
                        </View>
                      ) : (
                        <Pressable
                          onPress={() => {
                            LayoutAnimation.configureNext(
                              LayoutAnimation.Presets.easeInEaseOut,
                            );
                            setAddingManualItem(true);
                          }}
                          accessibilityRole="button"
                          accessibilityLabel="Add grocery item"
                          style={({ pressed }) => [
                            styles.inlineAddRow,
                            pressed && styles.itemRowPressed,
                          ]}
                        >
                          <MaterialCommunityIcons
                            name="plus"
                            size={20}
                            color={theme.color.accent}
                          />
                          <Text style={styles.inlineAddRowText}>Add Item</Text>
                        </Pressable>
                      )
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <>
          {itemsByCategory.map((group) => {
            const collapsed = collapsedCategoryGroups[group.category] ?? false;
            const checkedCount = group.items.filter((entry) =>
              entry.itemIds.every((id) => checkedSet.has(id)),
            ).length;
            return (
              <View key={group.category} style={styles.group}>
                <Pressable
                  onPress={() =>
                    setCollapsedCategoryGroups((current) => ({
                      ...current,
                      [group.category]: !collapsed,
                    }))
                  }
                  accessibilityRole="button"
                  accessibilityState={{ expanded: !collapsed }}
                  accessibilityLabel={`${collapsed ? "Expand" : "Collapse"} ${group.title}`}
                  style={({ pressed }) => [
                    styles.categoryHeader,
                    pressed && styles.categoryHeaderPressed,
                  ]}
                >
                  <Text style={styles.categoryTitle}>{group.title}</Text>
                  <MealProgressIndicator
                    checked={checkedCount}
                    total={group.items.length}
                    theme={theme}
                    styles={styles}
                  />
                  <MaterialCommunityIcons
                    name={collapsed ? "chevron-right" : "chevron-down"}
                    size={22}
                    color={theme.color.subtleInk}
                  />
                </Pressable>
                {!collapsed ? group.items.map(renderCategoryItem) : null}
              </View>
            );
          })}
          {pantryEntries.size > 0 ? (
            <View style={styles.pantrySection}>
              <Pressable onPress={() => setCategoryPantryExpanded((current) => !current)} accessibilityRole="button" accessibilityState={{ expanded: isCategoryPantryExpanded }} style={({ pressed }) => [styles.pantryHeader, pressed && styles.categoryHeaderPressed]}>
                <Text style={styles.pantryTitle}>CHECK YOUR PANTRY · {pantryEntries.size}</Text>
                <MaterialCommunityIcons name={isCategoryPantryExpanded ? "chevron-down" : "chevron-right"} size={20} color={theme.color.subtleInk} />
              </Pressable>
              {isCategoryPantryExpanded ? Array.from(pantryEntries.values()).map((entry) => renderPantryReminder(entry.item, true)) : null}
            </View>
          ) : null}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );

  if (!useSafeArea) {
    return content;
  }

  return (
    <SafeAreaView style={styles.sheet} edges={["top", "bottom"]}>
      {content}
    </SafeAreaView>
  );
}

export default function GroceryListSheet({
  visible,
  weekId,
  days,
  onDismiss,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      visible={visible}
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <GroceryListContent
          weekId={weekId}
          days={days}
          isActive={visible}
          onDismiss={onDismiss}
        />
      </View>
    </Modal>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: theme.color.surface,
    },
    sheet: {
      flex: 1,
      backgroundColor: theme.color.surface,
    },
    sheetContent: {
      flex: 1,
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space.xl,
      paddingBottom: theme.space.lg,
      gap: theme.space.lg,
    },
    inlineContent: {
      flex: 1,
      gap: theme.space.lg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.space.md,
    },
    title: {
      color: theme.color.ink,
      fontSize: theme.type.size.h1,
      fontWeight: theme.type.weight.bold,
    },
    subtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
    },
    closeButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
    },
    groceryTabs: {
      flexDirection: "row",
      position: "relative",
    },
    groceryTabButton: {
      paddingBottom: theme.space.lg,
      marginLeft: theme.space.lg,
    },
    groceryTabButtonPressed: {
      opacity: 0.8,
    },
    groceryTabLabel: {
      fontSize: theme.type.size.title,
      color: theme.color.ink,
      fontWeight: theme.type.weight.medium,
    },
    tabIndicator: {
      position: "absolute",
      height: theme.component.tabs.underlineHeight,
      backgroundColor: theme.color.accent,
      bottom: 0,
      borderRadius: theme.radius.full,
      zIndex: 1,
    },
    tabUnderline: {
      position: "absolute",
      left: theme.space.lg,
      right: theme.space.lg,
      bottom: 0,
      height: theme.component.tabs.underlineHeight,
      backgroundColor: theme.color.cardOutline,
      borderRadius: theme.radius.full,
      zIndex: 0,
    },
    manualRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    manualInput: {
      flex: 1,
      minHeight: 48,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.md,
      color: theme.color.ink,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    inlineAddEditor: {
      gap: theme.space.sm,
      paddingTop: theme.space.xs,
    },
    inlineInputRow: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      paddingHorizontal: theme.space.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    inlineManualInput: {
      flex: 1,
      minHeight: 46,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    inlineAddActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: theme.space.lg,
      paddingHorizontal: theme.space.xs,
    },
    inlineTextButton: {
      minHeight: 36,
      justifyContent: "center",
      paddingHorizontal: theme.space.xs,
    },
    inlineAddText: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    inlineAddTextDisabled: {
      color: theme.color.subtleInk,
      opacity: 0.45,
    },
    inlineAddRow: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      paddingHorizontal: theme.space.sm,
      borderRadius: theme.radius.sm,
    },
    inlineAddRowText: {
      color: theme.color.accent,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    manualButton: {
      minHeight: 48,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.space.md,
      backgroundColor: theme.color.accent,
    },
    manualButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    content: {
      flex: 1,
    },
    contentInner: {
      gap: theme.space.sm,
      paddingBottom: theme.space.xl,
    },
    mealGroup: {
      gap: theme.space.sm,
    },
    mealPlanRow: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    mealPlanRowPressed: {
      opacity: 0.82,
      borderColor: theme.color.cardOutline,
    },
    mealPlanDaySlot: {
      width: 52,
      alignItems: "flex-start",
      justifyContent: "center",
    },
    mealPlanDay: {
      color: theme.color.accent,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    mealPlanMeal: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    mealPlanEmoji: {
      width: 34,
      textAlign: "center",
      fontSize: 24,
    },
    mealPlanTitle: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    mealProgress: {
      minWidth: 38,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
    },
    mealProgressCheck: {
      overflow: "hidden",
      alignItems: "flex-start",
    },
    mealProgressCheckText: {
      color: theme.color.success,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    mealProgressText: {
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      fontVariant: ["tabular-nums"],
    },
    group: {
      gap: theme.space.sm,
      padding: theme.space.md,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
    },
    shoppingSectionLabel: {
      color: theme.color.ink,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.bold,
      letterSpacing: 0.8,
    },
    pantrySection: {
      gap: theme.space.xs,
      marginTop: theme.space.xs,
      paddingTop: theme.space.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border,
    },
    pantryHeader: {
      minHeight: 34,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.space.sm,
      borderRadius: theme.radius.sm,
    },
    pantryTitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.bold,
      letterSpacing: 0.8,
    },
    pantryRow: {
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.space.sm,
      paddingHorizontal: theme.space.sm,
      paddingVertical: theme.space.xs,
    },
    pantryItemText: { color: theme.color.ink, fontSize: theme.type.size.sm },
    pantryItemAdded: { color: theme.color.subtleInk },
    pantryAction: { flexDirection: "row", alignItems: "center", gap: 2 },
    pantryActionText: { color: theme.color.accent, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold },
    pantryActionAdded: { color: theme.color.success },
    categoryTitle: {
      flex: 1,
      color: theme.color.accent,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    categoryHeader: {
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      paddingHorizontal: theme.space.sm,
      borderRadius: theme.radius.sm,
    },
    categoryHeaderPressed: {
      opacity: 0.8,
      backgroundColor: theme.color.focus,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      paddingVertical: theme.space.xs,
    },
    itemRowPressed: {
      opacity: 0.8,
    },
    itemText: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    itemTextChecked: {
      color: theme.color.subtleInk,
      textDecorationLine: "line-through",
    },
    swipeRoot: {
      backgroundColor: theme.color.surfaceAlt,
    },
    deleteAction: {
      minWidth: 92,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.xs,
      paddingHorizontal: theme.space.md,
      borderRadius: theme.radius.sm,
      backgroundColor: theme.color.danger,
    },
    deleteActionPressed: {
      opacity: 0.82,
    },
    deleteActionText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    itemTextStack: {
      flex: 1,
      gap: 1,
    },
    categoryItemText: {
      flex: 0,
    },
    sharedMealCount: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    sharedMealNames: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      lineHeight: theme.type.size.xs * 1.25,
    },
    sharedMealNamesChecked: {
      opacity: 0.6,
    },
    emptyCard: {
      gap: theme.space.xs,
      padding: theme.space.lg,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surfaceAlt,
    },
    emptyTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    emptyText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      lineHeight: theme.type.size.sm * 1.35,
    },
  });
