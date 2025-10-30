import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import WeekDayListItem from "./WeekDayListItem";
import { WeekPlanDay } from "../../hooks/useCurrentWeekPlan";

type Props = {
  days: WeekPlanDay[];
  title?: string;
};

export default function CurrentWeekList({
  days: rawDays,
  title = "Current Week",
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const days = useMemo(
    () =>
      rawDays.filter((day) => day.status === "upcoming"),
    [rawDays]
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons
              name="calendar-week"
              size={20}
              color={theme.color.accent}
            />
          </View>
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        <Pressable style={styles.headerButton} accessibilityRole="button">
          <MaterialCommunityIcons
            name="refresh"
            size={20}
            color={theme.color.subtleInk}
          />
        </Pressable>
      </View>

      <View style={styles.divider} />

      <View>
        {days.map((day) => (
          <WeekDayListItem
            key={day.key}
            dayLabel={day.label}
            meal={day.meal}
          />
        ))}
      </View>

      <Pressable style={styles.footer} accessibilityRole="button">
        <Text style={styles.footerText}>Show all</Text>
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color={theme.color.subtleInk}
        />
      </Pressable>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.lg,
      gap: theme.space.lg,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    headerIcon: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    headerButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.color.border,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.xs,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
    },
    footerText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
  });
