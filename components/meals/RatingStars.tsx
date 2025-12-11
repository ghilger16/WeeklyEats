import { MaterialCommunityIcons } from "@expo/vector-icons";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";

type Props = {
  value?: number;
  size?: number;
  onChange?: (value: number) => void;
  gap?: number;
};

const RatingStars = memo(function RatingStars({
  value = 0,
  size = 18,
  onChange,
  gap,
}: Props) {
  const { theme } = useThemeController();
  const isInteractive = typeof onChange === "function";
  const clampedValue = Math.max(0, Math.min(5, Math.round(value ?? 0)));
  const spacing = gap ?? theme.space.xs;

  const containerAccessibilityProps = isInteractive
    ? {}
    : {
        accessible: true,
        accessibilityRole: "image" as const,
      };

  return (
    <View style={styles.row} {...containerAccessibilityProps}>
      {Array.from({ length: 5 }).map((_, index) => {
        const starValue = index + 1;
        const filled = index < clampedValue;
        const spacingStyle = index < 4 ? { marginRight: spacing } : null;
        const icon = (
          <MaterialCommunityIcons
            name={filled ? "star" : "star-outline"}
            size={size}
            color={filled ? theme.color.accent : theme.color.subtleInk}
            accessibilityLabel={filled ? "Filled star" : "Empty star"}
          />
        );

        if (!isInteractive) {
          return (
            <View
              key={starValue}
              style={[styles.star, spacingStyle]}
              pointerEvents="none"
            >
              {icon}
            </View>
          );
        }

        const starLabel = `Set rating to ${starValue} ${
          starValue === 1 ? "star" : "stars"
        }`;

        return (
          <Pressable
            key={starValue}
            onPress={() => onChange?.(starValue)}
            accessibilityRole="button"
            accessibilityLabel={starLabel}
            accessibilityState={{ selected: clampedValue === starValue }}
            hitSlop={{
              top: theme.space.xs,
              bottom: theme.space.xs,
              left: theme.space.xs,
              right: theme.space.xs,
            }}
            style={[styles.star, spacingStyle]}
          >
            {icon}
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  star: {
    justifyContent: "center",
    alignItems: "center",
  },
});

export default RatingStars;
