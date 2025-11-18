import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import {
  CurrentPlannedWeek,
  PlannedWeekDayKey,
} from "../../../types/weekPlan";
import DaysIndicatorRow from "./DaysIndicatorRow";

type PlanWeekHeaderProps = {
  title?: string;
  isSummaryVisible: boolean;
  onClose: () => void;
  onOpenSummary: () => void;
  isDayPlanningStep?: boolean;
  orderedDays?: PlannedWeekDayKey[];
  plannedWeek?: CurrentPlannedWeek;
  activeDay?: PlannedWeekDayKey;
};

const PlanWeekHeader = ({
  title = "Plan Your Week",
  isSummaryVisible,
  onClose,
  onOpenSummary,
  isDayPlanningStep = false,
  orderedDays,
  plannedWeek,
  activeDay,
}: PlanWeekHeaderProps) => {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const showDaysIndicator =
    isDayPlanningStep && orderedDays && plannedWeek && activeDay;

  return (
    <View style={styles.header}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={
          isDayPlanningStep ? "Back to day options" : "Close plan week"
        }
        style={styles.headerButton}
      >
        <MaterialCommunityIcons
          name={isDayPlanningStep ? ("chevron-left" as const) : ("close" as const)}
          size={22}
          color={theme.color.ink}
        />
      </Pressable>
      <View style={styles.headerCenter}>
        {showDaysIndicator ? (
          <DaysIndicatorRow
            orderedDays={orderedDays!}
            plannedWeek={plannedWeek!}
            activeDay={activeDay!}
            size="xs"
          />
        ) : (
          <Text style={styles.headerTitle}>{title}</Text>
        )}
      </View>
      <Pressable
        onPress={onOpenSummary}
        accessibilityRole="button"
        accessibilityLabel="View planned meals summary"
        style={[styles.headerButton, isSummaryVisible && styles.headerButtonActive]}
      >
        <MaterialCommunityIcons
          name="clipboard-text-outline"
          size={22}
          color={isSummaryVisible ? theme.color.accent : theme.color.ink}
        />
      </Pressable>
    </View>
  );
};

export default PlanWeekHeader;

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.space.xl,
      paddingVertical: theme.space.lg,
    },
    headerCenter: {
      flex: 1,
      alignItems: "center",
    },
    headerButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    headerButtonActive: {
      borderColor: theme.color.accent,
    },
    headerTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
  });
