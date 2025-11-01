import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ReactNode, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Meal } from "../../types/meals";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";

type Props = {
  dayLabel: string;
  meal?: Meal;
  rightSlot?: ReactNode;
  labelOverride?: string;
  emojiOverride?: string;
  iconOverride?: string;
  isFreezer?: boolean;
};

export default function WeekDayListItem({
  dayLabel,
  meal,
  rightSlot,
  labelOverride,
  emojiOverride,
  iconOverride,
  isFreezer = false,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const title = labelOverride ?? meal?.title ?? "Unassigned";
  const emoji = emojiOverride ?? meal?.emoji ?? "🍽️";

  const leadingVisual = iconOverride ? (
    <MaterialCommunityIcons
      name={iconOverride as any}
      size={20}
      color={theme.color.ink}
      style={styles.icon}
      accessibilityLabel={`${title} status icon`}
    />
  ) : (
    <Text style={styles.emoji} accessibilityLabel={`${title} meal`}>
      {emoji}
    </Text>
  );

  return (
    <View style={styles.row}>
      <Text style={styles.day}>{dayLabel}</Text>
      <View style={styles.mealInfo}>
        {leadingVisual}
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {isFreezer ? (
            <MaterialCommunityIcons
              name="snowflake"
              size={14}
              color={theme.color.accent}
            />
          ) : null}
        </View>
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
    icon: {
      width: 20,
      textAlign: "center",
    },
    title: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    titleRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
    },
    rightSlot: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
  });
