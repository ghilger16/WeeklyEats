import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import {
  GroceryCategory,
  GroceryList,
  GroceryListItem,
  GroceryListViewMode,
} from "../../types/groceryList";
import { WeekPlanDay } from "../../hooks/useCurrentWeekPlan";
import {
  createGroceryList,
  getGroceryListForWeek,
  getGroceryListViewMode,
  setGroceryListForWeek,
  setGroceryListViewMode,
} from "../../stores/groceryListStorage";

type Props = {
  visible: boolean;
  weekId: string;
  days: WeekPlanDay[];
  onDismiss: () => void;
};

type RawIngredient = string | { name?: unknown; category?: unknown };

const categoryOrder: GroceryCategory[] = [
  "produce",
  "meat",
  "dairy",
  "pantry",
  "frozen",
  "bakery",
  "beverages",
  "other",
];

const categoryLabel: Record<GroceryCategory, string> = {
  produce: "Produce",
  meat: "Meat",
  dairy: "Dairy",
  pantry: "Pantry",
  frozen: "Frozen",
  bakery: "Bakery",
  beverages: "Beverages",
  other: "Other",
};

const normalizeCategory = (value: unknown): GroceryCategory => {
  if (typeof value !== "string") {
    return "other";
  }
  return categoryOrder.includes(value as GroceryCategory)
    ? (value as GroceryCategory)
    : "other";
};

const normalizeIngredient = (
  ingredient: RawIngredient,
): { name: string; category: GroceryCategory } | null => {
  if (typeof ingredient === "string") {
    const name = ingredient.trim();
    return name ? { name, category: "other" } : null;
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
  };
};

const buildItemsFromPlan = (days: WeekPlanDay[]): GroceryListItem[] => {
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

export default function GroceryListSheet({
  visible,
  weekId,
  days,
  onDismiss,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [list, setList] = useState<GroceryList | null>(null);
  const [viewMode, setViewMode] = useState<GroceryListViewMode>("meal");
  const [manualInput, setManualInput] = useState("");

  useEffect(() => {
    if (!visible) {
      return;
    }
    let cancelled = false;
    Promise.all([getGroceryListForWeek(weekId), getGroceryListViewMode()]).then(
      async ([storedList, storedMode]) => {
        if (cancelled) {
          return;
        }
        setViewMode(storedMode);
        if (storedList) {
          setList(storedList);
          return;
        }
        const generated = createGroceryList(weekId, buildItemsFromPlan(days));
        await setGroceryListForWeek(weekId, generated);
        if (!cancelled) {
          setList(generated);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [days, visible, weekId]);

  const allItems = useMemo(
    () => [...(list?.items ?? []), ...(list?.manualItems ?? [])],
    [list],
  );
  const checkedSet = useMemo(
    () => new Set(list?.checkedItems ?? []),
    [list?.checkedItems],
  );

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

  const handleAddManualItem = () => {
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
    setManualInput("");
    persistList({
      ...list,
      manualItems: [...list.manualItems, item],
    });
  };

  const renderItem = (item: GroceryListItem) => {
    const checked = checkedSet.has(item.id);
    return (
      <Pressable
        key={item.id}
        onPress={() => toggleItem(item.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`${checked ? "Checked" : "Unchecked"} ${item.name}`}
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
        <Text style={[styles.itemText, checked && styles.itemTextChecked]}>
          {item.name}
        </Text>
      </Pressable>
    );
  };

  const itemsByMeal = useMemo(() => {
    const groups = new Map<
      string,
      { dayTitle: string; mealTitle: string; items: GroceryListItem[] }
    >();
    allItems.forEach((item) => {
      const key =
        item.source === "manual" ? "manual" : `${item.dayKey}-${item.mealId}`;
      const group =
        groups.get(key) ??
        (item.source === "manual"
          ? { dayTitle: "", mealTitle: "Manual Items", items: [] }
          : {
              dayTitle: item.dayName ?? item.dayLabel ?? "",
              mealTitle:
                `${item.mealEmoji ?? ""} ${item.mealTitle ?? ""}`.trim(),
              items: [],
            });
      group.items.push(item);
      groups.set(key, group);
    });
    return Array.from(groups.values());
  }, [allItems]);

  const itemsByCategory = useMemo(
    () =>
      categoryOrder
        .map((category) => ({
          category,
          title: categoryLabel[category],
          items: allItems.filter((item) => item.category === category),
        }))
        .filter((group) => group.items.length > 0),
    [allItems],
  );

  return (
    <Modal
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      visible={visible}
      onRequestClose={onDismiss}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet} edges={["top", "bottom"]}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Grocery List</Text>
              <Text style={styles.subtitle}>
                Ingredients from your meal plan
              </Text>
            </View>
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
          </View>

          <View style={styles.segmentedControl}>
            {(["meal", "category"] as GroceryListViewMode[]).map((mode) => {
              const selected = viewMode === mode;
              return (
                <Pressable
                  key={mode}
                  onPress={() => handleViewModeChange(mode)}
                  style={[styles.segment, selected && styles.segmentSelected]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      selected && styles.segmentTextSelected,
                    ]}
                  >
                    {mode === "meal" ? "By Meal" : "By Category"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.manualRow}>
            <TextInput
              value={manualInput}
              onChangeText={setManualInput}
              onSubmitEditing={handleAddManualItem}
              placeholder="+ Add Item"
              placeholderTextColor={theme.color.subtleInk}
              returnKeyType="done"
              style={styles.manualInput}
            />
            <Pressable
              onPress={handleAddManualItem}
              style={styles.manualButton}
              accessibilityRole="button"
              accessibilityLabel="Add grocery item"
            >
              <Text style={styles.manualButtonText}>Add</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.content}
            contentContainerStyle={styles.contentInner}
            keyboardShouldPersistTaps="handled"
          >
            {allItems.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No ingredients yet</Text>
                <Text style={styles.emptyText}>
                  Add ingredients to saved meals or add manual items here.
                </Text>
              </View>
            ) : viewMode === "meal" ? (
              itemsByMeal.map((group) => (
                <View
                  key={`${group.dayTitle}-${group.mealTitle}`}
                  style={styles.mealGroup}
                >
                  {group.dayTitle ? (
                    <Text style={styles.mealGroupDay}>{group.dayTitle}</Text>
                  ) : null}
                  <Text style={styles.mealGroupMeal}>{group.mealTitle}</Text>
                  <View style={styles.group}>
                    {group.items.map(renderItem)}
                  </View>
                </View>
              ))
            ) : (
              itemsByCategory.map((group) => (
                <View key={group.category} style={styles.group}>
                  <Text style={styles.groupTitle}>{group.title}</Text>
                  {group.items.map(renderItem)}
                </View>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
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
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space.xl,
      paddingBottom: theme.space.lg,
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
    segmentedControl: {
      flexDirection: "row",
      padding: 4,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    segment: {
      flex: 1,
      minHeight: 40,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentSelected: {
      backgroundColor: theme.color.accent,
    },
    segmentText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    segmentTextSelected: {
      color: theme.color.ink,
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
      gap: theme.space.lg,
      paddingBottom: theme.space.xl,
    },
    mealGroup: {
      gap: theme.space.sm,
      marginTop: theme.space.xs,
      marginBottom: theme.space.md,
    },
    mealGroupDay: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    mealGroupMeal: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    group: {
      gap: theme.space.sm,
      padding: theme.space.md,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
    },
    groupTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
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
