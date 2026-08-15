import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { alpha, WeeklyTheme } from "../../styles/theme";

type Props = {
  dateLabel: string;
  startsLabel: string;
  dinnerCount: number;
  onViewGroceryList: () => void;
};

export default function UpcomingWeekReadyCard({
  dateLabel,
  startsLabel,
  dinnerCount,
  onViewGroceryList,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 380,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const dinnerLabel = `${dinnerCount} ${
    dinnerCount === 1 ? "dinner" : "dinners"
  } planned`;

  return (
    <Animated.View
      style={[
        styles.card,
        {
          opacity: entrance,
          transform: [
            {
              translateY: entrance.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.topRow}>
        <Text style={styles.date}>{dateLabel}</Text>
        <View style={styles.checkWrap}>
          <MaterialCommunityIcons
            name="check"
            size={22}
            color={theme.color.success}
          />
        </View>
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>Next week is ready</Text>
        <Text style={styles.subtitle}>{startsLabel}</Text>
        <Text style={styles.summary}>
          {dinnerLabel} · Grocery list ready
        </Text>
      </View>
      <Pressable
        onPress={onViewGroceryList}
        accessibilityRole="button"
        accessibilityLabel="View next week grocery list"
        style={({ pressed }) => [
          styles.groceryAction,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.groceryActionText}>View Grocery List</Text>
        <MaterialCommunityIcons
          name="arrow-right"
          size={18}
          color={theme.color.accent}
        />
      </Pressable>
    </Animated.View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    card: {
      height: 255,
      padding: theme.space.lg,
      gap: theme.space.lg,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: alpha(theme.color.success, 0.5),
      backgroundColor: theme.color.surface,
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    date: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      letterSpacing: 0.8,
      textTransform: "uppercase",
    },
    checkWrap: {
      width: 38,
      height: 38,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      backgroundColor: alpha(theme.color.success, 0.12),
    },
    copy: {
      flex: 1,
      justifyContent: "center",
      gap: theme.space.xs,
    },
    title: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
    },
    subtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
    },
    summary: {
      marginTop: theme.space.xs,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    groceryAction: {
      minHeight: 36,
      alignSelf: "flex-start",
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
      paddingRight: theme.space.sm,
    },
    groceryActionText: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    pressed: { opacity: 0.7 },
  });
