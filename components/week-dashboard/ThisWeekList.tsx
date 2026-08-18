import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { WeekPlanDay } from "../../hooks/useCurrentWeekPlan";
import { ServedMealEntry } from "../../stores/servedMealsStorage";
import { startOfDay } from "../../utils/weekDays";
import { EAT_OUT_MEAL, EAT_OUT_MEAL_ID } from "../../types/specialMeals";
import MealEmoji from "../emoji/MealEmoji";
import { hasFullFreezerMeal } from "../../utils/freezerMealAmount";

type Props = {
  days: WeekPlanDay[];
  servedEntries: ServedMealEntry[];
  onDayPress: (day: WeekPlanDay) => void;
  title?: string;
  collapsible?: boolean;
  showProgress?: boolean;
  onCollapsedChange?: (isCollapsed: boolean) => void;
  dateRange?: string;
  preview?: boolean;
};

const entryForDay = (day: WeekPlanDay, entries: ServedMealEntry[]) => {
  const plannedTime = startOfDay(day.plannedDate).getTime();
  return entries.find(
    (entry) =>
      entry.dayKey === day.key &&
      startOfDay(new Date(entry.servedAtISO)).getTime() === plannedTime,
  );
};

export const countServedDays = (days: WeekPlanDay[], entries: ServedMealEntry[]) =>
  days.filter((day) => {
    if (day.status === "past" && day.mealId === EAT_OUT_MEAL_ID) return true;
    const outcome = entryForDay(day, entries)?.outcome;
    return Boolean(outcome && outcome !== "skipped");
  }).length;

