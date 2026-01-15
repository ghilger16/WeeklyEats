import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  DeviceEventEmitter,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMeals } from "../../hooks/useMeals";
import { useWeekStartController } from "../../providers/week-start/WeekStartController";
import { useThemeController } from "../../providers/theme/ThemeController";
import {
  WeekPlanHistoryEntry,
  addWeekPlanHistory,
  getWeekPlanHistory,
  getWeekPlanStreak,
} from "../../stores/weekPlanStorage";
import {
  PLANNED_WEEK_ORDER,
  createEmptyCurrentPlannedWeek,
} from "../../types/weekPlan";
import {
  addDays,
  formatWeekdayDate,
  getWeekStartForDate,
  startOfDay,
} from "../../utils/weekDays";
import { WeeklyTheme } from "../../styles/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_OFFSET = 85;

export default function StreaksHistoryModal() {
  const router = useRouter();
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { meals } = useMeals();
  const { startDay } = useWeekStartController();

  const [streakCount, setStreakCount] = useState(0);
  const [history, setHistory] = useState<WeekPlanHistoryEntry[]>([]);
  const [expandedWeekStartISO, setExpandedWeekStartISO] = useState<
    string | null
  >(null);

  const refreshStreak = useCallback(async () => {
    const streak = await getWeekPlanStreak();
    if (streak.count && streak.count > 0) {
      setStreakCount(streak.count);
    } else if (history.length) {
      setStreakCount(history.length);
    } else {
      setStreakCount(0);
    }
  }, [history.length]);

  const refreshHistory = useCallback(async () => {
    const entries = await getWeekPlanHistory();
    setHistory(entries);
    if (entries.length && (!streakCount || streakCount < entries.length)) {
      setStreakCount(entries.length);
    }
  }, [streakCount]);

  const addSampleHistory = useCallback(async () => {
    const existing = await getWeekPlanHistory();
    const mealIds = meals.map((m) => m.id).filter(Boolean);
    const today = startOfDay(new Date());
    const starts = [0, -7, -14].map((offset) =>
      getWeekStartForDate(startDay, addDays(today, offset))
    );

    await Promise.all(
      starts.map(async (start) => {
        const iso = start.toISOString().slice(0, 10);
        const plan = createEmptyCurrentPlannedWeek({
          weekStartISO: iso,
          weekedPlanned: true,
        });
        PLANNED_WEEK_ORDER.forEach((dayKey, idx) => {
          const mealId =
            mealIds.length > 0
              ? mealIds[(idx + start.getTime()) % mealIds.length]
              : `sample-${idx + 1}`;
          plan[dayKey] = mealId;
        });
        await addWeekPlanHistory(plan);
      })
    );

    await refreshHistory();
    await refreshStreak();
  }, [meals, refreshHistory, refreshStreak, startDay]);

  useFocusEffect(
    useCallback(() => {
      DeviceEventEmitter.emit("streakModalOpen");
      const load = async () => {
        const entries = await getWeekPlanHistory();
        const needsSamples =
          entries.length < 3 ||
          entries.some((entry) =>
            PLANNED_WEEK_ORDER.some((day) =>
              (entry.plan[day] ?? "").toString().startsWith("sample")
            )
          );
        if (needsSamples) {
          await addSampleHistory();
        } else {
          setHistory(entries);
          await refreshStreak();
        }
      };
      load();
      return () => {
        DeviceEventEmitter.emit("streakModalClose");
      };
    }, [addSampleHistory, refreshStreak])
  );

  const formatWeekRange = useCallback((weekStartISO: string) => {
    const start = new Date(weekStartISO);
    const end = addDays(start, 6);
    return `${formatWeekdayDate(start)} – ${formatWeekdayDate(end)}`;
  }, []);

  const renderHistory = history.map((entry) => {
    const mealNames = PLANNED_WEEK_ORDER.map((dayKey) => entry.plan[dayKey])
      .filter((id): id is string => typeof id === "string")
      .map((id) => {
        const meal = meals.find((m) => m.id === id);
        if (meal?.name) {
          return meal.name;
        }
        if (id.startsWith("sample-")) {
          const suffix = id.split("-").pop();
          return `Sample Meal ${suffix}`;
        }
        return id;
      });
    const isExpanded = expandedWeekStartISO === entry.weekStartISO;
    const handleToggle = () => {
      setExpandedWeekStartISO((prev) =>
        prev === entry.weekStartISO ? null : entry.weekStartISO
      );
    };
    return (
      <Pressable
        key={entry.weekStartISO}
        onPress={handleToggle}
        accessibilityRole="button"
        accessibilityLabel={`Week ${formatWeekRange(entry.weekStartISO)}. ${
          isExpanded ? "Hide meals" : "Show meals"
        }`}
        style={({ pressed }) => [
          styles.historyItem,
          pressed && styles.historyItemPressed,
        ]}
      >
        <View style={styles.historyRow}>
          <View style={styles.historyIconWrapper}>
            <MaterialCommunityIcons
              name="check-circle"
              size={20}
              color={theme.color.accent}
            />
            <View style={styles.historyLine} />
          </View>
          <View style={styles.historyTextColumn}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyWeek}>
                {formatWeekRange(entry.weekStartISO)}
              </Text>
              <Text style={styles.historyDate}>
                Completed {formatWeekdayDate(new Date(entry.completedAtISO))}
              </Text>
            </View>
            {isExpanded ? (
              <View style={styles.historyMealsList}>
                {mealNames.length ? (
                  mealNames.map((mealName, idx) => (
                    <Text
                      key={`${entry.weekStartISO}-meal-${idx}`}
                      style={styles.historyMeal}
                    >
                      • {mealName}
                    </Text>
                  ))
                ) : (
                  <Text style={styles.historyMeal}>No meals saved</Text>
                )}
              </View>
            ) : (
              <Text
                style={styles.historyMeals}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {mealNames.length ? mealNames.join(" • ") : "No meals saved"}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    );
  });

  const handleClose = useCallback(() => {
    if (typeof router.canGoBack === "function" && router.canGoBack()) {
      router.back();
    } else {
      router.push("/(tabs)/week-dashboard");
    }
  }, [router]);

  return (
    <View style={styles.modalBackdrop}>
      <Pressable
        style={StyleSheet.absoluteFill}
        accessibilityRole="button"
        accessibilityLabel="Close streak history"
        onPress={handleClose}
      />
      <SafeAreaView
        edges={["top", "bottom", "left", "right"]}
        style={styles.modalContainer}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close streak history"
          onPress={handleClose}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed,
          ]}
          hitSlop={12}
        >
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={theme.color.ink}
          />
        </Pressable>

        <View style={styles.modalShell}>
          <View style={styles.modalHeaderCard}>
            <View style={styles.modalHeaderRow}>
              <View style={styles.modalHeaderTextCol}>
                <Text style={styles.modalHeaderTitle}>Streaks</Text>
                <View style={styles.modalStreakCard}>
                  <MaterialCommunityIcons
                    name="fire"
                    size={30}
                    color={theme.color.accent}
                  />
                  <View>
                    <Text style={styles.modalStreakCount}>
                      {streakCount} weeks
                    </Text>
                    <Text style={styles.modalStreakLabel}>Current streak</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.modalContentCard}>
            <Text style={styles.modalListTitle}>Your Weeks</Text>
            <ScrollView
              contentContainerStyle={styles.historyContent}
              showsVerticalScrollIndicator={false}
            >
              {renderHistory.length ? (
                renderHistory
              ) : (
                <View style={styles.historyEmptyWrapper}>
                  <Text style={styles.historyEmpty}>
                    No completed weeks saved yet.
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Add sample streak data"
                    onPress={addSampleHistory}
                    style={({ pressed }) => [
                      styles.modalCloseButton,
                      pressed && styles.modalCloseButtonPressed,
                    ]}
                  >
                    <Text style={styles.modalCloseText}>Add sample data</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "stretch",
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
      gap: theme.space.md,
      overflow: "hidden",
    },
    modalShell: {
      flex: 1,
      gap: theme.space.lg,
      paddingTop: theme.space["2xl"],
    },
    modalHeaderCard: {
      borderRadius: theme.radius.lg,
      padding: theme.space.lg,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 5,
    },
    modalHeaderRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: theme.space.md,
    },
    modalHeaderTextCol: {
      gap: theme.space.md,
      flex: 1,
    },
    modalHeaderTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    modalStreakCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
      backgroundColor: "rgba(255,255,255,0.9)",
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
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
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 4 },
      elevation: 3,
    },
    modalListTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    historyContent: {
      gap: theme.space.md,
      paddingBottom: theme.space.md,
    },
    historyItem: {
      padding: theme.space.md,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      gap: theme.space.xs,
    },
    historyItemPressed: {
      opacity: 0.9,
    },
    historyRow: {
      flexDirection: "row",
      gap: theme.space.md,
    },
    historyTextColumn: {
      flex: 1,
      gap: theme.space.xs,
    },
    historyIconWrapper: {
      alignItems: "center",
    },
    historyLine: {
      flex: 1,
      width: StyleSheet.hairlineWidth,
      backgroundColor: theme.color.border,
      marginTop: theme.space.xs,
    },
    historyHeader: {
      gap: 2,
    },
    historyWeek: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    historyDate: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    historyMeals: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
    },
    historyMealsList: {
      gap: 4,
      marginTop: theme.space.xs,
    },
    historyMeal: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
    },
    historyEmpty: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
    },
    historyEmptyWrapper: {
      alignItems: "center",
      gap: theme.space.sm,
    },
    modalCloseButton: {
      alignSelf: "center",
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    modalCloseButtonPressed: {
      opacity: 0.9,
    },
    modalCloseText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
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
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 4,
    },
    closeButtonPressed: {
      opacity: 0.9,
    },
  });
