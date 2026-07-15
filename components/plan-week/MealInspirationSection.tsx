import { ReactNode, useMemo, useRef } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import {
  CurrentPlannedWeek,
  PLANNED_WEEK_LABELS,
  PLANNED_WEEK_DISPLAY_NAMES,
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
  plannedWeek: CurrentPlannedWeek;
  selectedMealId?: Meal["id"] | null;
  activePoolId?: MealPoolId;
  onActivePoolChange?: (poolId: MealPoolId) => void;
  onSelectMeal: (meal: Meal, poolId: MealPoolId) => void;
  onSelectDay: (day: PlannedWeekDayKey) => void;
  onRemoveSuggestedMeal?: (mealId: Meal["id"]) => void;
  beforeActivePoolContent?: ReactNode;
};

const SWIPE_THRESHOLD = 36;

export default function MealInspirationSection({
  pools,
  orderedDays,
  plannedWeek,
  selectedMealId,
  activePoolId,
  onActivePoolChange,
  onSelectMeal,
  onSelectDay,
  onRemoveSuggestedMeal,
  beforeActivePoolContent,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const transition = useRef(new Animated.Value(1)).current;
  const isChipScrollActiveRef = useRef(false);

  const visiblePools = pools;
  const activeIndex = Math.max(
    0,
    visiblePools.findIndex((pool) => pool.id === activePoolId),
  );
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
    const nextPool = visiblePools[index];
    if (!nextPool) {
      return;
    }
    onActivePoolChange?.(nextPool.id);
    animateIn();
  };

  const advancePool = () => {
    setPoolIndex((activeIndex + 1) % visiblePools.length);
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          !isChipScrollActiveRef.current &&
          Math.abs(gesture.dx) > 14 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy),
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

      {beforeActivePoolContent}

      <View style={styles.card}>
        <Animated.View style={[styles.headerCopy, contentStyle]}>
          <Text style={styles.title}>{activePool.title}</Text>
          <Text style={styles.subtitle}>{activePool.subtitle}</Text>
        </Animated.View>

        <Animated.View style={[styles.content, contentStyle]}>
          {activePool.meals.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroller}
              contentContainerStyle={styles.chipList}
              onTouchStart={() => {
                isChipScrollActiveRef.current = true;
              }}
              onTouchEnd={() => {
                isChipScrollActiveRef.current = false;
              }}
              onMomentumScrollEnd={() => {
                isChipScrollActiveRef.current = false;
              }}
            >
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
            </ScrollView>
          ) : (
            <Text style={styles.emptyText}>{activePool.emptyText}</Text>
          )}
        </Animated.View>

        {selectedMeal ? (
          <View style={styles.dayPicker}>
            <View style={styles.dayPickerHeaderRow}>
              <View style={styles.dayPickerIcon}>
                <MaterialCommunityIcons
                  name="calendar-plus"
                  size={24}
                  color={theme.color.accent}
                />
              </View>
              <Text style={styles.dayPickerTitle}>Add to your plan</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.dayScroller}
              contentContainerStyle={styles.dayList}
              onTouchStart={() => {
                isChipScrollActiveRef.current = true;
              }}
              onTouchEnd={() => {
                isChipScrollActiveRef.current = false;
              }}
              onMomentumScrollEnd={() => {
                isChipScrollActiveRef.current = false;
              }}
            >
              {orderedDays.map((day) => {
                const isPlanned = Boolean(plannedWeek[day]);
                const statusLabel = isPlanned ? "planned" : "not planned";
                return (
                  <Pressable
                    key={day}
                    accessibilityRole="button"
                    accessibilityLabel={`${PLANNED_WEEK_DISPLAY_NAMES[day]}, ${statusLabel}`}
                    onPress={() => onSelectDay(day)}
                    style={({ pressed }) => [
                      styles.dayChip,
                      isPlanned && styles.dayChipPlanned,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        isPlanned && styles.dayChipTextPlanned,
                      ]}
                    >
                      {PLANNED_WEEK_LABELS[day]}
                    </Text>
                    {isPlanned ? (
                      <MaterialCommunityIcons
                        name="check"
                        size={16}
                        color={theme.color.subtleInk}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
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
    chipScroller: {
      maxWidth: "100%",
    },
    chipList: {
      flexDirection: "row",
      gap: theme.space.sm,
      paddingRight: theme.space.xs,
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
      flexDirection: "column",
      gap: theme.space.md,
    },
    dayPickerHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
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
    dayPickerTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    dayScroller: {
      maxWidth: "100%",
    },
    dayList: {
      flexDirection: "row",
      gap: theme.space.md,
      paddingLeft: theme.space.xs,
      paddingRight: theme.space.xs,
    },
    dayChip: {
      width: 64,
      minHeight: 54,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.bg,
      borderWidth: 1,
      borderColor: theme.color.accent,
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
    },
    dayChipPlanned: {
      backgroundColor: theme.mode === "dark" ? "#222229" : theme.color.surface,
      borderColor: theme.color.border,
    },
    dayChipText: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    dayChipTextPlanned: {
      color: theme.color.subtleInk,
    },
    pressed: {
      opacity: 0.82,
    },
  });