export default function ThisWeekList({
  days,
  servedEntries,
  onDayPress,
  title = "This Week",
  collapsible = false,
  showProgress = true,
  onCollapsedChange,
  dateRange,
  preview = false,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isCollapsed, setCollapsed] = useState(false);
  const visibleDays = useMemo(
    () => (preview ? days : days.filter((day) => Boolean(day.meal))),
    [days, preview],
  );
  const servedCount = countServedDays(visibleDays, servedEntries);
  return (
    <View style={styles.section}>
      <Pressable
        disabled={!collapsible}
        onPress={() => setCollapsed((current) => {
          const next = !current;
          onCollapsedChange?.(next);
          return next;
        })}
        accessibilityRole={collapsible ? "button" : undefined}
        accessibilityLabel={collapsible ? `${isCollapsed ? "Expand" : "Collapse"} ${title}` : undefined}
        style={({ pressed }) => [styles.header, collapsible && pressed && styles.pressed]}
      >
        <View style={styles.headingCopy}>
          <Text style={styles.heading}>{title}</Text>
          {dateRange ? <Text style={styles.dateRange}>{dateRange}</Text> : null}
        </View>
        <View style={styles.headerMeta}>
          {showProgress ? <Text style={styles.progress}>{servedCount} of {visibleDays.length} dinners down</Text> : null}
          {collapsible ? <MaterialCommunityIcons name={isCollapsed ? "chevron-down" : "chevron-up"} size={22} color={theme.color.subtleInk} /> : null}
        </View>
      </Pressable>
      {!isCollapsed ? <View style={styles.list}>
        {visibleDays.map((day) => {
          const entry = preview ? undefined : entryForDay(day, servedEntries);
          const isServed = entry?.outcome === "served";
          const isEatOut = day.mealId === EAT_OUT_MEAL_ID;
          const isPastEatOut = !preview && isEatOut && day.status === "past";
          const isCompleted = isPastEatOut || Boolean(entry && entry.outcome !== "skipped");
          const isSkipped = entry?.outcome === "skipped";
          const isPending = !preview && day.status === "past" && Boolean(day.meal) && !entry && !isPastEatOut;
          const isToday = !preview && day.status === "today";
          const isFreezerMeal = hasFullFreezerMeal(day.meal);
          const eatOutNote = isEatOut && day.meal?.title !== EAT_OUT_MEAL.title
            ? day.meal?.title.trim()
            : day.meal?.prepNotes?.trim();
          return (
            <Pressable
              key={day.key}
              onPress={() => onDayPress(day)}
              accessibilityRole="button"
              accessibilityLabel={`${day.displayName}, ${isEatOut ? "Eat Out" : day.meal?.title ?? "unplanned"}${eatOutNote ? `, ${eatOutNote}` : ""}${isServed ? ", served" : ""}`}
              style={({ pressed }) => [
                styles.row,
                isToday && styles.todayRow,
                isCompleted && styles.servedRow,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.day, isToday && !isServed && styles.todayText]}>{day.label}</Text>
              <View style={styles.statusIcon}>
                {isEatOut ? (
                  <MaterialCommunityIcons
                    name="silverware-fork-knife"
                    size={19}
                    color={theme.color.accent}
                  />
                ) : isCompleted ? (
                  <MaterialCommunityIcons
                    name="check"
                    size={18}
                    color={
                      isServed ? theme.color.success : theme.color.accent
                    }
                  />
                ) : isSkipped ? (
                  <MaterialCommunityIcons name="minus" size={18} color={theme.color.subtleInk} />
                ) : isPending ? (
                  <MaterialCommunityIcons name="clock-outline" size={17} color={theme.color.warning} />
                ) : (
                  <MealEmoji value={day.meal?.emoji} size={22} fallback="·" />
                )}
              </View>
              <View style={styles.mealCopy}>
                <View style={styles.titleRow}>
                  <Text style={[styles.title, isCompleted && styles.servedText]} numberOfLines={1}>
                    {isEatOut ? "Eat Out" : day.meal?.title ?? "Unplanned"}
                  </Text>
                </View>
                {isEatOut && eatOutNote ? (
                  <Text style={styles.sides} numberOfLines={1}>{eatOutNote}</Text>
                ) : !isEatOut && day.sides.length ? (
                  <Text style={styles.sides} numberOfLines={1}>{day.sides.join(" · ")}</Text>
                ) : null}
              </View>
              <View style={styles.statusColumn}>
                {isServed ? (
                  <Text style={styles.servedLabel}>Served</Text>
                ) : isToday ? (
                  <Text style={styles.tonight}>Tonight</Text>
                ) : isPending ? (
                  <Text style={styles.pending}>Pending</Text>
                ) : isFreezerMeal ? (
                  <MaterialCommunityIcons
                    name="snowflake"
                    size={18}
                    color={theme.color.accent}
                    accessibilityLabel="Freezer meal"
                  />
                ) : null}
              </View>
              <MaterialCommunityIcons name="chevron-right" size={21} color={theme.color.subtleInk} />
            </Pressable>
          );
        })}
      </View> : null}
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  section: { gap: theme.space.md },
  header: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: theme.space.md },
  headingCopy: { flex: 1, gap: 2 },
  headerMeta: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
  heading: { color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  dateRange: { color: theme.color.subtleInk, fontSize: theme.type.size.xs },
  progress: { color: theme.color.subtleInk, fontSize: theme.type.size.xs },
  list: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border },
  row: { minHeight: 66, flexDirection: "row", alignItems: "center", gap: theme.space.sm, paddingHorizontal: theme.space.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.color.border },
  todayRow: { backgroundColor: theme.mode === "dark" ? "rgba(255,75,145,0.08)" : "rgba(255,75,145,0.05)", borderLeftWidth: 2, borderLeftColor: theme.color.accent },
  servedRow: {
    backgroundColor:
      theme.mode === "dark"
        ? "rgba(0,255,156,0.08)"
        : "rgba(16,185,129,0.07)",
    borderLeftWidth: 2,
    borderLeftColor: theme.color.success,
  },
  statusIcon: { width: 24, alignItems: "center" },
  emoji: { fontSize: 19 },
  day: { width: 38, color: theme.color.subtleInk, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold, letterSpacing: 0.7 },
  todayText: { color: theme.color.accent },
  mealCopy: { flex: 1, gap: 2 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: theme.space.xs },
  title: { flexShrink: 1, color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium },
  servedText: { color: theme.color.subtleInk },
  statusColumn: { width: 46, alignItems: "flex-end", justifyContent: "center" },
  tonight: { color: theme.color.accent, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.medium },
  servedLabel: { color: theme.color.success, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold },
  sides: { color: theme.color.subtleInk, fontSize: theme.type.size.xs },
  pending: { color: theme.color.warning, fontSize: theme.type.size.xs },
  pressed: { opacity: 0.72 },
});
