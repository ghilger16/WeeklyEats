import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { CUISINE_OPTIONS, CuisineType, getCuisineLabel } from "../../types/cuisine";
import { formatFreezerAvailability, getFreezerMealAmount } from "../../utils/freezerMealAmount";
import MealEmoji from "../emoji/MealEmoji";
import RatingStars from "../meals/RatingStars";
import { useFamilyMembers } from "../../hooks/useFamilyMembers";
import { useRatingDisplayMode } from "../../hooks/useRatingDisplayMode";
import { getFamilyRatingSummary } from "../../utils/familyRatings";
import {
  IngredientOverlap,
  formatSharedIngredientPreview,
} from "../../utils/ingredientOverlap";

export type MealPoolId =
  | "suggestedByYou"
  | "ingredients"
  | "beenAwhile"
  | "recentlyAdded"
  | "familyStars"
  | "fiveStars"
  | "freezerMeals"
  | "easy"
  | "cuisine"
  | "budget";

export type MealPool = {
  id: MealPoolId;
  title: string;
  subtitle: string;
  nextIcon: string;
  chipIcon?: string;
  emptyText: string;
  meals: Meal[];
  ingredientOverlapByMealId?: Record<string, IngredientOverlap>;
  cycle?: "difficulty" | "expense" | "cuisine" | "beenAwhile";
};

type Props = {
  pools: MealPool[];
  orderedDays: PlannedWeekDayKey[];
  plannedWeek: CurrentPlannedWeek;
  selectedMealId?: Meal["id"] | null;
  activePoolId?: MealPoolId | null;
  onActivePoolChange?: (poolId: MealPoolId | null) => void;
  onSelectMeal: (meal: Meal, poolId: MealPoolId) => void;
  onRemoveSuggestedMeal?: (mealId: Meal["id"]) => void;
  getLastServedISO?: (mealId: Meal["id"]) => string | null;
  beforeActivePoolContent?: ReactNode;
  isAutoPlanActive?: boolean;
  autoPlanCardState?: "fill" | "complete" | "alternate" | null;
  autoPlanAnimationPhase?: "idle" | "thinking" | "cascading" | "result" | "retrying";
  autoPlanThinkingIcons?: string[];
  isReduceMotionEnabled?: boolean;
  autoPlanMessage?: string | null;
  onPlanItForMe?: () => void;
  onAcceptAutoPlan?: () => void;
  onTryAnotherAutoPlan?: () => void;
  onClearAutoPlan?: () => void;
  onKeepCurrentWeek?: () => void;
  onRestorePreviousWeek?: () => void;
  maxDiscoveryRows?: number;
};

const CAROUSEL_GAP = 12;
type DifficultyMode = "easy" | "medium" | "hard";
type ExpenseMode = 1 | 2 | 3;
type BeenAwhileMode = 3 | 4 | 5;

