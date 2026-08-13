import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useMemo, useRef } from "react";
import {
  Animated,
  Pressable,
  PressableStateCallbackType,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import {
  GestureHandlerRootView,
  RectButton,
  Swipeable,
} from "react-native-gesture-handler";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { Meal } from "../../types/meals";
import { FlexGrid } from "../../styles/flex-grid";
import RatingStars from "./RatingStars";
import { useFamilyMembers } from "../../hooks/useFamilyMembers";
import { getFamilyRatingSummary } from "../../utils/familyRatings";

type Props = {
  meal: Meal;
  onPress: () => void;
  onDelete: () => void;
  style?: StyleProp<ViewStyle>;
  isFreezer?: boolean;
  onFreezerPress?: () => void;
  onRemoveFromFreezer?: () => void;
  onSuggestNextWeek?: () => void;
  isGalaxyMeal?: boolean;
  displayOptions?: {
    showDifficulty?: boolean;
    showExpense?: boolean;
    showServed?: boolean;
    ratingMode?: "family" | "summary" | "off";
    showEmoji?: boolean;
  };
};

type DifficultyColorKey = "success" | "warning" | "danger";
type MealCardVariant = "standard" | "familyStar" | "galaxy";

const clampDifficulty = (value: number) =>
  Math.min(Math.max(Math.round(value), 1), 5);

const resolveDifficultyColorKey = (
  difficulty: number | undefined
): DifficultyColorKey | undefined => {
  if (typeof difficulty !== "number" || Number.isNaN(difficulty)) {
    return undefined;
  }

  const clamped = clampDifficulty(difficulty);
  if (clamped <= 2) {
    return "success";
  }
  if (clamped >= 4) {
    return "danger";
  }
  return "warning";
};

const MealListItem = memo(function MealListItem({
  meal,
  onPress,
  onDelete,
  style,
  isFreezer = false,
  onFreezerPress,
  onRemoveFromFreezer,
  onSuggestNextWeek,
  isGalaxyMeal = false,
  displayOptions,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { members } = useFamilyMembers();
  const scale = useRef(new Animated.Value(1)).current;
  const swipeableRef = useRef<Swipeable | null>(null);
  const pressDuration = theme.motion.duration.fast;

  const freezerAmountRaw = meal.freezerAmount ?? meal.freezerQuantity ?? "";
  const freezerAmount = freezerAmountRaw.trim();
  const freezerUnit = meal.freezerUnit ?? "";
  const hasFreezerAmount = freezerAmount.length > 0;
  const freezerDisplay = hasFreezerAmount
    ? `${freezerAmount}${freezerUnit ? ` ${freezerUnit}` : ""}`
    : "";

  const formatFreezerDate = (iso?: string) => {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const freezerDateLabel = formatFreezerDate(meal.freezerAddedAt);

  const animateTo = (value: number) => {
    Animated.timing(scale, {
      toValue: value,
      duration: pressDuration,
      useNativeDriver: true,
    }).start();
  };

  const handlePressIn = () => {
    if (!isFreezer) {
      animateTo(0.98);
    }
  };

  const handlePressOut = () => {
    if (!isFreezer) {
      animateTo(1);
    }
  };

  const handleDeletePress = () => {
    swipeableRef.current?.close();
    if (isFreezer && onRemoveFromFreezer) {
      onRemoveFromFreezer();
      return;
    }
    onDelete();
  };

  const handlePress = () => {
    if (isFreezer) {
      if (onFreezerPress) {
        onFreezerPress();
        return;
      }
    }
    onPress();
  };

  const handleSuggestNextWeekPress = () => {
    swipeableRef.current?.close();
    onSuggestNextWeek?.();
  };

  const resolveExpenseTier = () => {
    if (typeof meal.expense === "number") {
      if (meal.expense <= 2) {
        return 1;
      }
      if (meal.expense >= 4) {
        return 3;
      }
      return 2;
    }

    return Math.min(Math.max(meal.plannedCostTier ?? 2, 1), 3);
  };

  const expenseTier = resolveExpenseTier();
  const expenseLabel =
    expenseTier === 1 ? "cheap" : expenseTier === 2 ? "medium" : "pricey";
  const costLabel = "$".repeat(expenseTier);
  const difficultyColorKey = resolveDifficultyColorKey(meal.difficulty);
  const difficultyColor = difficultyColorKey
    ? theme.color[difficultyColorKey]
    : undefined;
  const servedCount =
    typeof meal.servedCount === "number" ? meal.servedCount : 0;

  const showDifficulty = displayOptions?.showDifficulty ?? true;
  const showExpense = displayOptions?.showExpense ?? true;
  const ratingMode = displayOptions?.ratingMode ?? "family";
  const showRatings = ratingMode !== "off";
  const showServed = displayOptions?.showServed ?? true;
  const showEmoji = displayOptions?.showEmoji ?? true;

  const renderRightActions = () => (
    <View style={styles.swipeActions}>
      <RectButton
        style={[styles.swipeAction, styles.deleteAction]}
        onPress={handleDeletePress}
        accessibilityRole="button"
        accessibilityLabel={
          isFreezer
            ? `Remove ${meal.title} from freezer`
            : `Delete ${meal.title}`
        }
      >
        <MaterialCommunityIcons
          name={isFreezer ? "close-circle" : "trash-can"}
          size={24}
          color={theme.color.ink}
        />
        <Text style={styles.deleteActionText}>
          {isFreezer ? "Remove" : "Delete"}
        </Text>
      </RectButton>
      {onSuggestNextWeek ? (
        <RectButton
          style={[styles.swipeAction, styles.suggestAction]}
          onPress={handleSuggestNextWeekPress}
          accessibilityRole="button"
          accessibilityLabel={`Suggest ${meal.title} for next week`}
        >
          <MaterialCommunityIcons
            name="calendar-plus"
            size={24}
            color={theme.color.accent}
          />
          <Text style={styles.suggestActionText}>Suggest</Text>
        </RectButton>
      ) : null}
    </View>
  );

  const familySummary = useMemo(() => {
    if (members.length <= 1) return null;
    return getFamilyRatingSummary(
      meal.familyRatings,
      members.map((member) => member.id)
    );
  }, [meal.familyRatings, members]);
  const isFamilyStar = useMemo(() => {
    if (
      members.length > 1 &&
      (meal as Meal & { isFamilyStar?: boolean }).isFamilyStar === true
    ) {
      return true;
    }
    return familySummary?.isUnanimousHeart ?? false;
  }, [familySummary, meal, members.length]);

  const shouldUseFamilyStarStyle = isFamilyStar && !isGalaxyMeal;
  const cardVariant: MealCardVariant = ratingMode !== "family"
    ? "standard"
    : isGalaxyMeal
    ? "galaxy"
    : shouldUseFamilyStarStyle
    ? "familyStar"
    : "standard";

  const combinedStyle = ({
    pressed,
  }: PressableStateCallbackType): StyleProp<ViewStyle> => [
    styles.card,
    isFreezer && styles.freezerCard,
    cardVariant === "familyStar" && styles.familyStarCard,
    cardVariant === "galaxy" && styles.galaxyCard,
    style,
  ];

  const cardBody = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meal.title} ${
        isFreezer ? "freezer item" : "meal"
      }`}
      testID={`meal-item-${meal.id}`}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={combinedStyle}
    >
      <View
        style={[
          cardVariant === "galaxy" && styles.galaxyContent,
          cardVariant === "familyStar" && styles.familyStarContent,
        ]}
      >
        <FlexGrid gutterWidth={theme.space.lg}>
          <FlexGrid.Row alignItems="center" wrap={false}>
            {showEmoji ? (
              <FlexGrid.Col span={2} grow={0}>
                <Text style={styles.emoji} accessible accessibilityRole="image">
                  {meal.emoji ?? "🍽️"}
                </Text>
              </FlexGrid.Col>
            ) : null}
            {isFreezer ? (
              <FlexGrid.Col grow={1}>
                <View style={styles.freezerDetails}>
                  {hasFreezerAmount ? (
                    <Text
                      style={styles.freezerAmount}
                      accessibilityLabel={`Freezer amount ${freezerDisplay}`}
                    >
                      {freezerDisplay}
                    </Text>
                  ) : null}
                  <Text
                    style={[styles.title, styles.freezerTitle]}
                    numberOfLines={2}
                  >
                    {meal.title}
                  </Text>
                  {freezerDateLabel ? (
                    <Text style={styles.freezerDate}>
                      Added {freezerDateLabel}
                    </Text>
                  ) : null}
                </View>
              </FlexGrid.Col>
            ) : (
              <>
                <FlexGrid.Col span={showEmoji ? 7 : 9} grow={1}>
                  <View style={styles.details}>
                    <Text
                      style={styles.title}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.85}
                      ellipsizeMode="tail"
                    >
                      {meal.title}
                    </Text>
                    {showRatings ? (
                      ratingMode === "family" && members.length > 1 ? (
                        isFamilyStar ? (
                          isGalaxyMeal ? (
                            <View style={styles.galaxyMealLabelRow}>
                              <MaterialCommunityIcons name="creation" size={16} color="#8B5CF6" />
                              <Text style={styles.galaxyMealLabel}>Galaxy Meal</Text>
                            </View>
                          ) : (
                            <Text style={styles.familyStarLabel}>⭐ Family Star</Text>
                          )
                        ) : familySummary ? (
                          <Text style={styles.familySummary}>
                            ⭐ {familySummary.average.toFixed(1)}
                          </Text>
                        ) : (
                          <Text style={styles.notYetRated}>Not yet rated</Text>
                        )
                      ) : (
                        <RatingStars
                          value={meal.rating ?? 0}
                          size={16}
                          gap={0}
                        />
                      )
                    ) : null}
                    {showServed ? (
                      <Text
                        style={styles.servedCount}
                      >
                        Served {servedCount}{" "}
                        {servedCount === 1 ? "time" : "times"}
                      </Text>
                    ) : null}
                  </View>
                </FlexGrid.Col>
                <FlexGrid.Col span={3} grow={0}>
                  <View style={styles.meta}>
                    {showDifficulty && difficultyColor ? (
                      <View
                        style={[
                          styles.difficultyDot,
                          { backgroundColor: difficultyColor },
                        ]}
                        accessibilityLabel="Meal difficulty indicator"
                        accessible
                      />
                    ) : null}
                    {showExpense ? (
                      <Text
                        style={styles.cost}
                        accessibilityLabel={`Expense ${expenseLabel}`}
                      >
                        {costLabel}
                      </Text>
                    ) : null}
                    {meal.locked ? (
                      <MaterialCommunityIcons
                        name="lock"
                        size={18}
                        color={theme.color.subtleInk}
                        accessibilityLabel="Meal locked"
                      />
                    ) : null}
                  </View>
                </FlexGrid.Col>
              </>
            )}
          </FlexGrid.Row>
        </FlexGrid>
      </View>
    </Pressable>
  );

  return (
    <GestureHandlerRootView style={styles.gestureRoot}>
      <Swipeable
        ref={(ref: Swipeable | null) => {
          swipeableRef.current = ref;
        }}
        friction={2}
        rightThreshold={64}
        renderRightActions={renderRightActions}
      >
        <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
          {cardVariant === "galaxy" ? (
            <LinearGradient
              colors={["#7C4DFF", "#3B82F6", "#22D3EE"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.galaxyBorder}
            >
              {cardBody}
            </LinearGradient>
          ) : cardVariant === "familyStar" ? (
            <LinearGradient
              colors={["#F6D365", "#F2D15B", "#FFD700"]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.familyStarBorder}
            >
              {cardBody}
            </LinearGradient>
          ) : (
            cardBody
          )}
        </Animated.View>
      </Swipeable>
    </GestureHandlerRootView>
  );
});

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    gestureRoot: {
      flex: 1,
      borderRadius: theme.radius.lg,
    },
    wrapper: {
      borderRadius: theme.radius.lg,
    },
    card: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.md,
      minHeight: 72,
    },
    familyStarCard: {
      position: "relative",
      overflow: "hidden",
      backgroundColor: theme.color.surface,
      borderWidth: 0,
    },
    familyStarBorder: {
      borderRadius: theme.radius.lg,
      padding: 1,
      overflow: "hidden",
      shadowColor: "#D6A900",
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    familyStarContent: {
      position: "relative",
      zIndex: 1,
    },
    familySparkle: {
      position: "absolute",
      color: "#F2D15B",
      opacity: 0.32,
      zIndex: 0,
    },
    familySparkleOne: {
      top: 10,
      right: 22,
      fontSize: 20,
    },
    familySparkleTwo: {
      bottom: 12,
      left: 28,
      fontSize: 18,
    },
    familySparkleThree: {
      top: 14,
      left: 70,
      fontSize: 12,
    },
    familySparkleFour: {
      top: 36,
      left: 42,
      fontSize: 11,
      opacity: 0.26,
    },
    familySparkleFive: {
      bottom: 22,
      left: 74,
      fontSize: 10,
      opacity: 0.24,
    },
    familyStarWatermark: {
      position: "absolute",
      right: 20,
      top: "50%",
      marginTop: -30,
      color: "#F2D15B",
      fontSize: 78,
      opacity: 0.2,
      zIndex: 0,
    },
    galaxyBorder: {
      borderRadius: theme.radius.lg,
      padding: 1,
      overflow: "hidden",
    },
    galaxyCard: {
      position: "relative",
      overflow: "hidden",
      backgroundColor: theme.color.surface,
      borderWidth: 0,
    },
    galaxyContent: {
      position: "relative",
      zIndex: 1,
    },
    galaxyStar: {
      position: "absolute",
      width: 2,
      height: 2,
      borderRadius: 1,
      backgroundColor: "rgba(255,255,255,0.78)",
      zIndex: 0,
    },
    galaxyStarOne: {
      top: "18%",
      left: "22%",
    },
    galaxyStarTwo: {
      top: "34%",
      left: "54%",
      opacity: 0.48,
    },
    galaxyStarThree: {
      top: "62%",
      right: "26%",
      opacity: 0.7,
    },
    galaxyStarFour: {
      bottom: "22%",
      left: "42%",
      opacity: 0.52,
    },
    galaxyStarFive: {
      top: "18%",
      right: "14%",
      opacity: 0.58,
    },
    galaxyGlow: {
      position: "absolute",
      right: "10%",
      top: "20%",
      width: 132,
      height: 58,
      borderRadius: theme.radius.full,
      backgroundColor: "rgba(59, 130, 246, 0.18)",
      transform: [{ rotate: "-18deg" }],
      zIndex: 0,
    },
    emoji: {
      fontSize: 28,
    },
    details: {
      flex: 1,
    },
    galaxyMealLabelRow: { flexDirection: "row", alignItems: "center", gap: theme.space.xs, marginTop: theme.space.xs },
    galaxyMealLabel: { color: "#8B5CF6", fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold },
    title: {
      color: theme.color.ink,
      fontSize: 18,
      fontWeight: theme.type.weight.bold,
      marginBottom: theme.space.xs,
    },
    galaxyTitle: {
      color: "#FFFFFF",
      textShadowColor: "rgba(0,0,0,0.5)",
      textShadowRadius: 4,
    },
    familySummary: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      marginTop: theme.space.xs,
    },
    familyStarLabel: {
      color: "#FEC107",
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      marginTop: theme.space.xs,
    },
    servedCount: {
      marginTop: theme.space.xs,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    notYetRated: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    galaxySecondaryText: {
      color: "rgba(255,255,255,0.68)",
    },
    meta: {
      alignItems: "flex-end",
      justifyContent: "center",
      gap: theme.space.xs,
      minWidth: 48,
    },
    freezerCard: {
      paddingVertical: theme.space.md,
    },
    freezerDetails: {
      alignItems: "center",
      gap: theme.space.xs,
      width: "100%",
    },
    freezerAmount: {
      color: theme.color.accent,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    freezerTitle: {
      textAlign: "center",
      marginBottom: 0,
    },
    freezerDate: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
    },
    difficultyDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radius.full,
    },
    cost: {
      color: theme.color.success,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
      textAlign: "right",
    },
    swipeActions: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: theme.space.sm,
      marginLeft: theme.space.sm,
    },
    swipeAction: {
      backgroundColor: theme.color.surface,
      justifyContent: "center",
      alignItems: "center",
      width: 96,
      borderRadius: theme.radius.lg,
      paddingVertical: theme.space.sm,
      gap: theme.space.xs,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
    },
    suggestAction: {
      backgroundColor: theme.color.surfaceAlt,
    },
    suggestActionText: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    deleteAction: {},
    deleteActionText: {
      color: theme.color.danger,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
  });

export default MealListItem;
