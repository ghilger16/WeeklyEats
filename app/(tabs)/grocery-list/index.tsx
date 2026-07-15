import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import TabParent from "../../../components/tab-parent/TabParent";
import { GroceryListContent } from "../../../components/week-dashboard/GroceryListSheet";
import { useCurrentWeekPlan } from "../../../hooks/useCurrentWeekPlan";
import { useWeekStartController } from "../../../providers/week-start/WeekStartController";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { getCurrentWeekPlan } from "../../../stores/weekPlanStorage";
import { WeeklyTheme } from "../../../styles/theme";
import { PLANNED_WEEK_ORDER } from "../../../types/weekPlan";
import { addDays, getWeekStartForDate } from "../../../utils/weekDays";

const toISO = (date: Date) => date.toISOString().slice(0, 10);

const formatRange = (start: Date) => {
  const end = addDays(start, 6);
  const startLabel = start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const endLabel = end.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${startLabel} – ${endLabel}`;
};

export default function GroceryListTab() {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { startDay } = useWeekStartController();
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const currentWeekStart = useMemo(
    () => getWeekStartForDate(startDay, referenceDate),
    [referenceDate, startDay],
  );
  const nextWeekStart = useMemo(
    () => addDays(currentWeekStart, 7),
    [currentWeekStart],
  );
  const currentWeekISO = toISO(currentWeekStart);
  const nextWeekISO = toISO(nextWeekStart);
  const [selectedWeekISO, setSelectedWeekISO] = useState(currentWeekISO);
  const [selectionTouched, setSelectionTouched] = useState(false);
  const [hasNextWeekPlan, setHasNextWeekPlan] = useState(false);
  const selectedWeekStart =
    selectedWeekISO === nextWeekISO ? nextWeekStart : currentWeekStart;
  const { isLoading, weekStartISO, days, refresh } = useCurrentWeekPlan({
    weekStartOverride: selectedWeekStart,
  });

  const selectDefaultWeek = useCallback(async () => {
    const nextPlan = await getCurrentWeekPlan(nextWeekISO);
    const hasNextPlan = Boolean(
      nextPlan && PLANNED_WEEK_ORDER.some((day) => Boolean(nextPlan[day])),
    );
    setHasNextWeekPlan(hasNextPlan);
    if (!hasNextPlan && selectedWeekISO === nextWeekISO) {
      setSelectedWeekISO(currentWeekISO);
    }
    if (!selectionTouched) {
      setSelectedWeekISO(hasNextPlan ? nextWeekISO : currentWeekISO);
    }
  }, [
    currentWeekISO,
    nextWeekISO,
    selectedWeekISO,
    selectionTouched,
  ]);

  useEffect(() => {
    setSelectionTouched(false);
    setSelectedWeekISO(currentWeekISO);
  }, [currentWeekISO]);

  useEffect(() => {
    void selectDefaultWeek();
  }, [selectDefaultWeek]);

  useFocusEffect(
    useCallback(() => {
      setReferenceDate(new Date());
      void selectDefaultWeek();
      void refresh();
    }, [refresh, selectDefaultWeek]),
  );

  const selectWeek = (weekISO: string) => {
    setSelectionTouched(true);
    setSelectedWeekISO(weekISO);
  };

  const showingCurrentWeek = selectedWeekISO === currentWeekISO;

  return (
    <TabParent title="Grocery List">
      <View style={styles.screen}>
        <GroceryListContent
          weekId={weekStartISO}
          days={days}
          isActive={!isLoading}
          showHeader={false}
          useSafeArea={false}
          weekNavigator={
            <View style={styles.weekNavigator}>
              {hasNextWeekPlan ? <Pressable
                disabled={showingCurrentWeek}
                onPress={() => selectWeek(currentWeekISO)}
                hitSlop={theme.space.sm}
                accessibilityRole="button"
                accessibilityLabel="Show current week"
                accessibilityState={{ disabled: showingCurrentWeek }}
                style={({ pressed }) => [
                  styles.weekArrow,
                  showingCurrentWeek && styles.weekArrowDisabled,
                  pressed && styles.weekArrowPressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="chevron-left"
                  size={26}
                  color={theme.color.subtleInk}
                />
              </Pressable> : null}
              <View style={styles.weekRangeContent}>
                <Text style={styles.weekPlanLabel}>
                  {showingCurrentWeek
                    ? "Current Week Plan"
                    : "Next Week Plan"}
                </Text>
                <Text style={styles.weekRange}>
                  {formatRange(selectedWeekStart)}
                </Text>
              </View>
              {hasNextWeekPlan ? <Pressable
                disabled={!showingCurrentWeek}
                onPress={() => selectWeek(nextWeekISO)}
                hitSlop={theme.space.sm}
                accessibilityRole="button"
                accessibilityLabel="Show next week"
                accessibilityState={{ disabled: !showingCurrentWeek }}
                style={({ pressed }) => [
                  styles.weekArrow,
                  !showingCurrentWeek && styles.weekArrowDisabled,
                  pressed && styles.weekArrowPressed,
                ]}
              >
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={26}
                  color={theme.color.subtleInk}
                />
              </Pressable> : null}
            </View>
          }
        />
      </View>
    </TabParent>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    screen: { flex: 1, gap: theme.space.md },
    weekNavigator: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.lg,
      paddingHorizontal: theme.space.md,
    },
    weekArrow: {
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
    },
    weekArrowDisabled: { opacity: 0.25 },
    weekArrowPressed: {
      opacity: 0.65,
      backgroundColor: theme.color.surfaceAlt,
    },
    weekRange: {
      minWidth: 150,
      textAlign: "center",
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    weekRangeContent: {
      minWidth: 170,
      alignItems: "center",
      gap: 2,
    },
    weekPlanLabel: {
      color: theme.color.accent,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.bold,
    },
  });
