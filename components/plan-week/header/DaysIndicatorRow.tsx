import { View, Text, StyleSheet } from "react-native";
import { useMemo } from "react";
import { FlexGrid } from "../../../styles/flex-grid";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import {
  CurrentPlannedWeek,
  PLANNED_WEEK_LABELS,
  PlannedWeekDayKey,
} from "../../../types/weekPlan";

type SizeOption = "xs" | "sm" | "md" | "lg" | "xl";

type Props = {
  orderedDays: PlannedWeekDayKey[];
  activeDay: PlannedWeekDayKey;
  plannedWeek: CurrentPlannedWeek;
  size?: SizeOption;
};

const DIMENSIONS: Record<SizeOption, number> = {
  xs: 24,
  sm: 30,
  md: 36,
  lg: 44,
  xl: 52,
};

const DaysIndicatorRow = ({
  orderedDays,
  activeDay,
  plannedWeek,
  size = "md",
}: Props) => {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const dimension = DIMENSIONS[size];

  return (
    <FlexGrid gutterWidth={theme.space.xs}>
      <FlexGrid.Row justifyContent="center" alignItems="center">
        {orderedDays.map((day) => {
          const isActive = day === activeDay;
          const isPlanned = Boolean(plannedWeek[day]);
          return (
            <View
              style={[
                styles.indicator,
                {
                  width: dimension,
                  height: dimension,
                  borderRadius: dimension / 2,
                  marginLeft: theme.space.xs - 1,
                },
                isPlanned && styles.indicatorPlanned,
                isActive && styles.indicatorActive,
              ]}
            >
              <Text
                style={[
                  styles.indicatorLabel,
                  isActive && styles.indicatorLabelActive,
                  !isActive && isPlanned && styles.indicatorLabelPlanned,
                ]}
              >
                {PLANNED_WEEK_LABELS[day].charAt(0)}
              </Text>
            </View>
          );
        })}
      </FlexGrid.Row>
    </FlexGrid>
  );
};

export default DaysIndicatorRow;

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    indicator: {
      backgroundColor: theme.color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.surfaceAlt,
    },
    indicatorActive: {
      backgroundColor: theme.color.accent,
    },
    indicatorPlanned: {
      borderColor: theme.color.accent,
    },
    indicatorLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      letterSpacing: 0,
    },
    indicatorLabelPlanned: {
      color: theme.color.accent,
    },
    indicatorLabelActive: {
      color: theme.color.ink,
    },
  });
