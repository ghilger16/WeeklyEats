import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import type { WeekPlanDay } from "../../hooks/useCurrentWeekPlan";
import ThisWeekList from "./ThisWeekList";
import type { ServedMealEntry } from "../../stores/servedMealsStorage";
import BurstSparkles from "./BurstSparkles";

export function WrapUpLastWeekModal({
  visible,
  days,
  servedEntries,
  onDayPress,
  onContinue,
  onClose,
}: {
  visible: boolean;
  days: WeekPlanDay[];
  servedEntries: ServedMealEntry[];
  onDayPress: (day: WeekPlanDay) => void;
  onContinue: () => void;
  onClose: () => void;
}) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isComplete = days.length === 0;
  if (!visible) return null;

  return (
    <View style={styles.overlay} accessibilityViewIsModal>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close previous week wrap-up"
            hitSlop={10}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.pressed,
            ]}
          >
            <MaterialCommunityIcons
              name="close"
              size={28}
              color={theme.color.ink}
            />
          </Pressable>
          <View style={styles.modalHeader}>
            <View style={styles.headerIcon}>
              <MaterialCommunityIcons
                name={isComplete ? "check-circle-outline" : "calendar-check-outline"}
                size={30}
                color={theme.color.accent}
              />
            </View>
            <Text style={styles.title}>
              {isComplete ? "All caught up!" : "Before we plan this week…"}
            </Text>
            <Text style={styles.subtitle}>
              {isComplete
                ? "You’re ready to plan this week."
                : `You still have ${days.length} ${days.length === 1 ? "meal" : "meals"} from last week that ${days.length === 1 ? "isn’t" : "aren’t"} marked.`}
            </Text>
          </View>

          {!isComplete ? (
            <ScrollView
              style={styles.modalRows}
              contentContainerStyle={styles.modalRowsContent}
              showsVerticalScrollIndicator={false}
            >
              <ThisWeekList
                days={days}
                servedEntries={servedEntries}
                onDayPress={onDayPress}
                hideHeader
              />
            </ScrollView>
          ) : null}

          <Pressable
            disabled={!isComplete}
            onPress={onContinue}
            accessibilityRole="button"
            accessibilityState={{ disabled: !isComplete }}
            style={({ pressed }) => [
              styles.primaryButton,
              !isComplete && styles.primaryButtonDisabled,
              pressed && isComplete && styles.pressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Finish &amp; Plan This Week</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export function PreviousWeekCatchUpCard({
  dateRange,
  days,
  servedEntries,
  onDayPress,
}: {
  dateRange: string;
  days: WeekPlanDay[];
  servedEntries: ServedMealEntry[];
  onDayPress: (day: WeekPlanDay) => void;
}) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [expanded, setExpanded] = useState(false);
  const previousPendingCount = useRef(days.length);
  const [showCompletion, setShowCompletion] = useState(false);
  const [completionDismissed, setCompletionDismissed] = useState(days.length === 0);
  const completionProgress = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const priorCount = previousPendingCount.current;
    previousPendingCount.current = days.length;
    if (days.length > 0) {
      setCompletionDismissed(false);
      return;
    }
    if (priorCount === 0) return;

    setExpanded(false);
    setShowCompletion(true);
    setCompletionDismissed(false);
    completionProgress.setValue(0);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    const animation = Animated.sequence([
      Animated.spring(completionProgress, {
        toValue: 1,
        damping: 16,
        stiffness: 170,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.delay(reduceMotion ? 500 : 1200),
      Animated.timing(completionProgress, {
        toValue: 0,
        duration: reduceMotion ? 120 : 260,
        useNativeDriver: true,
      }),
    ]);
    animation.start(({ finished }) => {
      if (!finished) return;
      setShowCompletion(false);
      setCompletionDismissed(true);
    });
    return () => animation.stop();
  }, [completionProgress, days.length, reduceMotion]);

  if (!days.length && completionDismissed && !showCompletion) return null;

  if (showCompletion) {
    return (
      <Animated.View
        accessibilityLiveRegion="polite"
        style={[
          styles.completionCard,
          {
            opacity: completionProgress,
            transform: reduceMotion
              ? []
              : [
                  {
                    scale: completionProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
          },
        ]}
      >
        {!reduceMotion ? (
          <BurstSparkles
            progress={completionProgress}
            visible
            particleCount={8}
            distanceScale={0.7}
            particleSize={7}
          />
        ) : null}
        <MaterialCommunityIcons
          name="check-circle"
          size={44}
          color={theme.color.success}
        />
        <View style={styles.completionCopy}>
          <Text style={styles.completionTitle}>Week complete!</Text>
          <Text style={styles.completionSubtitle}>You’re all caught up.</Text>
        </View>
      </Animated.View>
    );
  }

  return (
    <View style={styles.catchUpCard}>
      <Pressable
        onPress={() => setExpanded((current) => !current)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={({ pressed }) => [styles.catchUpHeader, pressed && styles.pressed]}
      >
        <View style={styles.catchUpHeaderCopy}>
          <Text style={styles.catchUpTitle}>Week of {dateRange}</Text>
          <Text style={styles.catchUpStatus}>
            {days.length} {days.length === 1 ? "meal needs" : "meals need"} an update
          </Text>
        </View>
        <MaterialCommunityIcons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={22}
          color={theme.color.subtleInk}
        />
      </Pressable>
      {expanded ? (
        <ThisWeekList
          days={days}
          servedEntries={servedEntries}
          onDayPress={onDayPress}
          hideHeader
        />
      ) : null}
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 100,
      elevation: 100,
    },
    backdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.55)",
    },
    sheet: {
      position: "relative",
      maxHeight: "88%",
      padding: theme.space.xl,
      paddingBottom: theme.space["2xl"],
      gap: theme.space.md,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      backgroundColor: theme.color.bg,
    },
    closeButton: {
      position: "absolute",
      top: theme.space.md,
      left: theme.space.md,
      zIndex: 2,
      width: 44,
      height: 44,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    modalHeader: { alignItems: "center", gap: theme.space.xs },
    headerIcon: {
      width: 58,
      height: 58,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
    },
    title: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    subtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      lineHeight: 20,
      textAlign: "center",
    },
    modalRows: { flexGrow: 0 },
    modalRowsContent: { paddingVertical: theme.space.xs },
    rows: { gap: theme.space.sm },
    mealRow: {
      gap: theme.space.sm,
      padding: theme.space.md,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surface,
    },
    mealIdentity: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
    mealCopy: { flex: 1, gap: 1 },
    mealDate: { color: theme.color.subtleInk, fontSize: theme.type.size.xs },
    mealTitle: { color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold },
    actions: { flexDirection: "row", gap: theme.space.xs },
    action: {
      flex: 1,
      minHeight: 34,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 5,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
    },
    servedAction: { backgroundColor: theme.color.success },
    actionText: { color: theme.color.ink, fontSize: 11, fontWeight: theme.type.weight.medium },
    servedActionText: { color: "#FFFFFF" },
    primaryButton: {
      minHeight: 54,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.accent,
    },
    primaryButtonDisabled: { opacity: 0.35 },
    primaryButtonText: { color: "#FFFFFF", fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
    catchUpCard: {
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surface,
      overflow: "hidden",
    },
    completionCard: {
      minHeight: 112,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.md,
      overflow: "hidden",
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.color.success,
      backgroundColor:
        theme.mode === "dark"
          ? "rgba(0,255,156,0.09)"
          : "rgba(16,185,129,0.07)",
    },
    completionCopy: { gap: 2 },
    completionTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    completionSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    catchUpHeader: {
      minHeight: 70,
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.md,
    },
    catchUpHeaderCopy: { flex: 1, gap: 3 },
    catchUpTitle: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
    catchUpStatus: { color: theme.color.accent, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium },
    pressed: { opacity: 0.76 },
  });
