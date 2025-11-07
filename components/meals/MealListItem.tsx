import { MaterialCommunityIcons } from "@expo/vector-icons";
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
import FamilyRatingIcons from "./FamilyRatingIcons";
import { MealBadge } from "./MealBadge";
import { useFamilyMembers } from "../../hooks/useFamilyMembers";

type Props = {
  meal: Meal;
  onPress: () => void;
  onDelete: () => void;
  style?: StyleProp<ViewStyle>;
  isFreezer?: boolean;
  onFreezerPress?: () => void;
  onRemoveFromFreezer?: () => void;
  servedRank?: number;
};

type DifficultyColorKey = "success" | "warning" | "danger";

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
  servedRank,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { members } = useFamilyMembers();
  const hasFamilyMembers = members.length > 0;
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
  const shouldShowServedCount = meal.showServedCount;

  const combinedStyle = ({
    pressed,
  }: PressableStateCallbackType): StyleProp<ViewStyle> => [
    styles.card,
    isFreezer && styles.freezerCard,
    isFamilyStar && styles.familyStarCard,
    style,
  ];

  const renderRightActions = () => (
    <RectButton
      style={styles.deleteAction}
      onPress={handleDeletePress}
      accessibilityRole="button"
      accessibilityLabel={
        isFreezer ? `Remove ${meal.title} from freezer` : `Delete ${meal.title}`
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
  );

  const { isFamilyStar } = useMemo(() => {
    if (!hasFamilyMembers || !meal.familyRatings) {
      return { isFamilyStar: false };
    }
    const mapped = Object.values(meal.familyRatings)
      .map((value) => {
        if (value === 3) return 5;
        if (value === 2) return 3;
        if (value === 1) return 1;
        return 0;
      })
      .filter((value) => value > 0);
    if (mapped.length === 0) {
      return { isFamilyStar: false };
    }
    return {
      isFamilyStar: mapped.every((value) => value === 5),
    };
  }, [hasFamilyMembers, meal.familyRatings]);

  const isGalaxyMeal =
    isFamilyStar &&
    typeof servedRank === "number" &&
    servedRank > 0 &&
    servedRank <= 5;

  const familyRatingsNode = hasFamilyMembers ? (
    <FamilyRatingIcons
      ratings={meal.familyRatings}
      showNames={false}
      size={24}
      singleRow
      gap={theme.space.xs}
    />
  ) : null;

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
      <FlexGrid gutterWidth={theme.space.lg}>
        <FlexGrid.Row alignItems="center" wrap={false}>
          <FlexGrid.Col span={2} grow={0}>
            <Text style={styles.emoji} accessible accessibilityRole="image">
              {meal.emoji}
            </Text>
          </FlexGrid.Col>
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
              <FlexGrid.Col span={7} grow={1}>
                <View style={styles.details}>
                  <Text style={styles.title}>{meal.title}</Text>
                  {isFamilyStar ? (
                    <MealBadge
                      variant={isGalaxyMeal ? "galaxy" : "family"}
                      style={styles.badge}
                    />
                  ) : (
                    familyRatingsNode ?? (
                      <RatingStars value={meal.rating ?? 0} size={16} gap={0} />
                    )
                  )}
                  {shouldShowServedCount ? (
                    <Text style={styles.servedCount}>
                      Served {servedCount}{" "}
                      {servedCount === 1 ? "time" : "times"}
                    </Text>
                  ) : null}
                </View>
              </FlexGrid.Col>
              <FlexGrid.Col span={3} grow={0}>
                <View style={styles.meta}>
                  {difficultyColor ? (
                    <View
                      style={[
                        styles.difficultyDot,
                        { backgroundColor: difficultyColor },
                      ]}
                      accessibilityLabel="Meal difficulty indicator"
                      accessible
                    />
                  ) : null}
                  <Text
                    style={styles.cost}
                    accessibilityLabel={`Expense ${expenseLabel}`}
                  >
                    {costLabel}
                  </Text>
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
          {isFamilyStar ? (
            <View style={styles.starBorder}>{cardBody}</View>
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
      borderWidth: 0,
    },
    emoji: {
      fontSize: 28,
    },
    details: {
      flex: 1,
    },
    badge: {
      alignSelf: "flex-start",
      marginTop: theme.space.xs,
    },
    starBorder: {
      borderRadius: theme.radius.lg + 6,
      padding: 2,
      borderWidth: 2,
      borderColor: "#f3c977",
    },
    title: {
      color: theme.color.ink,
      fontSize: 18,
      fontWeight: theme.type.weight.bold,
      marginBottom: theme.space.xs,
    },
    servedCount: {
      marginTop: theme.space.xs,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
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
    deleteAction: {
      backgroundColor: theme.color.surface,
      justifyContent: "center",
      alignItems: "center",
      width: 104,
      borderRadius: theme.radius.lg,
      marginLeft: theme.space.sm,
      paddingVertical: theme.space.sm,
      gap: theme.space.xs,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
    },
    deleteActionText: {
      color: theme.color.danger,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
  });

export default MealListItem;
