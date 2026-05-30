import { useMemo, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import {
  PLANNED_WEEK_LABELS,
  PlannedWeekDayKey,
} from "../../types/weekPlan";
import { Meal } from "../../types/meals";

export type MealPoolId = "suggestedByYou" | "freezerMeals" | "familyStars";

export type MealPool = {
  id: MealPoolId;
  title: string;
  subtitle: string;
  nextIcon: string;
  chipIcon?: string;
  emptyText: string;
  meals: Meal[];
};

type Props = {
  pools: MealPool[];
  orderedDays: PlannedWeekDayKey[];
  selectedMealId?: Meal["id"] | null;
  onSelectMeal: (meal: Meal, poolId: MealPoolId) => void;
  onSelectDay: (day: PlannedWeekDayKey) => void;
  onRemoveSuggestedMeal?: (mealId: Meal["id"]) => void;
};

const SWIPE_THRESHOLD = 36;

export default function MealInspirationSection({
  pools,
  orderedDays,
  selectedMealId,
  onSelectMeal,
  onSelectDay,
  onRemoveSuggestedMeal,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [activeIndex, setActiveIndex] = useState(0);
  const transition = useRef(new Animated.Value(1)).current;

  const visiblePools = pools;
  const activePool = visiblePools[activeIndex % Math.max(visiblePools.length, 1)];
  const selectedMeal = activePool?.meals.find(
    (meal) => meal.id === selectedMealId,
  );

  const animateIn = () => {
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: theme.motion.duration.normal,
      useNativeDriver: true,
    }).start();
  };

  const setPoolIndex = (index: number) => {
    if (visiblePools.length <= 1) {
      return;
    }
    setActiveIndex(index);
    animateIn();
  };

  const advancePool = () => {
    setPoolIndex((activeIndex + 1) % visiblePools.length);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 14 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          if (Math.abs(gesture.dx) >= SWIPE_THRESHOLD) {
            advancePool();
          }
        },
      }),
    [advancePool],
  );

  if (!activePool) {
    return null;
  }

  const contentStyle = {
    opacity: transition,
    transform: [
      {
        translateX: transition.interpolate({
          inputRange: [0, 1],
          outputRange: [18, 0],
        }),
      },
    ],
  };

  return (
    <View style={styles.wrap} {...panResponder.panHandlers}>
      <View style={styles.tabs}>
        {visiblePools.map((pool, index) => {
          const isActive = pool.id === activePool.id;
          return (
            <Pressable
              key={pool.id}
              accessibilityRole="button"
              accessibilityLabel={`Show ${pool.title}`}
              onPress={() => setPoolIndex(index)}
              style={({ pressed }) => [
                styles.tab,
                isActive && styles.tabActive,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.tabIcon, isActive && styles.tabIconActive]}>
                {getPoolIcon(pool.id)}
              </Text>
              <Text
                style={[styles.tabText, isActive && styles.tabTextActive]}
                numberOfLines={1}
              >
                {getPoolTabLabel(pool.id)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.card}>
        <Animated.View style={[styles.headerCopy, contentStyle]}>
          <Text style={styles.title}>{activePool.title}</Text>
          <Text style={styles.subtitle}>{activePool.subtitle}</Text>
        </Animated.View>

        <Animated.View style={[styles.content, contentStyle]}>
          {activePool.meals.length ? (
            <View style={styles.chipList}>
              {activePool.meals.slice(0, 3).map((meal) => {
                const isSelected = meal.id === selectedMealId;
                return (
                  <View
                    key={meal.id}
                    style={[
                      styles.chipShell,
                      isSelected && styles.chipShellSelected,
                    ]}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Plan ${meal.title}`}
                      onPress={() => onSelectMeal(meal, activePool.id)}
                      style={({ pressed }) => [
                        styles.mealChip,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.emoji}>
                        {activePool.chipIcon ?? meal.emoji ?? "🍽️"}
                      </Text>
                      <Text style={styles.chipTitle} numberOfLines={1}>
                        {meal.title}
                      </Text>
                    </Pressable>
                    {activePool.id === "suggestedByYou" &&
                    onRemoveSuggestedMeal ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${meal.title} from Suggested by You`}
                        onPress={() => onRemoveSuggestedMeal(meal.id)}
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.removeButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.removeText}>×</Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>{activePool.emptyText}</Text>
          )}
        </Animated.View>

        {selectedMeal ? (
          <View style={styles.dayPicker}>
            <View style={styles.dayPickerIcon}>
              <MaterialCommunityIcons
                name="calendar-plus"
                size={24}
                color={theme.color.accent}
              />
            </View>
            <View style={styles.dayPickerCopy}>
              <Text style={styles.dayPickerTitle}>Add to your plan</Text>
              <Text style={styles.dayPickerSubtitle}>
                Choose a day to plan {selectedMeal.title}.
              </Text>
              <View style={styles.dayList}>
                {orderedDays.map((day) => (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityLabel={`Plan ${selectedMeal.title} for ${PLANNED_WEEK_LABELS[day]}`}
                    onPress={() => onSelectDay(day)}
                    style={({ pressed }) => [
                      styles.dayChip,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.dayChipText}>
                      {PLANNED_WEEK_LABELS[day]}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const getPoolIcon = (poolId: MealPoolId) => {
  if (poolId === "suggestedByYou") return "💡";
  if (poolId === "freezerMeals") return "❄️";
  return "⭐";
};

const getPoolTabLabel = (poolId: MealPoolId) => {
  if (poolId === "suggestedByYou") return "Suggested";
  if (poolId === "freezerMeals") return "Freezer";
  return "Stars";
};

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    wrap: {
      gap: theme.space.sm,
    },
    tabs: {
      minHeight: 58,
      flexDirection: "row",
      borderRadius: theme.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surface,
      overflow: "hidden",
      padding: 2,
      gap: 2,
    },
    tab: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.xs,
      paddingHorizontal: theme.space.sm,
      backgroundColor: "transparent",
      borderRadius: theme.radius.lg,
    },
    tabActive: {
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255, 75, 145, 0.12)"
          : "rgba(255, 75, 145, 0.08)",
    },
    tabIcon: {
      fontSize: 19,
      opacity: 0.8,
    },
    tabIconActive: {
      opacity: 1,
    },
    tabText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      flexShrink: 1,
    },
    tabTextActive: {
      color: theme.color.accent,
    },
    card: {
      borderRadius: theme.radius.xl,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.accent,
      padding: theme.space.lg,
      gap: theme.space.sm,
    },
    headerCopy: {
      gap: theme.space.xs / 2,
    },
    title: {
      color: theme.color.accent,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    subtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    content: {
      minHeight: 38,
      justifyContent: "center",
    },
    chipList: {
      flexDirection: "row",
      flexWrap: "nowrap",
      gap: theme.space.sm,
    },
    chipShell: {
      minHeight: 38,
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      flexDirection: "row",
      alignItems: "center",
      overflow: "hidden",
    },
    chipShellSelected: {
      borderColor: theme.color.accent,
    },
    mealChip: {
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
      paddingLeft: theme.space.sm,
      paddingRight: theme.space.sm,
    },
    emoji: {
      fontSize: 20,
    },
    chipTitle: {
      maxWidth: 128,
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    emptyText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    removeButton: {
      width: 28,
      minHeight: 38,
      alignItems: "center",
      justifyContent: "center",
      paddingRight: theme.space.xs,
    },
    removeText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    dayPicker: {
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      padding: theme.space.md,
      flexDirection: "row",
      gap: theme.space.md,
      alignItems: "flex-start",
    },
    dayPickerIcon: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255, 75, 145, 0.10)"
          : "rgba(255, 75, 145, 0.08)",
    },
    dayPickerCopy: {
      flex: 1,
      gap: theme.space.xs,
    },
    dayPickerTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    dayPickerSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      lineHeight: theme.type.size.sm * 1.35,
    },
    dayList: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.xs,
    },
    dayChip: {
      minHeight: 30,
      paddingHorizontal: theme.space.sm,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.bg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      alignItems: "center",
      justifyContent: "center",
    },
    dayChipText: {
      color: theme.color.accent,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.bold,
    },
    pressed: {
      opacity: 0.82,
    },
  });
