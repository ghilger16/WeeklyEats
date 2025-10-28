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

type Props = {
  meal: Meal;
  onPress: () => void;
  onDelete: () => void;
  style?: StyleProp<ViewStyle>;
};

const MealListItem = memo(function MealListItem({
  meal,
  onPress,
  onDelete,
  style,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const scale = useRef(new Animated.Value(1)).current;
  const swipeableRef = useRef<Swipeable | null>(null);
  const pressDuration = theme.motion.duration.fast;

  const animateTo = (value: number) => {
    Animated.timing(scale, {
      toValue: value,
      duration: pressDuration,
      useNativeDriver: true,
    }).start();
  };

  const handlePressIn = () => animateTo(0.98);
  const handlePressOut = () => animateTo(1);

  const handleDeletePress = () => {
    swipeableRef.current?.close();
    onDelete();
  };

  const costLabel = "$".repeat(meal.plannedCostTier);

  const combinedStyle = ({
    pressed,
  }: PressableStateCallbackType): StyleProp<ViewStyle> => [styles.card, style];

  const renderRightActions = () => (
    <RectButton
      style={styles.deleteAction}
      onPress={handleDeletePress}
      accessibilityRole="button"
      accessibilityLabel={`Delete ${meal.title}`}
    >
      <MaterialCommunityIcons
        name="trash-can"
        size={24}
        color={theme.color.ink}
      />
      <Text style={styles.deleteActionText}>Delete</Text>
    </RectButton>
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${meal.title} meal`}
            testID={`meal-item-${meal.id}`}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            onPress={onPress}
            style={combinedStyle}
          >
            <FlexGrid gutterWidth={theme.space.lg}>
              <FlexGrid.Row alignItems="center" wrap={false}>
                <FlexGrid.Col span={2} grow={0}>
                  <Text
                    style={styles.emoji}
                    accessible
                    accessibilityRole="image"
                  >
                    {meal.emoji}
                  </Text>
                </FlexGrid.Col>
                <FlexGrid.Col span={7} grow={1}>
                  <View style={styles.details}>
                    <Text style={styles.title}>{meal.title}</Text>
                    <RatingStars value={meal.rating} size={16} />
                  </View>
                </FlexGrid.Col>
                <FlexGrid.Col span={3} grow={0}>
                  <View style={styles.meta}>
                    <Text style={styles.cost}>{costLabel}</Text>
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
              </FlexGrid.Row>
            </FlexGrid>
          </Pressable>
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
    emoji: {
      fontSize: 28,
    },
    details: {
      flex: 1,
    },
    title: {
      color: theme.color.ink,
      fontSize: 18,
      fontWeight: theme.type.weight.bold,
      marginBottom: theme.space.xs,
    },
    meta: {
      alignItems: "flex-end",
      justifyContent: "center",
      gap: theme.space.xs,
      minWidth: 48,
    },
    cost: {
      color: theme.color.success,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
      textAlign: "right",
    },
    deleteAction: {
      backgroundColor: theme.color.danger,
      justifyContent: "center",
      alignItems: "center",
      width: 88,
      borderRadius: theme.radius.lg,
      marginLeft: theme.space.sm,
      paddingVertical: theme.space.sm,
      gap: theme.space.xs,
    },
    deleteActionText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
  });

export default MealListItem;
