import { ReactNode, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Meal } from "../../types/meals";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";

type Props = {
  dayLabel: string;
  meal?: Meal;
  rightSlot?: ReactNode;
};

export default function WeekDayListItem({ dayLabel, meal, rightSlot }: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <View style={styles.row}>
      <Text style={styles.day}>{dayLabel}</Text>
      <View style={styles.mealInfo}>
        <Text style={styles.emoji} accessibilityLabel={`${meal?.title} meal`}>
          {meal?.emoji ?? "🍽️"}
        </Text>
        <Text style={styles.title} numberOfLines={1}>
          {meal?.title ?? "Unassigned"}
        </Text>
      </View>
      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: theme.space.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.color.border,
      gap: theme.space.md,
    },
    day: {
      width: 54,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      letterSpacing: 1,
    },
    mealInfo: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    emoji: {
      fontSize: 20,
    },
    title: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    rightSlot: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
  });

