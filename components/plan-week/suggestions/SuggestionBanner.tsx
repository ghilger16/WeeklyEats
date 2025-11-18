import { Animated, StyleSheet, Text } from "react-native";
import { useMemo } from "react";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";

type Props = {
  message: string | null;
  opacity: Animated.Value;
  variant?: "full" | "hero";
};

const SuggestionBanner = ({ message, opacity, variant = "full" }: Props) => {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  if (!message) {
    return null;
  }

  const bannerStyle =
    variant === "hero" ? [styles.banner, styles.heroBanner] : styles.banner;

  return (
    <Animated.View
      style={[bannerStyle, { opacity }]}
      accessibilityRole="text"
      accessibilityLabel={`Suggestion: ${message}`}
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text} numberOfLines={1}>
        {message}
      </Text>
    </Animated.View>
  );
};

export default SuggestionBanner;

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    banner: {
      backgroundColor: "#075a4f",
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.sm,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    heroBanner: {
      borderRadius: 0,
      alignSelf: "stretch",
    },
    text: {
      color: "#3fe2c3",
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
      flex: 1,
    },
  });
