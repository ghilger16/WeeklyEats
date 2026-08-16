import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  DeviceEventEmitter,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useMeals } from "../../hooks/useMeals";
import { useServedMeals } from "../../hooks/useServedMeals";
import { useThemeController } from "../../providers/theme/ThemeController";
import { getWeekPlanHistory } from "../../stores/weekPlanStorage";
import { alpha, WeeklyTheme } from "../../styles/theme";
import { getSmartLevel, SmartLevel } from "../../utils/smartLevel";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_OFFSET = 85;

const LEVELS: Array<{
  level: SmartLevel;
  title: string;
  description: string;
}> = [
  {
    level: 1,
    title: "Getting Started",
    description: "Add your first meals so Weekly Eats has something to work with.",
  },
  {
    level: 2,
    title: "Learning Your Table",
    description: "Add meal details and start planning and serving dinners.",
  },
  {
    level: 3,
    title: "Knows Your Favorites",
    description: "Weekly Eats has enough ratings and serving history to understand what your family enjoys.",
  },
  {
    level: 4,
    title: "Smart Planner",
    description: "Weekly Eats understands cuisines, difficulty, budget, freezer meals, and your family’s patterns.",
  },
  {
    level: 5,
    title: "Your Family Expert",
    description: "Weekly Eats has enough real history to make highly personalized weekly plans.",
  },
];

export default function SmartLevelModal() {
  const router = useRouter();
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { meals } = useMeals();
  const { entries: servedEntries, refresh: refreshServedMeals } = useServedMeals();
  const [plannedWeeksCount, setPlannedWeeksCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      DeviceEventEmitter.emit("smartLevelModalOpen");
      getWeekPlanHistory().then((history) => setPlannedWeeksCount(history.length));
      refreshServedMeals();
      return () => DeviceEventEmitter.emit("smartLevelModalClose");
    }, [refreshServedMeals]),
  );

  const currentLevel = useMemo(
    () => getSmartLevel({ meals, servedEntries, plannedWeeksCount }),
    [meals, plannedWeeksCount, servedEntries],
  );

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
        accessibilityLabel="Close Smart Level"
        onPress={handleClose}
      />
      <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.modalContainer}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close Smart Level"
          onPress={handleClose}
          hitSlop={12}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <MaterialCommunityIcons name="close" size={24} color={theme.color.ink} />
        </Pressable>

        <View style={styles.modalShell}>
          <View style={styles.header}>
            <MaterialCommunityIcons name="magic-staff" size={48} color={theme.color.accent} />
            <View style={styles.headerText}>
              <Text style={styles.title}>Your Smart Level</Text>
              <Text style={styles.subtitle}>The more you use Weekly Eats, the smarter it gets.</Text>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.levelList}
          >
            {LEVELS.map((item) => {
              const isActive = item.level === currentLevel;
              const isComplete = item.level < currentLevel;
              return (
                <View
                  key={item.level}
                  accessibilityLabel={`Level ${item.level}, ${item.title}, ${isActive ? "current level" : isComplete ? "completed" : "upcoming"}`}
                  style={[
                    styles.levelCard,
                    isActive && styles.levelCardActive,
                    isComplete && styles.levelCardComplete,
                  ]}
                >
                  <View style={[styles.numberBadge, isActive && styles.numberBadgeActive]}>
                    <Text style={[styles.numberText, isActive && styles.numberTextActive]}>{item.level}</Text>
                  </View>
                  <View style={styles.levelText}>
                    <View style={styles.levelTitleRow}>
                      <Text style={[styles.levelNumber, isActive && styles.levelAccent]}>Level {item.level}</Text>
                      <Text style={[styles.levelTitle, isActive && styles.levelAccent]} numberOfLines={1}>{item.title}</Text>
                    </View>
                    <Text style={styles.description}>{item.description}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "stretch", justifyContent: "flex-end" },
  modalContainer: { width: "100%", height: SCREEN_HEIGHT - SHEET_OFFSET, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, backgroundColor: theme.color.bg, paddingHorizontal: theme.space.lg, paddingTop: theme.space["2xl"], paddingBottom: theme.space.lg, overflow: "hidden" },
  closeButton: { position: "absolute", top: theme.space.lg, right: theme.space.lg, zIndex: 2, width: 40, height: 40, borderRadius: theme.radius.full, alignItems: "center", justifyContent: "center", backgroundColor: theme.color.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
  modalShell: { flex: 1, paddingTop: theme.space["2xl"], gap: theme.space.lg },
  header: { flexDirection: "row", alignItems: "center", gap: theme.space.lg, paddingHorizontal: theme.space.sm, paddingRight: 52 },
  headerText: { flex: 1, gap: theme.space.xs },
  title: { color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  subtitle: { color: theme.color.subtleInk, fontSize: theme.type.size.sm, lineHeight: 20 },
  levelList: { gap: theme.space.md, paddingBottom: theme.space.xl },
  levelCard: { minHeight: 112, flexDirection: "row", alignItems: "center", gap: theme.space.md, padding: theme.space.lg, borderRadius: theme.radius.lg, backgroundColor: theme.color.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.cardOutline },
  levelCardActive: { borderColor: theme.color.accent, backgroundColor: alpha(theme.color.accent, 0.09) },
  levelCardComplete: { backgroundColor: theme.color.surfaceAlt },
  numberBadge: { width: 40, height: 40, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.subtleInk },
  numberBadgeActive: { backgroundColor: theme.color.accent, borderColor: theme.color.accent },
  numberText: { color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  numberTextActive: { color: theme.color.ink },
  levelText: { flex: 1, gap: theme.space.xs },
  levelTitleRow: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
  levelNumber: { color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium },
  levelTitle: { flexShrink: 1, color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold },
  levelAccent: { color: theme.color.accent },
  description: { color: theme.color.subtleInk, fontSize: theme.type.size.sm, lineHeight: 19 },
  pressed: { opacity: 0.72 },
});
