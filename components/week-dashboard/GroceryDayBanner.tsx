import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { getGroceryListForWeek, reconcileGroceryList, setGroceryListForWeek } from "../../stores/groceryListStorage";
import { alpha, WeeklyTheme } from "../../styles/theme";
import { WeekPlanDay } from "../../hooks/useCurrentWeekPlan";
import { buildItemsFromPlan } from "./GroceryListSheet";

type Props = { weekId: string; days: WeekPlanDay[]; dinnerCount: number; onPress: () => void };

export default function GroceryDayBanner({ weekId, days, dinnerCount, onPress }: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [summary, setSummary] = useState({ itemCount: 0, isComplete: false });
  const entrance = useRef(new Animated.Value(0)).current;

  const refresh = useCallback(async () => {
    const stored = await getGroceryListForWeek(weekId);
    const list = reconcileGroceryList(weekId, buildItemsFromPlan(days), stored);
    await setGroceryListForWeek(weekId, list);
    const promoted = new Set(list.promotedPantryItems);
    const items = [
      ...list.items.filter((item) => item.ingredientType !== "pantryStaple" || promoted.has(item.id)),
      ...list.manualItems,
    ];
    const checked = new Set(list.checkedItems);
    const mergedItems = new Map<string, string[]>();
    items.forEach((item) => {
      const key = item.name.trim().toLocaleLowerCase();
      mergedItems.set(key, [...(mergedItems.get(key) ?? []), item.id]);
    });
    const remainingItemCount = Array.from(mergedItems.values()).filter(
      (itemIds) => !itemIds.every((id) => checked.has(id)),
    ).length;
    setSummary({
      itemCount: remainingItemCount,
      isComplete: mergedItems.size > 0 && remainingItemCount === 0,
    });
  }, [days, weekId]);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [entrance]);

  const countLabel = `${summary.itemCount} ${summary.itemCount === 1 ? "item" : "items"} · ${dinnerCount} ${dinnerCount === 1 ? "dinner" : "dinners"}`;
  return (
    <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }) }] }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={summary.isComplete ? "Shopping done. Open grocery list" : `Grocery day. ${countLabel}`} style={({ pressed }) => [styles.banner, summary.isComplete && styles.completeBanner, pressed && styles.pressed]}>
        <View style={[styles.iconWrap, summary.isComplete && styles.completeIconWrap]}>
          <MaterialCommunityIcons name={summary.isComplete ? "check" : "cart-outline"} size={34} color={summary.isComplete ? theme.color.success : theme.color.accent} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.eyebrow, summary.isComplete && styles.completeEyebrow]}>{summary.isComplete ? "SHOPPING DONE" : "GROCERY DAY"}</Text>
          <Text style={styles.title}>{summary.isComplete ? "You’re all set for the week." : "Your list is ready!"}</Text>
          {!summary.isComplete ? <Text style={styles.meta}>{countLabel}</Text> : null}
        </View>
        {!summary.isComplete ? <MaterialCommunityIcons name="chevron-right" size={28} color={theme.color.accent} /> : null}
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  banner: { minHeight: 104, flexDirection: "row", alignItems: "center", gap: theme.space.md, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: alpha(theme.color.accent, 0.7), backgroundColor: theme.color.surface, paddingHorizontal: theme.space.lg, paddingVertical: theme.space.md },
  completeBanner: { borderColor: alpha(theme.color.success, 0.55), backgroundColor: alpha(theme.color.success, 0.08) },
  iconWrap: { width: 52, height: 52, borderRadius: theme.radius.md, alignItems: "center", justifyContent: "center", backgroundColor: alpha(theme.color.accent, 0.1) },
  completeIconWrap: { backgroundColor: alpha(theme.color.success, 0.1) },
  copy: { flex: 1, gap: 2 },
  eyebrow: { color: theme.color.accent, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold, letterSpacing: 0.9 },
  completeEyebrow: { color: theme.color.success },
  title: { color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  meta: { color: theme.color.subtleInk, fontSize: theme.type.size.sm },
  pressed: { opacity: 0.78 },
});
