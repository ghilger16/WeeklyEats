import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import {
  WEEK_PLAN_STREAK_MILESTONES,
  WeekPlanCelebrationPayload,
} from "../../utils/weekPlanCelebration";

type Props = {
  payload: WeekPlanCelebrationPayload;
  onComplete: () => void;
};

export default function WeekPlanSavedCelebration({
  payload,
  onComplete,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [stage, setStage] = useState<"summary" | "streak">("summary");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.96)).current;
  const summaryOpacity = useRef(new Animated.Value(1)).current;
  const streakOpacity = useRef(new Animated.Value(0)).current;
  const streakPop = useRef(new Animated.Value(0.7)).current;
  const exitProgress = useRef(new Animated.Value(0)).current;
  const dashboardRevealProgress = useRef(new Animated.Value(0)).current;
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const statOpacities = useRef(
    Array.from({ length: 4 }, () => new Animated.Value(0)),
  ).current;
  const milestone = WEEK_PLAN_STREAK_MILESTONES[payload.streakCount];
  const isMilestone = Boolean(milestone);
  const hasStreak = payload.streakCount > 0;

  useEffect(() => {
    let active = true;
    let entranceTimer: ReturnType<typeof setTimeout> | null = null;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!active) return;
      setReduceMotion(enabled);
      entranceTimer = setTimeout(() => {
        if (!active) return;
        Animated.parallel([
          Animated.timing(cardOpacity, {
            toValue: 1,
            duration: enabled ? 160 : 300,
            useNativeDriver: true,
          }),
          enabled
            ? Animated.timing(cardScale, {
                toValue: 1,
                duration: 140,
                useNativeDriver: true,
              })
            : Animated.spring(cardScale, {
                toValue: 1,
                speed: 14,
                bounciness: 3,
                useNativeDriver: true,
              }),
        ]).start();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        Animated.stagger(
          enabled ? 0 : 70,
          statOpacities.slice(0, payload.stats.length).map((value) =>
            Animated.timing(value, {
              toValue: 1,
              duration: enabled ? 140 : 180,
              useNativeDriver: true,
            }),
          ),
        ).start();
      }, enabled ? 100 : 260);
    });

    return () => {
      active = false;
      if (entranceTimer) clearTimeout(entranceTimer);
      cardOpacity.stopAnimation();
      cardScale.stopAnimation();
      summaryOpacity.stopAnimation();
      streakOpacity.stopAnimation();
      streakPop.stopAnimation();
      exitProgress.stopAnimation();
      dashboardRevealProgress.stopAnimation();
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const exitToDashboard = () => {
    Animated.timing(exitProgress, {
      toValue: 1,
      duration: reduceMotion ? 140 : 260,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(() => {
      Animated.timing(dashboardRevealProgress, {
        toValue: 1,
        duration: reduceMotion ? 160 : 300,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start(onComplete);
    });
  };

  const handleContinue = () => {
    if (isAdvancing) return;
    setIsAdvancing(true);

    if (!hasStreak) {
      exitToDashboard();
      return;
    }

    Animated.timing(summaryOpacity, {
      toValue: 0,
      duration: reduceMotion ? 120 : 220,
      useNativeDriver: true,
    }).start(() => {
      setStage("streak");
      Animated.parallel([
        Animated.timing(streakOpacity, {
          toValue: 1,
          duration: reduceMotion ? 120 : 220,
          useNativeDriver: true,
        }),
        reduceMotion
          ? Animated.timing(streakPop, {
              toValue: 1,
              duration: 120,
              useNativeDriver: true,
            })
          : Animated.sequence([
              Animated.spring(streakPop, {
                toValue: isMilestone ? 1.13 : 1.08,
                speed: 17,
                bounciness: 8,
                useNativeDriver: true,
              }),
              Animated.spring(streakPop, {
                toValue: 1,
                speed: 22,
                bounciness: 3,
                useNativeDriver: true,
              }),
            ]),
      ]).start(() => {
        setIsAdvancing(false);
        dismissTimerRef.current = setTimeout(() => {
          exitToDashboard();
        }, isMilestone ? 2000 : 1700);
      });
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    });
  };

  const streakStyle = { transform: [{ scale: streakPop }] };

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <Animated.View
        style={[
          styles.scrim,
          {
            opacity: dashboardRevealProgress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.96, 0],
            }),
          },
        ]}
      />
      <Animated.View
        style={[
          styles.contentWrap,
          {
            opacity: Animated.multiply(
              cardOpacity,
              exitProgress.interpolate({
                inputRange: [0, 1],
                outputRange: [1, 0],
              }),
            ),
          },
        ]}
      >
        <Animated.View
          style={[
            styles.card,
            { transform: [{ scale: cardScale }] },
          ]}
        >
        {stage === "summary" ? (
          <Animated.View style={[styles.summary, { opacity: summaryOpacity }]}>
            <View style={styles.summaryHeading}>
              <View style={styles.calendarBadge}>
                <MaterialCommunityIcons name="calendar-check" size={32} color={theme.color.ink} />
              </View>
              <View style={styles.headingCopy}>
                <Text style={styles.title}>✨ Your week is planned!</Text>
                <Text style={styles.accentLine}>
                  {payload.dinnerCount} {payload.dinnerCount === 1 ? "dinner" : "dinners"} ready
                </Text>
              </View>
            </View>
            {payload.stats.length ? (
              <View style={styles.statsRow}>
                {payload.stats.map((stat, index) => (
                  <Animated.View
                    key={stat.id}
                    style={[
                      styles.stat,
                      index > 0 && styles.statDivider,
                      { opacity: statOpacities[index], transform: [{ translateY: statOpacities[index].interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }] },
                    ]}
                  >
                    <View style={styles.statValueRow}>
                      {stat.id === "fiveStars" ? (
                        <MaterialCommunityIcons
                          name="star"
                          size={17}
                          color={theme.color.accent}
                        />
                      ) : (
                        <Text style={styles.statValue}>{stat.icon}</Text>
                      )}
                      <Text style={styles.statValue}>{stat.value}</Text>
                    </View>
                    <Text style={styles.statLabel}>{stat.label}</Text>
                  </Animated.View>
                ))}
              </View>
            ) : null}
          </Animated.View>
        ) : (
          <Animated.View style={[styles.streak, { opacity: streakOpacity }]}>
            <Animated.View style={[styles.streakIdentity, streakStyle]}>
              <View style={[styles.flameWrap, isMilestone && styles.milestoneFlame]}>
                <MaterialCommunityIcons
                  name="fire"
                  size={isMilestone ? 48 : 41}
                  color={theme.color.accent}
                  style={styles.flameIcon}
                />
              </View>
              <Text style={styles.streakNumber}>{payload.streakCount}</Text>
            </Animated.View>
            <View style={styles.streakCopy}>
              <Text style={styles.streakTitle}>
                {milestone?.title ??
                  (payload.streakCount === 1
                    ? "Your streak starts now!"
                    : `${payload.streakCount} week streak!`)}
              </Text>
              <Text style={styles.streakSubtitle}>
                {milestone?.message ??
                  (payload.streakCount === 1
                    ? "You’ve planned your first week ahead."
                    : `You’ve planned ahead ${payload.streakCount} weeks in a row.`)}
              </Text>
            </View>
          </Animated.View>
        )}
        </Animated.View>
        {stage === "summary" ? (
        <Animated.View style={{ opacity: summaryOpacity }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              hasStreak ? "Continue to planning streak" : "Continue to dashboard"
            }
            disabled={isAdvancing}
            onPress={handleContinue}
            style={({ pressed }) => [
              styles.continueButton,
              pressed && styles.continueButtonPressed,
              isAdvancing && styles.continueButtonDisabled,
            ]}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <MaterialCommunityIcons
              name="arrow-right"
              size={20}
              color={theme.color.ink}
            />
          </Pressable>
        </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 100, alignItems: "center", justifyContent: "center", paddingHorizontal: theme.space.lg },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.color.bg },
  contentWrap: { width: "100%", maxWidth: 430, gap: theme.space.lg },
  card: { width: "100%", minHeight: 210, borderRadius: theme.radius.xl, padding: theme.space.xl, backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.cardOutline, shadowColor: theme.color.accent, shadowOpacity: 0.18, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 12, justifyContent: "center" },
  summary: { gap: theme.space.lg },
  summaryHeading: { flexDirection: "row", alignItems: "center", gap: theme.space.md },
  calendarBadge: { width: 68, height: 68, borderRadius: theme.radius.full, backgroundColor: theme.color.accent, alignItems: "center", justifyContent: "center" },
  headingCopy: { flex: 1, gap: theme.space.xs },
  title: { color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  accentLine: { color: theme.color.accent, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
  statsRow: { flexDirection: "row", alignItems: "stretch" },
  stat: { flex: 1, minWidth: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: theme.space.xs },
  statDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.color.border },
  statValueRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  statValue: { color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold, textAlign: "center" },
  statLabel: { color: theme.color.subtleInk, fontSize: 11, textAlign: "center", marginTop: 3 },
  streak: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.xl },
  streakIdentity: { flexDirection: "row", alignItems: "center", gap: theme.space.sm, zIndex: 2 },
  flameWrap: { width: 65, height: 65, borderRadius: theme.radius.full, alignItems: "center", justifyContent: "center", backgroundColor: theme.color.focus, borderWidth: 1, borderColor: theme.color.cardOutline },
  milestoneFlame: { width: 75, height: 75 },
  flameIcon: { transform: [{ translateY: 1 }] },
  streakNumber: { color: theme.color.accent, fontSize: 66, lineHeight: 72, fontWeight: theme.type.weight.bold },
  streakCopy: { flex: 1, maxWidth: 190, gap: theme.space.xs },
  streakTitle: { color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  streakSubtitle: { color: theme.color.subtleInk, fontSize: theme.type.size.sm, lineHeight: 20 },
  continueButton: { minHeight: 54, borderRadius: theme.radius.full, backgroundColor: theme.color.accent, paddingHorizontal: theme.space.xl, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm },
  continueButtonPressed: { opacity: 0.88, transform: [{ scale: 0.99 }] },
  continueButtonDisabled: { opacity: 0.65 },
  continueButtonText: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
});
