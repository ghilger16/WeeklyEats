import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Animated, StyleSheet, Text, View } from "react-native";
import { useEffect, useMemo, useRef } from "react";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";

type Props = {
  dayName?: string;
  title?: string;
  subtitle?: string;
  onComplete?: () => void;
};

const DayPlannedToast = ({ dayName, title, subtitle, onComplete }: Props) => {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  const resolvedTitle = title ?? "Day Planned";
  const resolvedSubtitle =
    subtitle ?? (dayName ? `${dayName} is locked in.` : undefined);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(800),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.95,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onComplete?.();
    });
  }, [opacity, scale, onComplete]);

  return (
    <Animated.View style={[styles.overlay, { opacity }]}>
      <Animated.View style={[styles.toast, { transform: [{ scale }] }]}>
        <View style={styles.iconBadge}>
          <MaterialCommunityIcons name="check" size={24} color={theme.color.ink} />
        </View>
        <View style={styles.toastTextWrapper}>
          <Text style={styles.toastTitle}>{resolvedTitle}</Text>
          {resolvedSubtitle ? (
            <Text style={styles.toastSubtitle}>{resolvedSubtitle}</Text>
          ) : null}
        </View>
      </Animated.View>
    </Animated.View>
  );
};

export default DayPlannedToast;

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(0,0,0,0.35)",
      zIndex: 50,
    },
    toast: {
      minWidth: 260,
      paddingHorizontal: theme.space.xl,
      paddingVertical: theme.space.lg,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
    },
    iconBadge: {
      width: 52,
      height: 52,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    toastTextWrapper: {
      flex: 1,
      gap: theme.space.xs / 2,
    },
    toastTitle: {
      fontSize: theme.type.size.h3,
      color: theme.color.ink,
      fontWeight: theme.type.weight.bold,
    },
    toastSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
  });
