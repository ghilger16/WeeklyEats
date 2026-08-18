import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFamilyMembers } from "../../hooks/useFamilyMembers";
import {
  isFamilyRatingsEligible,
  RatingDisplayMode,
  useRatingDisplayMode,
} from "../../hooks/useRatingDisplayMode";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";

const OPTIONS: Array<{
  mode: Extract<RatingDisplayMode, "family" | "summary">;
  title: string;
  description: string;
  symbols: string;
}> = [
  {
    mode: "family",
    title: "Family Ratings",
    description: "Rate meals by each family member.",
    symbols: "❤️  🙂  👎",
  },
  {
    mode: "summary",
    title: "Star Ratings",
    description: "Use one simple 1–5 star rating for each meal.",
    symbols: "★★★★★",
  },
];

export default function RatingStyleModal() {
  const router = useRouter();
  const { theme } = useThemeController();
  const { members } = useFamilyMembers();
  const { mode, setMode } = useRatingDisplayMode();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isEligible = isFamilyRatingsEligible(members.length);

  useEffect(() => {
    if (!isEligible) router.back();
  }, [isEligible, router]);

  const handleSelect = useCallback(
    (nextMode: Extract<RatingDisplayMode, "family" | "summary">) => {
      setMode(nextMode);
    },
    [setMode],
  );

  if (!isEligible) return null;

  return (
    <View style={styles.backdrop}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close rating style selector"
        style={StyleSheet.absoluteFill}
        onPress={() => router.back()}
      />
      <SafeAreaView style={styles.sheet} edges={["bottom"]}>
        <View style={styles.sheetTopRow}>
          <View style={styles.handle} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close rating style selector"
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.optionPressed,
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
          <Text style={styles.title}>Rating Style</Text>
          <Text style={styles.subtitle}>Choose how you want to rate meals.</Text>
        </View>
        <View style={styles.options}>
          {OPTIONS.map((option) => {
            const isSelected = mode === option.mode;
            return (
              <Pressable
                key={option.mode}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={option.title}
                onPress={() => handleSelect(option.mode)}
                style={({ pressed }) => [
                  styles.option,
                  isSelected && styles.optionSelected,
                  pressed && styles.optionPressed,
                ]}
              >
                <View style={styles.optionCopy}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                  <Text style={styles.symbols}>{option.symbols}</Text>
                </View>
                <MaterialCommunityIcons
                  name={isSelected ? "check-circle" : "radiobox-blank"}
                  size={23}
                  color={isSelected ? theme.color.accent : theme.color.subtleInk}
                />
              </Pressable>
            );
          })}
        </View>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(0,0,0,0.45)",
    },
    sheet: {
      gap: theme.space.lg,
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space.md,
      paddingBottom: theme.space["2xl"],
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      backgroundColor: theme.color.surface,
    },
    sheetTopRow: {
      minHeight: 36,
      alignItems: "center",
      justifyContent: "center",
    },
    handle: {
      width: 48,
      height: 5,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.border,
    },
    closeButton: {
      position: "absolute",
      right: 0,
      width: 36,
      height: 36,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: theme.radius.full,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      backgroundColor: theme.color.surfaceAlt,
    },
    header: { alignItems: "center", gap: theme.space.sm },
    title: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
    },
    subtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      textAlign: "center",
    },
    options: { gap: theme.space.md },
    option: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
      padding: theme.space.lg,
      borderRadius: theme.radius.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      backgroundColor: theme.color.surfaceAlt,
    },
    optionSelected: {
      borderColor: theme.color.accent,
      backgroundColor: theme.color.focus,
    },
    optionPressed: { opacity: 0.85 },
    optionCopy: { flex: 1, gap: theme.space.xs },
    optionTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    optionDescription: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      lineHeight: 20,
    },
    symbols: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      letterSpacing: 1,
    },
  });
