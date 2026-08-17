import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AccessibilityInfo,
  DeviceEventEmitter,
  Dimensions,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMeals } from "../../hooks/useMeals";
import { useThemeController } from "../../providers/theme/ThemeController";
import {
  WeekPlanHistoryEntry,
  getWeekPlanStreak,
  removeSampleWeekPlanHistory,
} from "../../stores/weekPlanStorage";
import { WeeklyTheme } from "../../styles/theme";
import { Meal } from "../../types/meals";
import { getSpecialMealById } from "../../types/specialMeals";
import { PLANNED_WEEK_ORDER } from "../../types/weekPlan";
import {
  WeekPlanCelebrationStat,
  buildWeekPlanCelebration,
} from "../../utils/weekPlanCelebration";
import { addDays } from "../../utils/weekDays";
import MealEmoji from "../../components/emoji/MealEmoji";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_OFFSET = 85;
const GENERIC_MEAL_EMOJI = "🍽️";

const isSampleHistoryEntry = (entry: WeekPlanHistoryEntry) =>
  PLANNED_WEEK_ORDER.some((day) =>
    (entry.plan[day] ?? "").toString().startsWith("sample"),
  );

const formatShortDate = (value: Date) =>
  value.toLocaleDateString(undefined, { month: "short", day: "numeric" });

const getDinnerCount = (entry: WeekPlanHistoryEntry) =>
  entry.summary?.dinnerCount ??
  PLANNED_WEEK_ORDER.filter((day) => typeof entry.plan[day] === "string").length;

const formatCompactStat = (stat: WeekPlanCelebrationStat) => {
  if (stat.id === "familyStars") {
    return `${stat.icon} ${stat.value} ${stat.value === "1" ? "Star" : "Stars"}`;
  }
  if (stat.id === "newMeals") return `${stat.icon} ${stat.value} New`;
  return `${stat.icon} ${stat.value}`;
};

