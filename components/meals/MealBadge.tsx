import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";

type MealBadgeVariant = "family" | "galaxy";

type MealBadgeProps = {
  variant: MealBadgeVariant;
  style?: ViewStyle;
  onPress?: () => void;
};

export const MealBadge = ({ variant, style, onPress }: MealBadgeProps) => {
  const { theme } = useThemeController();
  const isGalaxy = variant === "galaxy";

  const basePill = (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: isGalaxy
            ? "#1B1D2B"
            : theme.color.surfaceAlt ?? "#1F1B2E",
          borderColor: isGalaxy ? "#7055FF66" : "#F8D47A66",
        },
      ]}
    >
      <Text style={[styles.icon, { color: "#F8D47A" }]}>
        {isGalaxy ? "🌌" : "⭐"}
      </Text>
      <Text
        style={[
          styles.label,
          {
            color: "#F8D47A",
          },
        ]}
      >
        {isGalaxy ? "Galaxy Meal" : "Family Star"}
      </Text>
    </View>
  );

  if (!isGalaxy) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Family Star meal"
        style={style}
      >
        {basePill}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Galaxy Meal"
      style={style}
    >
      <View style={styles.galaxyWrap}>
        <LinearGradient
          colors={["#0C1445", "#5B2A86", "#1DA8A4"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.galaxyBorder}
        />
        <View style={styles.galaxyInner}>{basePill}</View>
        <LinearGradient
          colors={["#1DA8A455", "transparent"]}
          style={styles.glow}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 6,
    overflow: "hidden",
  },
  icon: {
    fontSize: 13,
    marginRight: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
  },
  galaxyWrap: {
    borderRadius: 999,
    position: "relative",
  },
  galaxyBorder: {
    position: "absolute",
    inset: 0,
    borderRadius: 999,
  },
  galaxyInner: {
    borderRadius: 999,
    margin: 2,
    backgroundColor: "transparent",
  },
  glow: {
    position: "absolute",
    inset: -6,
    borderRadius: 999,
    opacity: 0.4,
  },
});
