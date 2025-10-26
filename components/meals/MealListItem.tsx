import { MaterialCommunityIcons } from "@expo/vector-icons";
import { memo, useRef } from "react";
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
import { darkTheme } from "../../styles/theme";
import { Meal } from "../../types/meals";
import RatingStars from "./RatingStars";
import { FlexGrid } from "../../styles/flex-grid";

type Props = {
  meal: Meal;
  onPress: () => void;
  onLongPress: () => void;
  style?: StyleProp<ViewStyle>;
};

const theme = darkTheme;

const MealListItem = memo(function MealListItem({
  meal,
  onPress,
  onLongPress,
  style,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (value: number) => {
    Animated.timing(scale, {
      toValue: value,
      duration: theme.motion.duration.fast,
      useNativeDriver: true,
    }).start();
  };

  const handlePressIn = () => animateTo(0.98);
  const handlePressOut = () => animateTo(1);

  const costLabel = "$".repeat(meal.plannedCostTier);

  const combinedStyle = ({
    pressed,
  }: PressableStateCallbackType): StyleProp<ViewStyle> => [
    styles.card,
    pressed && styles.cardPressed,
    style,
  ];

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale }] }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${meal.title} meal`}
        testID={`meal-item-${meal.id}`}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        onLongPress={onLongPress}
        style={combinedStyle}
      >
        <FlexGrid gutterWidth={theme.space.lg}>
          <FlexGrid.Row alignItems="center" wrap={false}>
            <FlexGrid.Col span={2} grow={0}>
              <Text style={styles.emoji} accessible accessibilityRole="image">
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
  );
});

const styles = StyleSheet.create({
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
  cardPressed: {
    borderColor: theme.color.accent,
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
});

export default MealListItem;