const DIFFICULTY_MODES: DifficultyMode[] = ["easy", "medium", "hard"];
const EXPENSE_MODES: ExpenseMode[] = [1, 2, 3];
const BEEN_AWHILE_MODES: BeenAwhileMode[] = [3, 4, 5];

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
  isAutoPlanActive = false,
  autoPlanCardState = null,
  autoPlanAnimationPhase = "idle",
  autoPlanThinkingIcons = [],
  isReduceMotionEnabled = false,
  autoPlanMessage,
  onPlanItForMe,
  onAcceptAutoPlan,
  onTryAnotherAutoPlan,
  onClearAutoPlan,
  onKeepCurrentWeek,
  onRestorePreviousWeek,
  maxDiscoveryRows = 3,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { members } = useFamilyMembers();
  const { mode: ratingDisplayMode } = useRatingDisplayMode();
  const familyMemberIds = useMemo(
    () => members.map((member) => member.id),
    [members],
  );
  const transition = useRef(new Animated.Value(1)).current;
  const carouselRef = useRef<ScrollView>(null);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [difficultyMode, setDifficultyMode] =
    useState<DifficultyMode>("easy");
  const [expenseMode, setExpenseMode] = useState<ExpenseMode>(1);
  const [beenAwhileMode, setBeenAwhileMode] = useState<BeenAwhileMode>(3);
  const [cuisineMode, setCuisineMode] = useState<CuisineType>("american");
  const [isDiscoveryExpanded, setDiscoveryExpanded] = useState(false);
  const [isPlanTransitioning, setPlanTransitioning] = useState(false);
  const thinkingOpacity = useRef(new Animated.Value(0)).current;
  const cloudScale = useRef(new Animated.Value(1)).current;
  const cloudTranslateY = useRef(new Animated.Value(0)).current;
  const iconShuffle = useRef(new Animated.Value(0)).current;
  const thinkingFoodPositions = [
    styles.thinkingFoodIcon0,
    styles.thinkingFoodIcon1,
    styles.thinkingFoodIcon2,
    styles.thinkingFoodIcon3,
  ];

  const visiblePools = pools;
  const standardPoolIds = useMemo(
    () =>
      new Set<MealPoolId>([
        "beenAwhile",
        "recentlyAdded",
        "familyStars",
        "fiveStars",
        "freezerMeals",
        "easy",
        "cuisine",
        "budget",
      ]),
    [],
  );
  const discoveryPools = useMemo(
    () => [
      ...visiblePools.filter((pool) => !standardPoolIds.has(pool.id)),
      ...visiblePools.filter((pool) => standardPoolIds.has(pool.id)),
    ],
    [standardPoolIds, visiblePools],
  );
  const hasPlanItForMe = typeof onPlanItForMe === "function";
  const reservedDiscoverySlots = hasPlanItForMe ? 1 : 0;
  const collapsedDiscoverySlots = Math.max(4, maxDiscoveryRows * 2);
  const hasMoreDiscoveryPools =
    discoveryPools.length + reservedDiscoverySlots > collapsedDiscoverySlots;
  const collapsedDiscoveryPools = hasMoreDiscoveryPools
    ? discoveryPools.slice(
        0,
        Math.max(0, collapsedDiscoverySlots - reservedDiscoverySlots - 1),
      )
    : discoveryPools;
  const displayedDiscoveryPools = isDiscoveryExpanded
    ? discoveryPools
    : collapsedDiscoveryPools;

  useEffect(() => {
    if (!hasMoreDiscoveryPools && isDiscoveryExpanded) {
      setDiscoveryExpanded(false);
    }
  }, [hasMoreDiscoveryPools, isDiscoveryExpanded]);

  useEffect(() => {
    if (isAutoPlanActive) return;
    transition.stopAnimation();
    transition.setValue(1);
    setPlanTransitioning(false);
  }, [isAutoPlanActive, transition]);

  useEffect(() => {
    const isThinking =
      autoPlanAnimationPhase === "thinking" ||
      autoPlanAnimationPhase === "retrying" ||
      autoPlanAnimationPhase === "cascading";
    if (isThinking) {
      thinkingOpacity.setValue(1);
      cloudScale.setValue(1);
      cloudTranslateY.setValue(0);
      iconShuffle.setValue(0);
      if (isReduceMotionEnabled) return;
      const cloudLoop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(cloudScale, {
              toValue: 1.03,
              duration: 360,
              useNativeDriver: true,
            }),
            Animated.timing(cloudTranslateY, {
              toValue: -4,
              duration: 360,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(cloudScale, {
              toValue: 1,
              duration: 360,
              useNativeDriver: true,
            }),
            Animated.timing(cloudTranslateY, {
              toValue: 0,
              duration: 360,
              useNativeDriver: true,
            }),
          ]),
        ]),
      );
      const iconLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(iconShuffle, {
            toValue: 1,
            duration: 280,
            useNativeDriver: true,
          }),
          Animated.timing(iconShuffle, {
            toValue: 0,
            duration: 280,
            useNativeDriver: true,
          }),
        ]),
      );
      cloudLoop.start();
      iconLoop.start();
      return () => {
        cloudLoop.stop();
        iconLoop.stop();
      };
    }
  }, [autoPlanAnimationPhase, cloudScale, cloudTranslateY, iconShuffle, isReduceMotionEnabled, thinkingOpacity]);
  const activeIndex = visiblePools.findIndex((pool) => pool.id === activePoolId);
  const sourceActivePool =
    activeIndex >= 0 ? visiblePools[activeIndex] : undefined;
  const availableCuisineModes = useMemo(
    () =>
      CUISINE_OPTIONS.map((option) => option.value).filter((cuisine) =>
        sourceActivePool?.cycle === "cuisine"
          ? sourceActivePool.meals.some((meal) => meal.cuisine === cuisine)
          : false,
      ),
    [sourceActivePool],
  );
  const resolvedCuisineMode = availableCuisineModes.includes(cuisineMode)
    ? cuisineMode
    : availableCuisineModes[0] ?? cuisineMode;

  useEffect(() => {
    if (
      sourceActivePool?.cycle === "cuisine" &&
      availableCuisineModes.length > 0 &&
      !availableCuisineModes.includes(cuisineMode)
    ) {
      setCuisineMode(availableCuisineModes[0]);
      setActiveCardIndex(0);
    }
  }, [availableCuisineModes, cuisineMode, sourceActivePool]);

  const activePool = useMemo(() => {
    if (!sourceActivePool) return null;
    if (sourceActivePool.cycle === "difficulty") {
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
    if (sourceActivePool.cycle === "expense") {
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
    if (sourceActivePool.cycle === "cuisine") {
      const cuisineLabel = getCuisineLabel(resolvedCuisineMode) ?? "Cuisine";
      return {
        ...sourceActivePool,
        title: cuisineLabel,
        subtitle: `${cuisineLabel} meals.`,
        emptyText: `No ${cuisineLabel} meals yet.`,
        meals: sourceActivePool.meals.filter(
          (meal) => meal.cuisine === resolvedCuisineMode,
        ),
      };
    }
    if (sourceActivePool.cycle === "beenAwhile") {
      const modeLabel = beenAwhileMode === 5 ? "5+ Weeks" : `${beenAwhileMode} Weeks`;
      return {
        ...sourceActivePool,
        title: modeLabel,
        subtitle:
          beenAwhileMode === 5
            ? "Not served for at least 5 weeks."
            : `Last served ${beenAwhileMode} weeks ago.`,
        emptyText: `No meals in the ${modeLabel.toLowerCase()} range.`,
        meals: sourceActivePool.meals.filter((meal) => {
          const lastServedISO = getLastServedISO?.(meal.id);
          const referenceISO = lastServedISO ?? meal.createdAt;
          if (!referenceISO) return false;
          const lastServedAt = new Date(referenceISO).getTime();
          if (!Number.isFinite(lastServedAt)) return false;
          const weeksSinceServed = Math.floor(
            (Date.now() - lastServedAt) / (7 * 24 * 60 * 60 * 1000),
          );
          return beenAwhileMode === 5
            ? weeksSinceServed >= 5
            : weeksSinceServed === beenAwhileMode;
        }),
      };
    }
    return sourceActivePool;
  }, [beenAwhileMode, difficultyMode, expenseMode, getLastServedISO, resolvedCuisineMode, sourceActivePool]);

  const animateIn = () => {
    transition.setValue(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: theme.motion.duration.normal,
      useNativeDriver: true,
    }).start();
  };

  const collapseToDiscovery = () => {
    transition.setValue(0);
    onActivePoolChange?.(null);
    setActiveCardIndex(0);
    Animated.timing(transition, {
      toValue: 1,
      duration: theme.motion.duration.normal,
      useNativeDriver: true,
    }).start();
  };

  const setPoolIndex = (index: number) => {
    const nextPool = visiblePools[index];
    if (!nextPool) {
      return;
    }
    onActivePoolChange?.(nextPool.id);
    setActiveCardIndex(0);
    animateIn();
  };

  const applyCycleSelection = (apply: () => void, isSelected: boolean) => {
    if (isSelected) {
      return;
    }
    apply();
    setActiveCardIndex(0);
    carouselRef.current?.scrollTo({ x: 0, animated: false });
    animateIn();
  };

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
    ? Math.max(180, carouselWidth * 0.68)
    : 227;
  const snapInterval = mealCardWidth + CAROUSEL_GAP;

  const handleCarouselMomentumEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const nextIndex = Math.max(
      0,
      Math.min(
        (activePool?.meals.length ?? 1) - 1,
        Math.round(event.nativeEvent.contentOffset.x / snapInterval),
      ),
    );
    setActiveCardIndex(nextIndex);
  };

  const handlePlanItPress = () => {
    if (isPlanTransitioning || !onPlanItForMe) return;
    setPlanTransitioning(true);
    Animated.timing(transition, {
      toValue: 0,
      duration: isReduceMotionEnabled ? 80 : 180,
      useNativeDriver: true,
    }).start(() => {
      onPlanItForMe();
      transition.setValue(0);
      Animated.timing(transition, {
        toValue: 1,
        duration: isReduceMotionEnabled ? 100 : 160,
        useNativeDriver: true,
      }).start(() => setPlanTransitioning(false));
    });
  };

  return (
    <View style={styles.wrap}>
      {isAutoPlanActive && autoPlanAnimationPhase === "result" ? (
        <View style={styles.autoPlanPanel}>
          <View style={styles.autoPlanHeadingRow}>
            <Text style={styles.autoPlanSparkle}>✨</Text>
            <Text style={styles.autoPlanTitle}>
              {autoPlanCardState === "complete"
                ? "Week Is Planned"
                : autoPlanCardState === "alternate"
                  ? "New Week Suggested!"
                  : "Week Suggested!"}
            </Text>
          </View>
          <Text style={styles.autoPlanSubtitle}>
            {autoPlanCardState === "complete"
              ? "Want to see a different version?"
              : autoPlanCardState === "alternate"
                ? "Want to make any changes?"
                : "A first draft based on your meals, favorites, and history."}
          </Text>
          <View style={styles.autoPlanActions}>
            <Pressable
              onPress={
                autoPlanCardState === "fill"
                  ? onAcceptAutoPlan
                  : onTryAnotherAutoPlan
              }
              accessibilityRole="button"
              accessibilityLabel={
                autoPlanCardState === "fill"
                  ? "Use this suggested plan"
                  : "Try another week"
              }
              style={({ pressed }) => [
                styles.autoPlanPrimaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.autoPlanPrimaryText}>
                {autoPlanCardState === "fill"
                  ? "Use This Plan"
                  : "Try Another Week"}
              </Text>
            </Pressable>
            {autoPlanCardState === "fill" ? (
              <Pressable
                onPress={onTryAnotherAutoPlan}
                accessibilityRole="button"
                accessibilityLabel="Try another suggested week"
                style={({ pressed }) => [
                  styles.autoPlanSecondaryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.autoPlanSecondaryText}>Try Another Week</Text>
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={
              autoPlanCardState === "complete"
                ? onKeepCurrentWeek
                : autoPlanCardState === "alternate"
                  ? onRestorePreviousWeek
                  : onClearAutoPlan
            }
            accessibilityRole="button"
            accessibilityLabel={
              autoPlanCardState === "complete"
                ? "Keep this week"
                : autoPlanCardState === "alternate"
                  ? "Restore previous week"
                  : "Clear suggested meals"
            }
            style={({ pressed }) => [
              styles.autoPlanClearButton,
              pressed && styles.pressed,
            ]}
          >
            {autoPlanCardState !== "complete" ? (
              <MaterialCommunityIcons
                name="backup-restore"
                size={18}
                color={theme.color.accent}
              />
            ) : null}
            <Text style={styles.autoPlanClearText}>
              {autoPlanCardState === "complete"
                ? "Keep This Week"
                : autoPlanCardState === "alternate"
                  ? "Restore Previous Week"
                  : "Clear Suggestions"}
            </Text>
          </Pressable>
        </View>
      ) : isAutoPlanActive ? (
        <Animated.View
          style={[
            styles.thinkingWrap,
            {
              opacity: thinkingOpacity,
              transform: [
                { scale: cloudScale },
                { translateY: cloudTranslateY },
              ],
            },
          ]}
          accessibilityLabel="Planning your week"
        >
          <View style={styles.thinkingVisual}>
            <Text style={styles.thinkingCloud}>☁️</Text>
            <Text style={styles.thinkingSparkle}>✨</Text>
            {!isReduceMotionEnabled
              ? (autoPlanThinkingIcons.length
                  ? autoPlanThinkingIcons
                  : ["🌮", "🍚", "🍝", "🥗"]
                ).slice(0, 4).map((icon, index) => (
                  <Animated.View
                    key={`${icon}-${index}`}
                    style={[
                      styles.thinkingFoodIcon,
                      thinkingFoodPositions[index],
                      {
                        opacity: iconShuffle.interpolate({
                          inputRange: [0, 1],
                          outputRange: index % 2 ? [0.45, 1] : [1, 0.45],
                        }),
                        transform: [
                          {
                            translateY: iconShuffle.interpolate({
                              inputRange: [0, 1],
                              outputRange: index % 2 ? [2, -3] : [-2, 3],
                            }),
                          },
                          {
                            translateX: iconShuffle.interpolate({
                              inputRange: [0, 1],
                              outputRange: index % 2 ? [-2, 3] : [2, -3],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <MealEmoji value={icon} size={24} />
                  </Animated.View>
                ))
              : null}
          </View>
          <Text style={styles.thinkingText}>Planning your week…</Text>
        </Animated.View>
      ) : activePool ? (
        <View style={styles.activeTabRow}>
          {activePool.cycle ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                directionalLockEnabled
                alwaysBounceVertical={false}
                bounces={false}
                style={styles.tabsScroller}
                contentContainerStyle={styles.tabs}
                accessibilityRole="tablist"
              >
              {activePool.cycle === "difficulty"
                ? DIFFICULTY_MODES.map((mode) => {
                    const isSelected = mode === difficultyMode;
                    return (
                      <Pressable
                        key={mode}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: isSelected }}
                        onPress={() =>
                          applyCycleSelection(
                            () => setDifficultyMode(mode),
                            isSelected,
                          )
                        }
                        style={({ pressed }) => [styles.tab, isSelected && styles.tabActive, pressed && styles.pressed]}
                      >
                        <View style={[styles.difficultyDot, { backgroundColor: getDifficultyModeColor(mode, theme) }]} />
                        <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>{getDifficultyModeLabel(mode)}</Text>
                      </Pressable>
                    );
                  })
                : activePool.cycle === "expense"
                  ? EXPENSE_MODES.map((mode) => {
                      const isSelected = mode === expenseMode;
                      return (
                        <Pressable
                          key={mode}
                          accessibilityRole="tab"
                          accessibilityState={{ selected: isSelected }}
                          accessibilityLabel={`${mode} dollar sign${mode === 1 ? "" : "s"} expense`}
                          onPress={() => applyCycleSelection(() => setExpenseMode(mode), isSelected)}
                          style={({ pressed }) => [styles.tab, isSelected && styles.tabActive, pressed && styles.pressed]}
                        >
                          <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>{"$".repeat(mode)}</Text>
                        </Pressable>
                      );
                    })
                  : activePool.cycle === "beenAwhile"
                    ? BEEN_AWHILE_MODES.map((mode) => {
                        const isSelected = mode === beenAwhileMode;
                        return (
                          <Pressable
                            key={mode}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={
                              mode === 5
                                ? "Not served for 5 or more weeks"
                                : `Not served for ${mode} weeks`
                            }
                            onPress={() => applyCycleSelection(() => setBeenAwhileMode(mode), isSelected)}
                            style={({ pressed }) => [styles.tab, isSelected && styles.tabActive, pressed && styles.pressed]}
                          >
                            <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>
                              {mode === 5 ? "5+" : `${mode} Weeks`}
                            </Text>
                          </Pressable>
                        );
                      })
                    : availableCuisineModes.map((mode) => {
                      const isSelected = mode === resolvedCuisineMode;
                      return (
                        <Pressable
                          key={mode}
                          accessibilityRole="tab"
                          accessibilityState={{ selected: isSelected }}
                          onPress={() => applyCycleSelection(() => setCuisineMode(mode), isSelected)}
                          style={({ pressed }) => [styles.tab, isSelected && styles.tabActive, pressed && styles.pressed]}
                        >
                          <Text style={[styles.tabText, isSelected && styles.tabTextActive]}>{getCuisineLabel(mode)}</Text>
                        </Pressable>
                      );
                    })}
              </ScrollView>
            </>
          ) : (
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel={`${getPoolTabLabel(activePool.id, difficultyMode, resolvedCuisineMode)} active tab`}
              accessibilityState={{ selected: true }}
              style={({ pressed }) => [styles.tab, styles.tabActive, pressed && styles.pressed]}
            >
              {activePool.id === "freezerMeals" ? (
              <MaterialCommunityIcons
                name="snowflake"
                size={20}
                color={theme.color.ink}
                style={[styles.tabIcon, styles.tabIconActive]}
              />
              ) : (
              <Text style={[styles.tabIcon, styles.tabIconActive]}>
                {(activePool.chipIcon ?? getPoolIcon(activePool.id)) || "🍽️"}
              </Text>
              )}
              <Text style={[styles.tabText, styles.tabTextActive]} numberOfLines={1}>
                {getPoolTabLabel(activePool.id, difficultyMode, resolvedCuisineMode)}
              </Text>
            </Pressable>
          )}
          <Pressable
            onPress={collapseToDiscovery}
            accessibilityRole="button"
            accessibilityLabel={`Close ${activePool.title} inspiration tabs`}
            style={({ pressed }) => [
              styles.closeTabsButton,
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons
              name="close"
              size={20}
              color={theme.color.subtleInk}
            />
          </Pressable>
        </View>
      ) : (
        <Animated.View
          style={[
            styles.discoveryWrap,
            isPlanTransitioning ? contentStyle : null,
          ]}
        >
          <View style={styles.discoveryGrid}>
            {hasPlanItForMe ? (
              <Pressable
                onPress={handlePlanItPress}
                disabled={isPlanTransitioning}
                accessibilityRole="button"
                accessibilityLabel="Plan It For Me"
                style={({ pressed }) => [
                  styles.discoveryCell,
                  styles.planItCell,
                  pressed && !isReduceMotionEnabled && styles.planItCellPressed,
                  pressed && styles.discoveryCellPressed,
                ]}
              >
                <Text style={[styles.discoveryIcon, styles.planItIcon]}>✨</Text>
                <Text style={styles.discoveryLabel} numberOfLines={1}>
                  Plan It For Me
                </Text>
              </Pressable>
            ) : null}
            {displayedDiscoveryPools.map((pool, index) => (
              <Pressable
                key={pool.id}
                onPress={() => setPoolIndex(visiblePools.indexOf(pool))}
                accessibilityRole="button"
                accessibilityLabel={`Browse ${pool.cycle === "cuisine" ? "Cuisine" : getPoolTabLabel(pool.id, difficultyMode, resolvedCuisineMode)} meal suggestions`}
                style={({ pressed }) => [
                  styles.discoveryCell,
                  pressed && styles.discoveryCellPressed,
                ]}
              >
                {pool.cycle === "difficulty" ? (
                  <View
                    style={[
                      styles.discoveryDifficultyIcon,
                      { backgroundColor: getDifficultyModeColor("easy", theme) },
                    ]}
                    accessibilityLabel="Easy difficulty"
                  />
                ) : pool.id === "freezerMeals" ? (
                  <MaterialCommunityIcons
                    name="snowflake"
                    size={21}
                    color={theme.color.accent}
                    style={styles.discoveryMaterialIcon}
                    accessibilityLabel="Freezer"
                  />
                ) : pool.cycle === "expense" ? (
                  <Text
                    style={styles.discoveryExpenseIcon}
                    accessibilityLabel="One dollar sign expense"
                  >
                    $
                  </Text>
                ) : pool.cycle === "cuisine" ? (
                  <Text style={styles.discoveryIcon}>🌎</Text>
                ) : pool.cycle === "beenAwhile" ? (
                  <Text style={styles.discoveryIcon}>🕒</Text>
                ) : pool.id === "fiveStars" ? (
                  <MaterialCommunityIcons
                    name="star"
                    size={22}
                    color={theme.color.accent}
                    style={styles.discoveryMaterialIcon}
                    accessibilityLabel="Five Stars"
                  />
                ) : (
                  <Text style={styles.discoveryIcon}>
                    {getDiscoveryPoolIcon(pool.id, pool.chipIcon)}
                  </Text>
                )}
                <Text style={styles.discoveryLabel} numberOfLines={1}>
                  {pool.cycle === "cuisine"
                    ? "Cuisine"
                    : getPoolTabLabel(pool.id, difficultyMode, resolvedCuisineMode)}
                </Text>
              </Pressable>
            ))}
            {!isDiscoveryExpanded && hasMoreDiscoveryPools ? (
              <Pressable
                onPress={() => setDiscoveryExpanded(true)}
                accessibilityRole="button"
                accessibilityLabel="Show more suggestion categories"
                style={({ pressed }) => [
                  styles.discoveryCell,
                  pressed && styles.discoveryCellPressed,
                ]}
              >
                <Text style={styles.discoveryMoreLabel}>More →</Text>
              </Pressable>
            ) : null}
          </View>
          {autoPlanMessage ? (
            <Text style={styles.autoPlanMessage}>{autoPlanMessage}</Text>
          ) : null}
          {isDiscoveryExpanded && hasMoreDiscoveryPools ? (
            <Pressable
              onPress={() => setDiscoveryExpanded(false)}
              accessibilityRole="button"
              accessibilityLabel="Show fewer suggestion categories"
              style={styles.discoveryShowLess}
            >
              <Text style={styles.discoveryShowLessText}>Show less</Text>
            </Pressable>
          ) : null}
        </Animated.View>
      )}

      {!isAutoPlanActive && activePool ? (
        <>
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
              onMomentumScrollEnd={handleCarouselMomentumEnd}
            >
              {activePool.meals.map((meal) => {
                const isSelected = meal.id === selectedMealId;
                const familyRatingSummary =
                  ratingDisplayMode === "family"
                    ? getFamilyRatingSummary(meal.familyRatings, familyMemberIds)
                    : null;
                const hasStarRating =
                  ratingDisplayMode === "summary" && (meal.rating ?? 0) > 0;
                const hasDisplayedRating =
                  Boolean(familyRatingSummary) || hasStarRating;
                const plannedDay = orderedDays.find(
                  (day) => plannedWeek[day] === meal.id,
                );
                const difficultyColor = getDifficultyColor(meal, theme);
                const lastServedISO = getLastServedISO?.(meal.id) ?? null;
                const ingredientOverlap =
                  activePool.ingredientOverlapByMealId?.[meal.id];
                const ingredientReason = ingredientOverlap
                  ? `🥕 Shares ${ingredientOverlap.sharedCount} ${
                      ingredientOverlap.sharedCount === 1
                        ? "ingredient"
                        : "ingredients"
                    } with your week`
                  : null;
                const ingredientPreview = ingredientOverlap
                  ? formatSharedIngredientPreview(
                      ingredientOverlap.sharedIngredients,
                    )
                  : null;
                const mealReason =
                  ingredientReason ??
                  getMealReason(
                    meal,
                    activePool.id,
                    plannedDay,
                    lastServedISO,
                  );
                return (
                  <Pressable
                    key={meal.id}
                    accessibilityRole="button"
                    accessibilityLabel={`${getMealAccessibilityLabel(
                      meal,
                      activePool.id,
                      plannedDay,
                      lastServedISO,
                    )}${ingredientReason ? `, ${ingredientReason}, ${ingredientPreview}` : ""}${
                      isSelected ? ". Selected. Choose a day." : ""
                    }`}
                    onPress={() => onSelectMeal(meal, activePool.id)}
                    style={({ pressed }) => [
                      styles.carouselCard,
                      { width: mealCardWidth },
                      (activePool.id === "familyStars" || activePool.id === "fiveStars") &&
                        styles.carouselCardFamilyStar,
                      isSelected && styles.carouselCardSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    {hasDisplayedRating || activePool.id === "familyStars" ||
                    activePool.id === "fiveStars" || activePool.id === "freezerMeals" ? (
                      <View style={styles.carouselIndicators}>
                        {familyRatingSummary ? (
                          <View
                            style={styles.carouselFamilyRating}
                            accessible
                            accessibilityLabel={`${familyRatingSummary.average.toFixed(1)} family rating`}
                          >
                            <MaterialCommunityIcons
                              name="star"
                              size={17}
                              color={theme.color.accent}
                            />
                            <Text style={styles.carouselFamilyRatingText}>
                              {familyRatingSummary.average.toFixed(1)}
                            </Text>
                          </View>
                        ) : hasStarRating ? (
                          <RatingStars value={meal.rating} size={14} gap={1} />
                        ) : activePool.id === "fiveStars" ? (
                          <MaterialCommunityIcons
                            name="star"
                            size={22}
                            color={theme.color.accent}
                            accessibilityLabel="Five-star meal"
                          />
                        ) : activePool.id === "familyStars" ? (
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
                    <MealEmoji
                      value={meal.emoji ?? activePool.chipIcon}
                      size={52}
                    />
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
                    {mealReason ? (
                      <Text style={styles.carouselReason} numberOfLines={2}>
                        {mealReason}
                      </Text>
                    ) : null}
                    {ingredientPreview ? (
                      <Text
                        style={styles.carouselIngredientPreview}
                        numberOfLines={1}
                      >
                        {ingredientPreview}
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
        </>
      ) : null}
    </View>
  );
}

const getPoolIcon = (poolId: MealPoolId) => {
  if (poolId === "suggestedByYou") return "💡";
  if (poolId === "ingredients") return "🥕";
  if (poolId === "beenAwhile") return "🕒";
  if (poolId === "recentlyAdded") return "🕐";
  if (poolId === "familyStars") return "⭐";
  if (poolId === "cuisine") return "🌎";
  if (poolId === "fiveStars") return "⭐";
  return "";
};

const getDiscoveryPoolIcon = (poolId: MealPoolId, configuredIcon?: string) => {
  if (poolId === "freezerMeals") return "❄️";
  return (configuredIcon ?? getPoolIcon(poolId)) || "🍽️";
};

const getPoolTabLabel = (
  poolId: MealPoolId,
  difficultyMode: DifficultyMode = "easy",
  cuisineMode: CuisineType = "american",
) => {
  if (poolId === "suggestedByYou") return "Suggested by You";
  if (poolId === "ingredients") return "Ingredients";
  if (poolId === "beenAwhile") return "Been Awhile";
  if (poolId === "recentlyAdded") return "Recently Added";
  if (poolId === "familyStars") return "Family Star";
  if (poolId === "fiveStars") return "Five Stars";
  if (poolId === "freezerMeals") return "Freezer";
  if (poolId === "easy") return getDifficultyModeLabel(difficultyMode);
  if (poolId === "cuisine") return getCuisineLabel(cuisineMode) ?? "Cuisine";
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
    const amount = getFreezerMealAmount(meal);
    return amount
      ? formatFreezerAvailability(amount)
      : "In your freezer";
  }
  if (poolId === "familyStars" || poolId === "beenAwhile") {
    return formatLastServed(lastServedISO);
  }
  if (poolId === "recentlyAdded") return "Added within the last month";
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
  if (poolId === "cuisine") {
    return `${getCuisineLabel(meal.cuisine) ?? "Cuisine"} cuisine`;
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
  if (poolId === "suggestedByYou") {
    return "No meals suggested for this planning session.";
  }
  if (poolId === "ingredients") return "No strong ingredient matches right now.";
  if (poolId === "beenAwhile") return "No meal history yet.";
  if (poolId === "recentlyAdded") return "No unserved meals added recently.";
  if (poolId === "freezerMeals") return "Your freezer is empty.";
  if (poolId === "familyStars") {
    return "Meals loved by everyone will appear here.";
  }
  if (poolId === "fiveStars") return "Five-star meals will appear here.";
  if (poolId === "easy") return fallback;
  if (poolId === "cuisine") return fallback;
  if (poolId === "budget") return fallback;
  return fallback;
};

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    wrap: {
      gap: theme.space.sm,
    },
    discoveryWrap: {
      gap: theme.space.md,
    },
    discoverySectionLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    discoveryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.sm,
    },
    discoveryCell: {
      width: "48.5%",
      height: 58,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
      paddingHorizontal: theme.space.lg,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
    },
    discoveryCellPressed: {
      opacity: 0.78,
    },
    planItCell: {
      borderColor: theme.color.accent,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(255, 75, 145, 0.08)"
          : "rgba(255, 75, 145, 0.04)",
    },
    planItCellPressed: {
      transform: [{ scale: 0.97 }],
    },
    planItIcon: {
      color: theme.color.accent,
    },
    discoveryIcon: {
      width: 24,
      textAlign: "center",
      fontSize: 21,
    },
    discoveryMaterialIcon: {
      width: 24,
      textAlign: "center",
    },
    discoveryDifficultyIcon: {
      width: 10,
      height: 10,
      marginHorizontal: 7,
      borderRadius: theme.radius.full,
    },
    discoveryExpenseIcon: {
      width: 24,
      color: theme.color.success,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    discoveryLabel: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    discoveryMoreLabel: {
      flex: 1,
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    discoveryShowLess: {
      alignSelf: "flex-start",
      paddingVertical: theme.space.xs,
    },
    discoveryShowLessText: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    autoPlanMessage: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      lineHeight: 19,
    },
    thinkingWrap: {
      minHeight: 208,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.sm,
    },
    thinkingVisual: {
      width: 132,
      height: 82,
      alignItems: "center",
      justifyContent: "center",
    },
    thinkingCloud: {
      fontSize: 54,
      opacity: 0.92,
    },
    thinkingSparkle: {
      position: "absolute",
      top: 3,
      right: 25,
      fontSize: 17,
    },
    thinkingFoodIcon: {
      position: "absolute",
    },
    thinkingFoodIcon0: {
      left: 5,
      top: 7,
    },
    thinkingFoodIcon1: {
      right: 4,
      top: 24,
    },
    thinkingFoodIcon2: {
      left: 18,
      bottom: 0,
    },
    thinkingFoodIcon3: {
      right: 21,
      bottom: -2,
    },
    thinkingText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    autoPlanPanel: {
      minHeight: 208,
      gap: theme.space.sm,
      padding: theme.space.lg,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.accent,
      backgroundColor: theme.color.surfaceAlt,
    },
    autoPlanHeadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.sm,
    },
    autoPlanSparkle: {
      fontSize: 20,
    },
    autoPlanTitle: {
      color: theme.color.accent,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    autoPlanSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      lineHeight: 19,
      textAlign: "center",
    },
    autoPlanActions: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.sm,
      marginTop: theme.space.xs,
    },
    autoPlanPrimaryButton: {
      flex: 1,
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.space.lg,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.accent,
    },
    autoPlanPrimaryText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    autoPlanSecondaryButton: {
      flex: 1,
      minHeight: 40,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.space.md,
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surface,
    },
    autoPlanSecondaryText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    autoPlanClearButton: {
      minHeight: 32,
      marginTop: theme.space.xs,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.xs,
      paddingHorizontal: theme.space.sm,
    },
    autoPlanClearText: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    activeTabRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      minHeight: 48,
    },
    tabsScroller: {
      flex: 1,
      maxWidth: "100%",
    },
    tabs: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      paddingRight: theme.space.lg,
    },
    closeTabsButton: {
      width: 40,
      height: 40,
      marginLeft: "auto",
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
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
      minHeight: 232,
      justifyContent: "center",
    },
    carouselList: {
      flexDirection: "row",
      gap: CAROUSEL_GAP,
      paddingRight: theme.space.xl * 2,
    },
    carouselCard: {
      minHeight: 203,
      paddingHorizontal: theme.space.xl * 0.9,
      paddingVertical: theme.space.xl * 0.9,
      borderRadius: theme.radius.xl,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surface,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.md * 0.9,
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
      fontSize: 20,
    },
    carouselFamilyRating: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
    },
    carouselFamilyRatingText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    carouselEmoji: {
      fontSize: 49,
    },
    carouselTitle: {
      maxWidth: "100%",
      color: theme.color.ink,
      fontSize: theme.type.size.title,
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
    carouselIngredientPreview: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
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
