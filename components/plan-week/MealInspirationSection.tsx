import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ReactNode, useMemo, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import {
  CurrentPlannedWeek,
  PLANNED_WEEK_DISPLAY_NAMES,
  PlannedWeekDayKey,
} from "../../types/weekPlan";
import { Meal } from "../../types/meals";

export type MealPoolId =
  | "beenAwhile"
  | "familyStars"
  | "freezerMeals"
  | "easy"
  | "budget";

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
  onRemoveSuggestedMeal?: (mealId: Meal["id"]) => void;
  getLastServedISO?: (mealId: Meal["id"]) => string | null;
  beforeActivePoolContent?: ReactNode;
};

const SWIPE_THRESHOLD = 36;
const CAROUSEL_GAP = 12;
type DifficultyMode = "easy" | "medium" | "hard";
type ExpenseMode = 1 | 2 | 3;

const DIFFICULTY_MODES: DifficultyMode[] = ["easy", "medium", "hard"];
const EXPENSE_MODES: ExpenseMode[] = [1, 2, 3];

export default function MealInspirationSection({
  pools,
  orderedDays,
  plannedWeek,
  selectedMealId,
  activePoolId,
  onActivePoolChange,
  onSelectMeal,
  onRemoveSuggestedMeal,
  getLastServedISO,
  beforeActivePoolContent,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const transition = useRef(new Animated.Value(1)).current;
  const isChipScrollActiveRef = useRef(false);
  const carouselRef = useRef<ScrollView>(null);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [difficultyMode, setDifficultyMode] =
    useState<DifficultyMode>("easy");
  const [expenseMode, setExpenseMode] = useState<ExpenseMode>(1);

  const visiblePools = pools;
  const activeIndex = Math.max(
    0,
    visiblePools.findIndex((pool) => pool.id === activePoolId),
  );
  const sourceActivePool =
    visiblePools[activeIndex % Math.max(visiblePools.length, 1)];
  const activePool = useMemo(() => {
    if (sourceActivePool.id === "easy") {
      const label = getDifficultyModeLabel(difficultyMode);
      return {
        ...sourceActivePool,
        title: label,
        subtitle: `${label}-difficulty meals.`,
        emptyText: `No ${difficultyMode} meals yet.`,
        meals: sourceActivePool.meals.filter((meal) =>
          matchesDifficultyMode(meal, difficultyMode),
        ),
      };
    }
    if (sourceActivePool.id === "budget") {
      const expenseLabel = "$".repeat(expenseMode);
      return {
        ...sourceActivePool,
        subtitle: `${expenseLabel} meals.`,
        emptyText: `No ${expenseLabel} meals yet.`,
        meals: sourceActivePool.meals.filter(
          (meal) => getExpenseTier(meal) === expenseMode,
        ),
      };
    }
    return sourceActivePool;
  }, [difficultyMode, expenseMode, sourceActivePool]);

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
    setActiveCardIndex(0);
    animateIn();
  };

  const handleTabPress = (index: number, pool: MealPool) => {
    if (pool.id === "easy" && pool.id === activePool.id) {
      const nextIndex =
        (DIFFICULTY_MODES.indexOf(difficultyMode) + 1) %
        DIFFICULTY_MODES.length;
      setDifficultyMode(DIFFICULTY_MODES[nextIndex]);
      setActiveCardIndex(0);
      carouselRef.current?.scrollTo({ x: 0, animated: false });
      animateIn();
      return;
    }
    if (pool.id === "budget" && pool.id === activePool.id) {
      const nextIndex =
        (EXPENSE_MODES.indexOf(expenseMode) + 1) % EXPENSE_MODES.length;
      setExpenseMode(EXPENSE_MODES[nextIndex]);
      setActiveCardIndex(0);
      carouselRef.current?.scrollTo({ x: 0, animated: false });
      animateIn();
      return;
    }
    setPoolIndex(index);
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
  const mealCardWidth = carouselWidth
    ? Math.max(200, carouselWidth * 0.756)
    : 252;
  const snapInterval = mealCardWidth + CAROUSEL_GAP;

  const handleCarouselMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    isChipScrollActiveRef.current = false;
    const nextIndex = Math.max(
      0,
      Math.min(
        activePool.meals.length - 1,
        Math.round(event.nativeEvent.contentOffset.x / snapInterval),
      ),
    );
    setActiveCardIndex(nextIndex);
  };

  return (
    <View style={styles.wrap} {...panResponder.panHandlers}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroller}
        contentContainerStyle={styles.tabs}
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
        {visiblePools.map((pool, index) => {
          const isActive = pool.id === activePool.id;
          return (
            <Pressable
              key={pool.id}
              accessibilityRole="button"
              accessibilityLabel={`${getPoolTabLabel(pool.id, difficultyMode)} tab`}
              accessibilityState={{ selected: isActive }}
              onPress={() => handleTabPress(index, pool)}
              style={({ pressed }) => [
                styles.tab,
                isActive && styles.tabActive,
                pressed && styles.pressed,
              ]}
            >
              {pool.id === "freezerMeals" ? (
                <MaterialCommunityIcons
                  name="snowflake"
                  size={20}
                  color={isActive ? theme.color.ink : theme.color.accent}
                  style={[styles.tabIcon, isActive && styles.tabIconActive]}
                />
              ) : pool.id === "easy" ? (
                <View
                  style={[
                    styles.difficultyDot,
                    {
                      backgroundColor: getDifficultyModeColor(
                        difficultyMode,
                        theme,
                      ),
                    },
                  ]}
                  accessibilityLabel={`${getDifficultyModeLabel(difficultyMode)} difficulty`}
                />
              ) : pool.id === "budget" ? (
                <Text
                  style={styles.expenseText}
                  accessibilityLabel={`${expenseMode} dollar sign${expenseMode === 1 ? "" : "s"} expense`}
                >
                  {"$".repeat(expenseMode)}
                </Text>
              ) : (
                <Text
                  style={[styles.tabIcon, isActive && styles.tabIconActive]}
                >
                  {getPoolIcon(pool.id)}
                </Text>
              )}
              <Text
                style={[styles.tabText, isActive && styles.tabTextActive]}
                numberOfLines={1}
              >
                {getPoolTabLabel(pool.id, difficultyMode)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Animated.View
        style={[styles.carouselSection, contentStyle]}
        onLayout={(event: LayoutChangeEvent) =>
          setCarouselWidth(event.nativeEvent.layout.width)
        }
        accessibilityLabel={`${getPoolTabLabel(activePool.id)} meal carousel, ${activePool.meals.length} meals`}
      >
        {activePool.meals.length ? (
          <>
            <ScrollView
              key={activePool.id}
              ref={carouselRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={snapInterval}
              snapToAlignment="start"
              disableIntervalMomentum
              contentContainerStyle={styles.carouselList}
              onTouchStart={() => {
                isChipScrollActiveRef.current = true;
              }}
              onTouchEnd={() => {
                isChipScrollActiveRef.current = false;
              }}
              onMomentumScrollEnd={handleCarouselMomentumEnd}
            >
              {activePool.meals.map((meal) => {
                const isSelected = meal.id === selectedMealId;
                const plannedDay = orderedDays.find(
                  (day) => plannedWeek[day] === meal.id,
                );
                const difficultyColor = getDifficultyColor(meal, theme);
                const lastServedISO = getLastServedISO?.(meal.id) ?? null;
                return (
                  <Pressable
                    key={meal.id}
                    accessibilityRole="button"
                    accessibilityLabel={getMealAccessibilityLabel(
                      meal,
                      activePool.id,
                      plannedDay,
                      lastServedISO,
                    ) + (isSelected ? ". Selected. Choose a day." : "")}
                    onPress={() => onSelectMeal(meal, activePool.id)}
                    style={({ pressed }) => [
                      styles.carouselCard,
                      { width: mealCardWidth },
                      activePool.id === "familyStars" &&
                        styles.carouselCardFamilyStar,
                      isSelected && styles.carouselCardSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    {isFamilyStarMeal(meal) ||
                    activePool.id === "freezerMeals" ? (
                      <View style={styles.carouselIndicators}>
                        {isFamilyStarMeal(meal) ? (
                          <Text
                            style={styles.carouselFamilyStar}
                            accessibilityLabel="Family Star meal"
                          >
                            ⭐
                          </Text>
                        ) : null}
                        {activePool.id === "freezerMeals" ? (
                          <MaterialCommunityIcons
                            name="snowflake"
                            size={24}
                            color={theme.color.accent}
                            accessibilityLabel="Freezer meal"
                          />
                        ) : null}
                      </View>
                    ) : null}
                    <Text style={styles.carouselEmoji}>
                      {meal.emoji ?? activePool.chipIcon ?? "🍽️"}
                    </Text>
                    <Text style={styles.carouselTitle} numberOfLines={2}>
                      {getMealDisplayTitle(meal)}
                    </Text>
                    <View style={styles.carouselMetadata}>
                      {difficultyColor ? (
                        <View
                          style={[
                            styles.difficultyDot,
                            { backgroundColor: difficultyColor },
                          ]}
                          accessible
                          accessibilityLabel={`${getDifficultyLabel(meal)} difficulty`}
                        />
                      ) : null}
                      <Text
                        style={styles.expenseText}
                        accessibilityLabel={`${getExpenseTier(meal)} dollar signs expense`}
                      >
                        {"$".repeat(getExpenseTier(meal))}
                      </Text>
                    </View>
                    {getMealReason(
                      meal,
                      activePool.id,
                      plannedDay,
                      lastServedISO,
                    ) ? (
                      <Text style={styles.carouselReason} numberOfLines={2}>
                        {getMealReason(
                          meal,
                          activePool.id,
                          plannedDay,
                          lastServedISO,
                        )}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            {activePool.meals.length > 1 ? (
              <View style={styles.pageDots} accessibilityRole="text">
                {activePool.meals.map((meal, index) => (
                  <View
                    key={meal.id}
                    style={[
                      styles.pageDot,
                      index === activeCardIndex && styles.pageDotActive,
                    ]}
                  />
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.carouselEmpty}>
            <Text style={styles.emptyText}>
              {getPoolEmptyText(activePool.id, activePool.emptyText)}
            </Text>
          </View>
        )}
      </Animated.View>

      {beforeActivePoolContent}
    </View>
  );
}

const getPoolIcon = (poolId: MealPoolId) => {
  if (poolId === "beenAwhile") return "🕒";
  if (poolId === "familyStars") return "⭐";
  return "";
};

const getPoolTabLabel = (
  poolId: MealPoolId,
  difficultyMode: DifficultyMode = "easy",
) => {
  if (poolId === "beenAwhile") return "Been Awhile";
  if (poolId === "familyStars") return "Stars";
  if (poolId === "freezerMeals") return "Freezer";
  if (poolId === "easy") return getDifficultyModeLabel(difficultyMode);
  return "Expense";
};

const getDifficultyModeLabel = (mode: DifficultyMode) =>
  mode.charAt(0).toUpperCase() + mode.slice(1);

const matchesDifficultyMode = (meal: Meal, mode: DifficultyMode) => {
  if (typeof meal.difficulty !== "number") return false;
  if (mode === "easy") return meal.difficulty <= 2;
  if (mode === "hard") return meal.difficulty >= 4;
  return meal.difficulty > 2 && meal.difficulty < 4;
};

const getDifficultyModeColor = (mode: DifficultyMode, theme: WeeklyTheme) => {
  if (mode === "easy") return theme.color.success;
  if (mode === "hard") return theme.color.danger;
  return theme.color.warning;
};

const getMealDisplayTitle = (meal: Meal) =>
  (meal as Meal & { displayTitle?: string }).displayTitle?.trim() || meal.title;

const isFamilyStarMeal = (meal: Meal) => {
  if ((meal as Meal & { isFamilyStar?: boolean }).isFamilyStar === true) {
    return true;
  }
  const familyRatings = Object.values(meal.familyRatings ?? {}).filter(
    (value) => value > 0,
  );
  if (familyRatings.length > 0) {
    return familyRatings.every((value) => value === 3);
  }
  return (meal.rating ?? 0) >= 4.5;
};

const getDifficultyLabel = (meal: Meal) => {
  if (!meal.difficulty) return null;
  if (meal.difficulty <= 2) return "Easy";
  if (meal.difficulty >= 4) return "Hard";
  return "Medium";
};

const getDifficultyColor = (meal: Meal, theme: WeeklyTheme) => {
  if (typeof meal.difficulty !== "number" || Number.isNaN(meal.difficulty)) {
    return null;
  }
  if (meal.difficulty <= 2) return theme.color.success;
  if (meal.difficulty >= 4) return theme.color.danger;
  return theme.color.warning;
};

const getExpenseTier = (meal: Meal) => {
  if (typeof meal.expense === "number") {
    if (meal.expense <= 2) return 1;
    if (meal.expense >= 4) return 3;
    return 2;
  }
  return Math.min(Math.max(meal.plannedCostTier ?? 2, 1), 3);
};

const getMealReason = (
  meal: Meal,
  poolId: MealPoolId,
  plannedDay?: PlannedWeekDayKey,
  lastServedISO?: string | null,
) => {
  if (plannedDay) return `Planned ${PLANNED_WEEK_DISPLAY_NAMES[plannedDay]}`;
  if (poolId === "freezerMeals") {
    const amount = meal.freezerAmount?.trim() || meal.freezerQuantity?.trim();
    return amount
      ? `In your freezer: ${amount}${meal.freezerUnit ? ` ${meal.freezerUnit}` : ""}`
      : "In your freezer";
  }
  if (poolId === "familyStars" || poolId === "beenAwhile") {
    return formatLastServed(lastServedISO);
  }
  if (meal.isFavorite && getDifficultyLabel(meal) === "Easy") {
    return "Easy family favorite";
  }
  if (poolId === "easy") {
    const difficulty = getDifficultyLabel(meal);
    return difficulty === "Easy"
      ? "Easy to get on the table"
      : `${difficulty ?? "Unknown"} difficulty`;
  }
  if (poolId === "budget") {
    return `${"$".repeat(getExpenseTier(meal))} expense tier`;
  }
  return null;
};

const getMealAccessibilityLabel = (
  meal: Meal,
  poolId: MealPoolId,
  plannedDay?: PlannedWeekDayKey,
  lastServedISO?: string | null,
) =>
  [
    getMealDisplayTitle(meal),
    getDifficultyLabel(meal),
    `${getExpenseTier(meal)} dollar sign${getExpenseTier(meal) === 1 ? "" : "s"}`,
    getMealReason(meal, poolId, plannedDay, lastServedISO),
  ]
    .filter((value): value is string => Boolean(value))
    .join(", ");

const formatLastServed = (servedAtISO?: string | null) => {
  if (!servedAtISO) return "Not served yet";
  const servedAt = new Date(servedAtISO).getTime();
  if (!Number.isFinite(servedAt)) return "Not served yet";
  const days = Math.max(0, Math.floor((Date.now() - servedAt) / 86400000));
  if (days < 7) return "Last served this week";
  const weeks = Math.max(1, Math.floor(days / 7));
  return `Last served ${weeks} week${weeks === 1 ? "" : "s"} ago`;
};

const getPoolEmptyText = (poolId: MealPoolId, fallback: string) => {
  if (poolId === "beenAwhile") return "No meal history yet.";
  if (poolId === "freezerMeals") return "Your freezer is empty.";
  if (poolId === "familyStars") {
    return "Meals loved by everyone will appear here.";
  }
  if (poolId === "easy") return fallback;
  if (poolId === "budget") return fallback;
  return fallback;
};

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    wrap: {
      gap: theme.space.sm,
    },
    tabsScroller: {
      maxWidth: "100%",
    },
    tabs: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      paddingRight: theme.space.lg,
    },
    tab: {
      minHeight: 40,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.xs,
      paddingHorizontal: theme.space.md,
      backgroundColor: theme.color.surfaceAlt,
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
    },
    tabActive: {
      backgroundColor:
        theme.mode === "dark"
          ? theme.color.accent
          : theme.color.accent,
      borderColor: theme.color.accent,
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
      color: theme.color.ink,
    },
    carouselSection: {
      minHeight: 258,
      justifyContent: "center",
    },
    carouselList: {
      flexDirection: "row",
      gap: CAROUSEL_GAP,
      paddingRight: theme.space.xl * 2,
    },
    carouselCard: {
      minHeight: 225,
      paddingHorizontal: theme.space.xl,
      paddingVertical: theme.space.xl,
      borderRadius: theme.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surface,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.md,
      shadowColor: "#000",
      shadowOpacity: theme.mode === "dark" ? 0.22 : 0.1,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    carouselCardSelected: {
      borderColor: theme.color.accent,
    },
    carouselCardFamilyStar: {
      borderColor: "rgba(245, 158, 11, 0.46)",
    },
    carouselIndicators: {
      position: "absolute",
      top: theme.space.md,
      right: theme.space.md,
      zIndex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
    },
    carouselFamilyStar: {
      fontSize: 22,
    },
    carouselEmoji: {
      fontSize: 54,
    },
    carouselTitle: {
      maxWidth: "100%",
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    carouselMetadata: {
      minHeight: 24,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.sm,
    },
    difficultyDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radius.full,
    },
    expenseText: {
      color: theme.color.success,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    carouselReason: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
    },
    bookmarkButton: {
      position: "absolute",
      top: theme.space.md,
      right: theme.space.md,
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    pageDots: {
      minHeight: 24,
      marginTop: theme.space.sm,
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: theme.space.sm,
    },
    pageDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.border,
    },
    pageDotActive: {
      backgroundColor: theme.color.accent,
    },
    carouselEmpty: {
      minHeight: 180,
      padding: theme.space.xl,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.xl,
      backgroundColor: theme.color.surface,
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
    pressed: {
      opacity: 0.82,
    },
  });
