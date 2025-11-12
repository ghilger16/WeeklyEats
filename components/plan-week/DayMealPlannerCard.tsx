import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  findNodeHandle,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentRef, RefObject } from "react";
import { Meal } from "../../types/meals";
import { PlannedWeekDayKey } from "../../types/weekPlan";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { FlexGrid } from "../../styles/flex-grid";
import PinBoard from "./PinBoard";
import { DayPinsState } from "../../types/dayPins";
import StartPlanningCard from "./StartPlanningCard";
import {
  SuggestionBannerContext,
  getSuggestionBanner,
} from "./suggestionBanners";

type DifficultyKey = "easy" | "medium" | "hard";

type Props = {
  dayKey: PlannedWeekDayKey;
  dayDisplayName: string;
  meal?: Meal;
  onAdd: () => void;
  onShuffle: () => void;
  onEat: () => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onOpenPins?: () => void;
  pins: DayPinsState;
  onPinsChange: (next: DayPinsState) => void;
};

const difficultyToLabel: Record<DifficultyKey, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const getDifficultyLabel = (value: number | undefined): DifficultyKey => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "medium";
  }
  if (value <= 2) return "easy";
  if (value >= 4) return "hard";
  return "medium";
};

const formatLastServed = (iso?: string) => {
  if (!iso) return "Never served";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Never served";
  }
  return `Last served: ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
};

const TOGGLE_ITEMS = [
  { value: "pins" as const, label: "📌 Pins" },
  { value: "suggestions" as const, label: "🍽️ Suggestions" },
  { value: "search" as const, label: "🔍 Search" },
] as const;

type PlannerTabValue = (typeof TOGGLE_ITEMS)[number]["value"];

const getTabIndex = (value: PlannerTabValue) =>
  TOGGLE_ITEMS.findIndex((item) => item.value === value);

const BANNER_FADE_IN_MS = 140;
const BANNER_FADE_OUT_MS = 120;

export default function DayMealPlannerCard({
  dayKey,
  dayDisplayName,
  meal,
  onAdd,
  onShuffle,
  onEat,
  searchQuery,
  onSearchQueryChange,
  onOpenPins,
  pins,
  onPinsChange,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [activeTab, setActiveTab] = useState<PlannerTabValue>("suggestions");
  const [toggleWidth, setToggleWidth] = useState(0);
  const tabProgress = useRef(new Animated.Value(1)).current;
  const indicatorProgress = useRef(
    new Animated.Value(getTabIndex("suggestions"))
  ).current;
  const mealTitleRef = useRef<ComponentRef<typeof Text> | null>(null);
  const pinsTitleRef = useRef<ComponentRef<typeof Text> | null>(null);
  const searchInputRef = useRef<ComponentRef<typeof TextInput> | null>(null);
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const lastMealIdRef = useRef<string | null>(null);
  const [dismissedStartCardMap, setDismissedStartCardMap] = useState<
    Record<string, boolean>
  >({});
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [bannerContext, setBannerContext] =
    useState<SuggestionBannerContext>("general");

  const mealDifficulty = meal ? getDifficultyLabel(meal.difficulty) : null;
  const ratingLabel = meal && meal.rating ? meal.rating.toFixed(1) : "--";
  const costTier = meal?.expense
    ? Math.max(1, Math.min(3, Math.round(meal.expense / 2)))
    : meal?.plannedCostTier ?? 1;
  const costLabel = meal ? "$".repeat(costTier) : "--";

  const showStartPlanningCard = !dismissedStartCardMap[dayDisplayName];
  const indicatorSegment = useMemo(
    () => (toggleWidth ? toggleWidth / TOGGLE_ITEMS.length : 0),
    [toggleWidth]
  );
  const indicatorTranslate = indicatorProgress.interpolate({
    inputRange: [0, TOGGLE_ITEMS.length - 1],
    outputRange: [0, indicatorSegment * (TOGGLE_ITEMS.length - 1)],
  });
  const suggestionsTranslate = tabProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [12, 0],
  });
  const pinsOpacity = tabProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });
  const pinsTranslate = tabProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -12],
  });

  const focusOnRef = useCallback((ref: RefObject<ComponentRef<typeof Text> | null>) => {
    const node = ref.current ? findNodeHandle(ref.current) : null;
    if (node) {
      AccessibilityInfo.setAccessibilityFocus(node);
    }
  }, []);

  const hideBanner = useCallback(
    (animate = true) => {
      if (!bannerMessage) {
        bannerOpacity.setValue(0);
        setBannerMessage(null);
        return;
      }
      if (!animate) {
        bannerOpacity.setValue(0);
        setBannerMessage(null);
        return;
      }
      Animated.timing(bannerOpacity, {
        toValue: 0,
        duration: BANNER_FADE_OUT_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setBannerMessage(null);
        }
      });
    },
    [bannerMessage, bannerOpacity]
  );

  const displayBanner = useCallback(
    (message: string, context: SuggestionBannerContext) => {
      setBannerContext(context);
      setBannerMessage(message);
      Haptics.selectionAsync().catch(() => {});
      Animated.timing(bannerOpacity, {
        toValue: 1,
        duration: BANNER_FADE_IN_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    },
    [bannerOpacity]
  );

  const showBannerMessage = useCallback(
    (context: SuggestionBannerContext) => {
      const { message } = getSuggestionBanner({ context });
      if (bannerMessage) {
        Animated.timing(bannerOpacity, {
          toValue: 0,
          duration: BANNER_FADE_OUT_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start(() => {
          displayBanner(message, context);
        });
        return;
      }
      displayBanner(message, context);
    },
    [bannerMessage, bannerOpacity, displayBanner]
  );

  const animateToTab = useCallback(
    (target: PlannerTabValue) => {
      const progressTarget = target === "suggestions" ? 1 : 0;
      Animated.parallel([
        Animated.timing(tabProgress, {
          toValue: progressTarget,
          duration: 200,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
        Animated.timing(indicatorProgress, {
          toValue: getTabIndex(target),
          duration: 200,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) {
          return;
        }
        if (target === "pins") {
          focusOnRef(pinsTitleRef);
        } else if (target === "suggestions") {
          focusOnRef(mealTitleRef);
        } else if (target === "search") {
          searchInputRef.current?.focus?.();
        }
      });
    },
    [focusOnRef, indicatorProgress, searchInputRef, tabProgress]
  );

  const handleSelectTab = useCallback(
    (nextTab: PlannerTabValue) => {
      if (activeTab === nextTab) {
        return;
      }
      if (activeTab === "pins" && nextTab !== "pins" && !pins.completed) {
        onPinsChange({ ...pins, completed: true });
      }
      setActiveTab(nextTab);
      if (nextTab === "pins") {
        onOpenPins?.();
      }
      animateToTab(nextTab);
    },
    [activeTab, animateToTab, onOpenPins, onPinsChange, pins]
  );

  const resolveBannerContext = useCallback((): SuggestionBannerContext => {
    if (
      pins.freezerNight ||
      Boolean(meal?.freezerQuantity) ||
      Boolean(meal?.freezerAmount)
    ) {
      return "freezer";
    }
    if (pins.familyStar === "include" || meal?.isFavorite) {
      return "favorite";
    }
    if (pins.reuseWeeks) {
      return "reuse";
    }
    if (pins.effort) {
      return "difficulty";
    }
    return "general";
  }, [meal, pins]);

  const handleDismissStartCard = useCallback(() => {
    setDismissedStartCardMap((prev) => ({
      ...prev,
      [dayDisplayName]: true,
    }));
    handleSelectTab("suggestions");
  }, [dayDisplayName, handleSelectTab]);

  useEffect(() => {
    if (
      !meal ||
      !meal.id ||
      showStartPlanningCard ||
      activeTab !== "suggestions"
    ) {
      return;
    }
    if (lastMealIdRef.current === meal.id) {
      return;
    }
    lastMealIdRef.current = meal.id;
    showBannerMessage(resolveBannerContext());
  }, [
    activeTab,
    meal,
    resolveBannerContext,
    showBannerMessage,
    showStartPlanningCard,
  ]);

  useEffect(() => {
    if (activeTab !== "suggestions") {
      hideBanner();
    }
  }, [activeTab, hideBanner]);

  useEffect(() => {
    if (showStartPlanningCard) {
      hideBanner(false);
    }
  }, [hideBanner, showStartPlanningCard]);

  useEffect(() => {
    if (!meal) {
      lastMealIdRef.current = null;
      hideBanner(false);
    }
  }, [hideBanner, meal]);

  return (
    <View style={styles.container}>
      <View style={styles.dayTabs}></View>

      <Text style={styles.dayTitle}>{dayDisplayName}</Text>

      <View
        style={styles.toggleWrapper}
        accessibilityRole="tablist"
        accessibilityLabel="Planning view switcher"
        onLayout={({ nativeEvent }) => setToggleWidth(nativeEvent.layout.width)}
      >
        <Animated.View
          style={[
            styles.toggleIndicator,
            {
              width: indicatorSegment,
              opacity: toggleWidth ? 1 : 0,
              transform: [{ translateX: indicatorTranslate }],
            },
          ]}
          pointerEvents="none"
        />
        {TOGGLE_ITEMS.map((item) => {
          const isSelected = activeTab === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => handleSelectTab(item.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isSelected }}
              style={({ pressed }) => [
                styles.toggleOption,
                isSelected && styles.toggleOptionActive,
                pressed && !isSelected && styles.toggleOptionPressed,
              ]}
            >
              <Text
                style={[
                  styles.toggleOptionLabel,
                  isSelected && styles.toggleOptionLabelActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.toggleContent}>
        <Animated.View
          style={[
            styles.tabScene,
            styles.suggestionsContainer,
            activeTab !== "suggestions" && styles.tabSceneFloating,
            {
              opacity: tabProgress,
              transform: [{ translateY: suggestionsTranslate }],
            },
          ]}
          pointerEvents={activeTab === "suggestions" ? "auto" : "none"}
        >
          {!showStartPlanningCard ? (
            <>
              {bannerMessage ? (
                <Animated.View
                  style={[styles.suggestionBanner, { opacity: bannerOpacity }]}
                  accessibilityRole="text"
                  accessibilityLabel={`Suggestion: ${bannerMessage}`}
                  accessibilityLiveRegion="polite"
                >
                  <Text
                    style={styles.suggestionBannerText}
                    numberOfLines={1}
                  >
                    {bannerMessage}
                  </Text>
                </Animated.View>
              ) : null}
              <View style={styles.mealCard}>
                <View style={styles.mealHero}>
                  <Text style={styles.mealEmoji}>{meal?.emoji ?? "🍽️"}</Text>
                  <View style={styles.mealHeroDetails}>
                    <FlexGrid
                      gutterWidth={theme.space.md}
                      style={styles.mealHeroMetaGrid}
                    >
                      <FlexGrid.Row
                        alignItems="center"
                        justifyContent="flex-start"
                        style={styles.mealHeroMetaRow}
                      >
                        <FlexGrid.Col grow={0} style={styles.gridAutoCol}>
                          <View style={styles.metaItem}>
                            <MaterialCommunityIcons
                              name="star"
                              size={16}
                              color={theme.color.accent}
                            />
                            <Text style={styles.metaText}>{ratingLabel}</Text>
                          </View>
                        </FlexGrid.Col>
                        <FlexGrid.Col grow={0} style={styles.gridAutoCol}>
                          <View style={styles.metaItem}>
                            <Text style={styles.metaText}>{costLabel}</Text>
                          </View>
                        </FlexGrid.Col>
                        <FlexGrid.Col grow={0} style={styles.gridAutoCol}>
                          <View style={styles.metaItem}>
                            <MaterialCommunityIcons
                              name="circle"
                              size={14}
                              color={
                                theme.color[
                                  difficultyToThemeColor(
                                    mealDifficulty ?? "medium"
                                  )
                                ]
                              }
                            />
                            <Text style={styles.metaText}>
                              {mealDifficulty
                                ? difficultyToLabel[mealDifficulty]
                                : "--"}
                            </Text>
                          </View>
                        </FlexGrid.Col>
                      </FlexGrid.Row>
                    </FlexGrid>
                    <Text style={styles.lastServed}>
                      {formatLastServed(meal?.updatedAt)}
                    </Text>
                  </View>
                </View>
                <View style={styles.mealContent}>
                  <Text
                    ref={mealTitleRef}
                    style={styles.mealTitle}
                    numberOfLines={1}
                  >
                    {meal?.title ?? "No suggestion"}
                  </Text>
                  <Text style={styles.mealSubtitle} numberOfLines={2}>
                    {meal
                      ? "Suggested meal from your collection"
                      : "Use search or shuffle to pick a meal"}
                  </Text>
                </View>
              </View>

              <FlexGrid gutterWidth={theme.space.sm}>
                <FlexGrid.Row alignItems="center">
                  <FlexGrid.Col span={4}>
                    <PlannerActionButton
                      icon="check"
                      label="Add"
                      onPress={onAdd}
                      disabled={!meal}
                      styles={styles}
                    />
                  </FlexGrid.Col>
                  <FlexGrid.Col span={4}>
                    <PlannerActionButton
                      icon="shuffle"
                      label="Shuffle"
                      onPress={onShuffle}
                      disabled={!meal}
                      styles={styles}
                    />
                  </FlexGrid.Col>
                  <FlexGrid.Col span={4}>
                    <PlannerActionButton
                      icon="silverware-fork-knife"
                      label="Eat"
                      onPress={onEat}
                      disabled={!meal}
                      styles={styles}
                    />
                  </FlexGrid.Col>
                </FlexGrid.Row>
              </FlexGrid>
            </>
          ) : (
            <StartPlanningCard
              dayDisplayName={dayDisplayName}
              onGetSuggestions={handleDismissStartCard}
            />
          )}
        </Animated.View>

        <Animated.View
          style={[
            styles.tabScene,
            styles.pinsContainer,
            activeTab !== "pins" && styles.tabSceneFloating,
            {
              opacity: activeTab === "search" ? 0 : pinsOpacity,
              transform: [{ translateY: pinsTranslate }],
            },
          ]}
          pointerEvents={activeTab === "pins" ? "auto" : "none"}
        >
          <PinBoard
            dayKey={dayKey}
            title={`${dayDisplayName} Pins`}
            value={pins}
            onChange={onPinsChange}
            titleRef={pinsTitleRef}
          />
        </Animated.View>

        {activeTab === "search" ? (
          <View style={styles.searchTabCard}>
            <Text style={styles.searchTabTitle}>Search Meals</Text>
            <View style={styles.searchRow}>
              <MaterialCommunityIcons
                name="magnify"
                size={18}
                color={theme.color.subtleInk}
              />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search meals"
                placeholderTextColor={theme.color.subtleInk}
                value={searchQuery}
                onChangeText={onSearchQueryChange}
                returnKeyType="search"
                accessibilityLabel="Search meals input"
              />
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

type PlannerActionButtonProps = {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  styles: ReturnType<typeof createStyles>;
};

const PlannerActionButton = ({
  icon,
  label,
  onPress,
  disabled,
  styles,
}: PlannerActionButtonProps) => {
  const { theme } = useThemeController();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.actionButton,
        disabled && styles.actionButtonDisabled,
        pressed && !disabled && styles.actionButtonPressed,
      ]}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={18}
        color={disabled ? theme.color.subtleInk : theme.color.ink}
      />
      <Text
        style={[
          styles.actionButtonText,
          disabled && styles.actionButtonTextDisabled,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const difficultyToThemeColor = (difficulty: DifficultyKey) => {
  switch (difficulty) {
    case "easy":
      return "success" as const;
    case "hard":
      return "danger" as const;
    default:
      return "warning" as const;
  }
};

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    container: {
      gap: theme.space.lg,
    },
    dayTabs: {
      flexDirection: "row",
      justifyContent: "center",
    },
    dayTabActive: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      letterSpacing: 3,
    },
    dayTitle: {
      textAlign: "center",
      color: theme.color.ink,
      fontSize: theme.type.size.h1,
      fontWeight: theme.type.weight.bold,
    },
    toggleWrapper: {
      flexDirection: "row",
      position: "relative",
      backgroundColor: theme.color.surfaceAlt,
      borderRadius: theme.radius.full,
      padding: 4,
      gap: 4,
      marginTop: theme.space.md,
    },
    toggleIndicator: {
      position: "absolute",
      height: 3,
      bottom: 0,
      left: 4,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.accent,
    },
    toggleOption: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.full,
    },
    toggleOptionActive: {},
    toggleOptionPressed: {
      opacity: 0.8,
    },
    toggleOptionLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    toggleOptionLabelActive: {
      color: theme.color.accent,
    },
    toggleContent: {
      marginTop: theme.space.lg,
      gap: theme.space.lg,
      position: "relative",
    },
    tabScene: {
      width: "100%",
    },
    tabSceneFloating: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
    },
    suggestionsContainer: {
      gap: theme.space.lg,
    },
    pinsContainer: {
      gap: theme.space.lg,
    },
    searchTabCard: {
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      padding: theme.space.lg,
      gap: theme.space.md,
    },
    searchTabTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
    },
    searchInput: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    suggestionBanner: {
      borderRadius: theme.radius.lg,
      backgroundColor: "#075a4f",
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.md,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    suggestionBannerText: {
      color: "#3fe2c3",
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
      flex: 1,
    },
    gridAutoCol: {
      flexBasis: "auto",
      flexGrow: 0,
    },
    mealCard: {
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      overflow: "hidden",
    },
    mealHero: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
      paddingVertical: theme.space.lg,
      paddingHorizontal: theme.space.lg,
      gap: theme.space.md,
    },
    mealHeroDetails: {
      alignSelf: "stretch",
      alignItems: "flex-start",
      gap: theme.space.xs,
    },
    mealEmoji: {
      fontSize: 64,
    },
    mealHeroMetaGrid: {
      width: "100%",
    },
    mealHeroMetaRow: {
      columnGap: theme.space.sm,
    },
    mealContent: {
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.lg,
      gap: theme.space.sm,
    },
    mealTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    mealSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    metaItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
    },
    metaText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    lastServed: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      textAlign: "center",
    },
    actionButton: {
      flex: 1,
      width: "100%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      paddingVertical: theme.space.sm,
    },
    actionButtonDisabled: {
      opacity: 0.5,
    },
    actionButtonPressed: {
      opacity: 0.85,
    },
    actionButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    actionButtonTextDisabled: {
      color: theme.color.subtleInk,
    },
  });