export default function StreaksHistoryModal() {
  const router = useRouter();
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { meals } = useMeals();
  const [streakCount, setStreakCount] = useState(0);
  const [history, setHistory] = useState<WeekPlanHistoryEntry[]>([]);
  const [expandedWeekStartISO, setExpandedWeekStartISO] = useState<string | null>(
    null,
  );
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  const refreshStreak = useCallback(async () => {
    const streak = await getWeekPlanStreak();
    setStreakCount(streak.count);
  }, []);

  const refreshHistory = useCallback(async () => {
    const entries = (await removeSampleWeekPlanHistory()).filter(
      (entry) => !isSampleHistoryEntry(entry),
    );
    setHistory(entries);
    return entries;
  }, []);

  useFocusEffect(
    useCallback(() => {
      DeviceEventEmitter.emit("streakModalOpen");
      const load = async () => {
        await refreshHistory();
        await refreshStreak();
      };
      load();
      return () => DeviceEventEmitter.emit("streakModalClose");
    }, [refreshHistory, refreshStreak]),
  );

  const formatWeekRange = useCallback((weekStartISO: string) => {
    const start = new Date(`${weekStartISO.slice(0, 10)}T12:00:00`);
    return `${formatShortDate(start)} – ${formatShortDate(addDays(start, 6))}`;
  }, []);

  const getMealRows = useCallback(
    (entry: WeekPlanHistoryEntry) =>
      PLANNED_WEEK_ORDER.flatMap((day) => {
        const id = entry.plan[day];
        if (typeof id !== "string") return [];
        const snapshot = entry.mealSnapshots?.[id];
        const liveMeal = meals.find((meal) => meal.id === id);
        const specialMeal = getSpecialMealById(id, entry.plan.specialMealTitles?.[day]);
        return [{
          id: `${day}-${id}`,
          emoji: snapshot?.emoji ?? liveMeal?.emoji ?? specialMeal?.emoji ?? GENERIC_MEAL_EMOJI,
          title:
            snapshot?.title ??
            entry.mealTitles?.[id] ??
            liveMeal?.title ??
            specialMeal?.title ??
            "Meal",
        }];
      }),
    [meals],
  );

  const getStats = useCallback(
    (entry: WeekPlanHistoryEntry) => {
      if (entry.summary) return entry.summary.stats;
      const snapshotMeals = Object.values(entry.mealSnapshots ?? {});
      const legacyMeals = snapshotMeals.length
        ? (snapshotMeals as Meal[])
        : meals.filter((meal) =>
            PLANNED_WEEK_ORDER.some((day) => entry.plan[day] === meal.id),
          );
      // Older entries did not save the information needed to identify a meal as
      // new at planning time, so omit only that temporal stat rather than guess.
      return buildWeekPlanCelebration({
        plan: entry.plan,
        meals: legacyMeals,
        servedMealIds: new Set(legacyMeals.map((meal) => meal.id)),
        streakCount: 0,
      }).stats.filter((stat) => stat.id !== "newMeals");
    },
    [meals],
  );

  const toggleWeek = useCallback(
    (weekStartISO: string) => {
      if (!reduceMotion) {
        LayoutAnimation.configureNext({
          duration: 240,
          create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
          update: { type: LayoutAnimation.Types.easeInEaseOut },
          delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
        });
      }
      setExpandedWeekStartISO((current) =>
        current === weekStartISO ? null : weekStartISO,
      );
    },
    [reduceMotion],
  );

  const handleClose = useCallback(() => {
    if (typeof router.canGoBack === "function" && router.canGoBack()) router.back();
    else router.push("/(tabs)/week-dashboard");
  }, [router]);

  return (
    <View style={styles.modalBackdrop}>
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel="Close streak history"
        onPress={handleClose}
      />
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.modalContainer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close streak history"
          onPress={handleClose}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          hitSlop={12}
        >
          <MaterialCommunityIcons name="close" size={24} color={theme.color.ink} />
        </Pressable>

        <View style={styles.modalShell}>
          <View style={styles.headerSection}>
            <Text style={styles.modalHeaderTitle}>Streaks</Text>
            <View style={styles.modalStreakCard}>
              <MaterialCommunityIcons name="fire" size={30} color={theme.color.accent} />
              <View>
                <Text style={styles.modalStreakCount}>
                  {streakCount} {streakCount === 1 ? "week" : "weeks"}
                </Text>
                <Text style={styles.modalStreakLabel}>Current streak</Text>
              </View>
            </View>
          </View>

          <View style={styles.modalContentCard}>
            <Text style={styles.modalListTitle}>Your Weeks</Text>
            <ScrollView
              contentContainerStyle={styles.historyContent}
              showsVerticalScrollIndicator={false}
            >
              {history.length ? history.map((entry) => {
                const isExpanded = expandedWeekStartISO === entry.weekStartISO;
                const mealRows = getMealRows(entry);
                const dinnerCount = getDinnerCount(entry);
                const stats = getStats(entry);
                const statsText = stats.map(formatCompactStat).join(" · ");
                return (
                  <Pressable
                    key={entry.weekStartISO}
                    onPress={() => toggleWeek(entry.weekStartISO)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isExpanded }}
                    accessibilityLabel={`${formatWeekRange(entry.weekStartISO)}. ${isExpanded ? "Hide" : "Show"} planned meals`}
                    style={({ pressed }) => [styles.historyItem, pressed && styles.pressed]}
                  >
                    <View style={styles.summaryRow}>
                      <MaterialCommunityIcons name="check-circle" size={18} color={theme.color.accent} />
                      <Text style={styles.historyWeek} numberOfLines={1}>
                        {formatWeekRange(entry.weekStartISO)}
                      </Text>
                      <MaterialCommunityIcons
                        name={isExpanded ? "chevron-up" : "chevron-down"}
                        size={22}
                        color={theme.color.subtleInk}
                      />
                    </View>
                    <Text style={styles.historyMetadata} numberOfLines={1}>
                      Planned {formatShortDate(new Date(entry.completedAtISO))} · {dinnerCount} {dinnerCount === 1 ? "dinner" : "dinners"}
                    </Text>
                    <Text
                      style={styles.historyStats}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {statsText || "✨ Week planned"}
                    </Text>
                    {isExpanded ? (
                      <View style={styles.expandedContent}>
                        <View style={styles.expandedDivider} />
                        <Text style={styles.mealsLabel}>Meals</Text>
                        <View style={styles.mealsList}>
                          {mealRows.map((meal) => (
                            <View key={meal.id} style={styles.mealRow}>
                              <MealEmoji value={meal.emoji} size={22} />
                              <Text style={styles.mealTitle}>{meal.title}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ) : null}
                  </Pressable>
                );
              }) : (
                <View style={styles.historyEmptyWrapper}>
                  <Text style={styles.historyEmpty}>No planned weeks saved yet.</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    width: "100%",
    height: SCREEN_HEIGHT - SHEET_OFFSET,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    backgroundColor: theme.color.bg,
    paddingHorizontal: theme.space.lg,
    paddingTop: theme.space["2xl"],
    paddingBottom: theme.space.lg,
    overflow: "hidden",
  },
  modalShell: { flex: 1, gap: theme.space.lg, paddingTop: theme.space["2xl"] },
  headerSection: { gap: theme.space.md },
  modalHeaderTitle: {
    color: theme.color.ink,
    fontSize: theme.type.size.title,
    fontWeight: theme.type.weight.bold,
  },
  modalStreakCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.space.md,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.space.lg,
    paddingVertical: theme.space.md,
    borderWidth: 1,
    borderColor: theme.color.accent,
    shadowColor: theme.color.accent,
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  modalStreakCount: {
    color: theme.color.ink,
    fontSize: theme.type.size.title,
    fontWeight: theme.type.weight.bold,
  },
  modalStreakLabel: {
    color: theme.color.subtleInk,
    fontSize: theme.type.size.sm,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  modalContentCard: {
    flex: 1,
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius.lg,
    padding: theme.space.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.cardOutline,
    gap: theme.space.md,
  },
  modalListTitle: {
    color: theme.color.ink,
    fontSize: theme.type.size.title,
    fontWeight: theme.type.weight.bold,
  },
  historyContent: { gap: theme.space.md, paddingBottom: theme.space.md },
  historyItem: {
    padding: theme.space.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.color.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.border,
  },
  pressed: { opacity: 0.88 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
  historyWeek: {
    flex: 1,
    color: theme.color.ink,
    fontSize: theme.type.size.base,
    fontWeight: theme.type.weight.bold,
  },
  historyMetadata: {
    color: theme.color.subtleInk,
    fontSize: theme.type.size.sm,
    marginLeft: 18 + theme.space.sm,
    marginTop: 3,
  },
  historyStats: {
    color: theme.color.ink,
    fontSize: theme.type.size.sm,
    marginLeft: 18 + theme.space.sm,
    marginTop: 3,
  },
  expandedContent: { marginTop: theme.space.md },
  expandedDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border },
  mealsLabel: {
    color: theme.color.subtleInk,
    fontSize: theme.type.size.xs,
    fontWeight: theme.type.weight.bold,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: theme.space.md,
  },
  mealsList: { gap: theme.space.sm, marginTop: theme.space.sm },
  mealRow: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
  mealEmoji: { fontSize: theme.type.size.base, width: 26, textAlign: "center" },
  mealTitle: { flex: 1, color: theme.color.ink, fontSize: theme.type.size.sm },
  historyEmpty: { color: theme.color.subtleInk, fontSize: theme.type.size.base },
  historyEmptyWrapper: { alignItems: "center", paddingVertical: theme.space.lg },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.color.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.color.cardOutline,
    alignItems: "center",
    justifyContent: "center",
    position: "absolute",
    top: theme.space.lg,
    right: theme.space.lg,
    zIndex: 10,
  },
});
