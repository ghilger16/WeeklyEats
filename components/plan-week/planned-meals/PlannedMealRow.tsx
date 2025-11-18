import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import { PlannedWeekDayKey } from "../../../types/weekPlan";
import { Meal } from "../../../types/meals";

type Props = {
  day: PlannedWeekDayKey;
  dayLabel: string;
  displayName: string;
  plannedMeal: Meal | null;
  selectedMeal?: Meal | null;
  sides: string[];
  isSelected: boolean;
  isSaved: boolean;
  canSelect: boolean;
  onPress?: () => void;
  registerRef?: (ref: View | null, day: PlannedWeekDayKey) => void;
};

const PlannedMealRow = ({
  day,
  dayLabel,
  displayName,
  plannedMeal,
  selectedMeal,
  sides,
  isSelected,
  isSaved,
  canSelect,
  onPress,
  registerRef,
}: Props) => {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const baseMeal = isSelected && selectedMeal ? selectedMeal : plannedMeal;
  const title = baseMeal ? `${baseMeal.emoji} ${baseMeal.title}` : "Unplanned";
  const sidesLabel = sides.length ? ` • ${sides.join(" • ")}` : "";
  const label = `${title}${sidesLabel}`;

  return (
    <Pressable
      ref={(node) => registerRef?.(node, day)}
      onPress={canSelect ? onPress : undefined}
      disabled={!canSelect}
      accessibilityRole={canSelect ? "button" : "text"}
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${displayName} ${label}`}
      style={({ pressed }) => [
        styles.summaryRow,
        isSelected && styles.summaryRowSelected,
        pressed && canSelect && styles.summaryRowPressed,
      ]}
    >
      <Text style={styles.summaryDay}>{dayLabel}</Text>
      <Text style={styles.summaryMeal} numberOfLines={1}>
        {label}
      </Text>
      {isSaved ? (
        <MaterialCommunityIcons
          name="check-circle"
          size={18}
          color={theme.color.accent}
        />
      ) : null}
    </Pressable>
  );
};

export default PlannedMealRow;

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    summaryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.space.md,
      borderRadius: theme.radius.lg,
      paddingVertical: theme.space.sm,
      paddingHorizontal: theme.space.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
    },
    summaryRowPressed: {
      opacity: 0.85,
    },
    summaryRowSelected: {
      borderColor: theme.color.accent,
      backgroundColor: theme.color.surface,
    },
    summaryDay: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      width: 48,
    },
    summaryMeal: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
      textAlign: "right",
    },
  });
