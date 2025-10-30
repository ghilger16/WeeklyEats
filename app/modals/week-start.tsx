import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useThemeController } from "../../providers/theme/ThemeController";
import { useWeekStartController } from "../../providers/week-start/WeekStartController";
import {
  PLANNED_WEEK_DISPLAY_NAMES,
  PlannedWeekDayKey,
} from "../../types/weekPlan";
import { WeeklyTheme } from "../../styles/theme";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_MAX_TRANSLATE = SCREEN_HEIGHT;

const WEEK_START_OPTIONS: PlannedWeekDayKey[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

export default function WeekStartModal() {
  const router = useRouter();
  const { theme } = useThemeController();
  const { startDay, setStartDay } = useWeekStartController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const translateY = useRef(new Animated.Value(SHEET_MAX_TRANSLATE)).current;
  const closingRef = useRef(false);

  const animateTo = useCallback(
    (toValue: number, duration: number, easing: (value: number) => number) =>
      new Promise<void>((resolve) => {
        Animated.timing(translateY, {
          toValue,
          duration,
          easing,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) {
            resolve();
          }
        });
      }),
    [translateY]
  );

  const dismiss = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    await animateTo(
      SHEET_MAX_TRANSLATE,
      theme.motion.duration.normal,
      Easing.bezier(0.4, 0, 1, 1)
    );
    router.back();
  }, [animateTo, router, theme.motion.duration.normal]);

  useEffect(() => {
    closingRef.current = false;
    translateY.setValue(SHEET_MAX_TRANSLATE);
    animateTo(
      0,
      theme.motion.duration.slow,
      Easing.bezier(0, 0, 0.2, 1)
    );
  }, [animateTo, theme.motion.duration.slow, translateY]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 10 && Math.abs(gesture.dx) < 20,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dy > 0) {
            translateY.setValue(gesture.dy);
          }
        },
        onPanResponderRelease: async (_, gesture) => {
          const shouldDismiss =
            gesture.dy > SCREEN_HEIGHT * 0.18 || gesture.vy > 1.2;
          if (shouldDismiss) {
            await dismiss();
          } else {
            animateTo(
              0,
              theme.motion.duration.normal,
              Easing.bezier(0, 0, 0.2, 1)
            );
          }
        },
        onPanResponderTerminate: () => {
          animateTo(
            0,
            theme.motion.duration.normal,
            Easing.bezier(0, 0, 0.2, 1)
          );
        },
      }),
    [animateTo, dismiss, theme.motion.duration.normal, translateY]
  );

  const handleSelect = useCallback(
    async (day: PlannedWeekDayKey) => {
      if (closingRef.current) return;
      closingRef.current = true;
      await setStartDay(day);
      await animateTo(
        SHEET_MAX_TRANSLATE,
        theme.motion.duration.normal,
        Easing.bezier(0.4, 0, 1, 1)
      );
      router.back();
    },
    [animateTo, router, setStartDay, theme.motion.duration.normal]
  );

  return (
    <View style={styles.backdrop}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close week start selector"
        style={StyleSheet.absoluteFill}
        onPress={dismiss}
      />
      <Animated.View
        style={[styles.sheetContainer, { transform: [{ translateY }] }]}
        {...panResponder.panHandlers}
      >
        <SafeAreaView style={styles.sheetSafeArea} edges={["bottom"]}>
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={dismiss}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
            >
              <MaterialCommunityIcons
                name="close"
                size={22}
                color={theme.color.ink}
              />
            </Pressable>
          </View>
          <View style={styles.header}>
            <MaterialCommunityIcons
              name="calendar-start"
              size={28}
              color={theme.color.accent}
            />
            <Text style={styles.title}>Pick a day to start your week</Text>
            <Text style={styles.subtitle}>
              We will use this day as the anchor for your meal plan.
            </Text>
          </View>
          <View style={styles.optionsGrid}>
            {WEEK_START_OPTIONS.map((day) => {
              const isActive = day === startDay;
              return (
                <Pressable
                  key={day}
                  onPress={() => handleSelect(day)}
                  accessibilityRole="button"
                  accessibilityLabel={`Start week on ${PLANNED_WEEK_DISPLAY_NAMES[day]}`}
                  style={({ pressed }) => [
                    styles.optionButton,
                    isActive && styles.optionButtonActive,
                    pressed && styles.optionButtonPressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.optionLabel,
                      isActive && styles.optionLabelActive,
                    ]}
                  >
                    {PLANNED_WEEK_DISPLAY_NAMES[day]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.45)",
      justifyContent: "flex-end",
    },
    sheetContainer: {
      backgroundColor: theme.color.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      paddingTop: theme.space.md,
    },
    sheetSafeArea: {
      paddingHorizontal: theme.space.xl,
      paddingBottom: theme.space["2xl"],
      gap: theme.space["2xl"],
    },
    handleContainer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    handle: {
      alignSelf: "center",
      width: 48,
      height: 5,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.border,
      marginBottom: theme.space.sm,
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    closeButtonPressed: {
      opacity: 0.9,
    },
    header: {
      alignItems: "center",
      gap: theme.space.sm,
    },
    title: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    subtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
    },
    optionsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.md,
      justifyContent: "center",
    },
    optionButton: {
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.md,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
      minWidth: "45%",
      alignItems: "center",
    },
    optionButtonActive: {
      backgroundColor: theme.color.accent,
      borderColor: theme.color.accent,
    },
    optionButtonPressed: {
      opacity: 0.95,
    },
    optionLabel: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    optionLabelActive: {
      color: theme.color.ink,
    },
  });
