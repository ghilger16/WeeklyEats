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
import {
  ThemePreference,
  useThemeController,
} from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { FlexGrid } from "../../styles/flex-grid";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_MAX_TRANSLATE = SCREEN_HEIGHT;

const options: Array<{
  mode: ThemePreference;
  title: string;
  description: string;
  emoji: string;
}> = [
  { mode: "light", title: "Light", description: "Bright and breezy", emoji: "🌞" },
  { mode: "dark", title: "Dark", description: "Easy on the eyes", emoji: "🌙" },
  {
    mode: "system",
    title: "System",
    description: "Match device setting",
    emoji: "🪄",
  },
];

export default function ThemeSelectModal() {
  const router = useRouter();
  const { theme, preference, setPreference } = useThemeController();
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
    async (mode: ThemePreference) => {
      if (closingRef.current) return;
      closingRef.current = true;
      await setPreference(mode);
      await animateTo(
        SHEET_MAX_TRANSLATE,
        theme.motion.duration.normal,
        Easing.bezier(0.4, 0, 1, 1)
      );
      router.back();
    },
    [animateTo, router, setPreference, theme.motion.duration.normal]
  );

  return (
    <View style={styles.backdrop}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close theme selector"
        style={StyleSheet.absoluteFill}
        onPress={dismiss}
      />
      <Animated.View
        style={[
          styles.sheetContainer,
          { transform: [{ translateY }] },
        ]}
        {...panResponder.panHandlers}
      >
        <SafeAreaView
          edges={["bottom"]}
          style={styles.sheetSafeArea}
        >
          <View style={styles.handle} />
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetEmoji}>🎨</Text>
            <Text style={styles.sheetTitle}>Choose your style</Text>
            <Text style={styles.sheetSubtitle}>
              Pick a theme that matches your vibe.
            </Text>
          </View>
          <FlexGrid gutterWidth={theme.space.md} gutterHeight={theme.space.md}>
            <FlexGrid.Row wrap>
              {options.map((option) => (
                <FlexGrid.Col key={option.mode} span={12}>
                  <ThemeOptionButton
                    theme={theme}
                    option={option}
                    isActive={preference === option.mode}
                    onPress={() => handleSelect(option.mode)}
                  />
                </FlexGrid.Col>
              ))}
            </FlexGrid.Row>
          </FlexGrid>
        </SafeAreaView>
      </Animated.View>
    </View>
  );
}

type ThemeOptionButtonProps = {
  theme: WeeklyTheme;
  option: (typeof options)[number];
  isActive: boolean;
  onPress: () => void;
};

const ThemeOptionButton = ({
  theme,
  option,
  isActive,
  onPress,
}: ThemeOptionButtonProps) => {
  const styles = useMemo(() => optionStyles(theme), [theme]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.container,
        isActive ? styles.containerActive : null,
        pressed ? styles.containerPressed : null,
      ]}
    >
      <View style={styles.optionContent}>
        <Text style={styles.optionEmoji}>{option.emoji}</Text>
        <View style={styles.optionTextContainer}>
          <Text style={styles.optionTitle}>{option.title}</Text>
          <Text style={styles.optionDescription}>{option.description}</Text>
        </View>
      </View>
      {isActive ? (
        <MaterialCommunityIcons
          name="check-circle"
          size={22}
          color={theme.color.accent}
        />
      ) : (
        <MaterialCommunityIcons
          name="radiobox-blank"
          size={22}
          color={theme.color.subtleInk}
        />
      )}
    </Pressable>
  );
};

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
      paddingBottom: theme.space["2xl"],
      paddingHorizontal: theme.space.xl,
      gap: theme.space.lg,
    },
    handle: {
      alignSelf: "center",
      width: 48,
      height: 5,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.border,
      marginBottom: theme.space.sm,
    },
    sheetHeader: {
      alignItems: "center",
      gap: theme.space.sm,
    },
    sheetEmoji: {
      fontSize: 36,
    },
    sheetTitle: {
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
      color: theme.color.ink,
    },
    sheetSubtitle: {
      fontSize: theme.type.size.base,
      color: theme.color.subtleInk,
      textAlign: "center",
    },
  });

const optionStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    container: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.md,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
    },
    containerActive: {
      borderColor: theme.color.accent,
      backgroundColor: theme.color.surface,
    },
    containerPressed: {
      opacity: 0.9,
    },
    optionContent: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
    },
    optionEmoji: {
      fontSize: 28,
    },
    optionTextContainer: {
      gap: theme.space.xs,
    },
    optionTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    optionDescription: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
  });
