import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ReactNode, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

type AddButtonProps = {
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
  variant?: "icon" | "badge";
  label?: string;
  iconName?: IconName;
  active?: boolean;
};

type MenuButtonProps = {
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
  iconName?: IconName;
};

type ProfileButtonProps = {
  onPress: () => void;
  initials: string;
  backgroundColor: string;
  isPro?: boolean;
  testID?: string;
  accessibilityLabel?: string;
};

type Props = {
  uniformActionSize?: boolean;
  title?: string;
  header?: ReactNode;
  children: ReactNode;
  backgroundColor?: string;
  headerStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  streak?: {
    count: number;
    onPress?: () => void;
  };
  smartLevel?: {
    level: number;
    onPress?: () => void;
  };
  addBtn?: AddButtonProps;
  menuBtn?: MenuButtonProps;
  profileBtn?: ProfileButtonProps;
};

/**
 * TabParent
 * A simple wrapper that provides:
 * - Safe area background
 * - A large title header (like your reference screenshots)
 * - Padded content area
 */
export default function TabParent({
  title,
  children,
  backgroundColor,
  titleStyle,
  header,
  headerStyle,
  addBtn,
  menuBtn,
  profileBtn,
  streak,
  smartLevel,
  uniformActionSize = false,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const resolvedBackground = backgroundColor ?? theme.color.bg;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: resolvedBackground }]}
      edges={["top", "left", "right"]}
    >
      <View style={[styles.header, headerStyle]}>
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, titleStyle]}>{title}</Text>
          </View>
          <View style={styles.actions}>
            {profileBtn ? (
              <Pressable
                onPress={profileBtn.onPress}
                testID={profileBtn.testID}
                hitSlop={theme.space.xs}
                accessibilityRole="button"
                accessibilityLabel={
                  profileBtn.accessibilityLabel ?? "Open your family profile"
                }
                style={({ pressed }) => [
                  styles.profileButton,
                  { backgroundColor: profileBtn.backgroundColor },
                  pressed && styles.iconButtonPressed,
                ]}
              >
                {profileBtn.isPro ? (
                  <MaterialCommunityIcons
                    name="chef-hat"
                    size={21}
                    color={theme.color.accent}
                    style={styles.profileCrown}
                  />
                ) : null}
                <Text style={styles.profileButtonText} numberOfLines={1}>
                  {profileBtn.initials}
                </Text>
              </Pressable>
            ) : null}
            {typeof streak?.count === "number" ? (
              <Pressable
                disabled={!streak.onPress}
                onPress={streak.onPress}
                style={({ pressed }) => [
                  styles.streakPill,
                  uniformActionSize && styles.uniformAction,
                  streak.onPress && pressed && styles.streakPillPressed,
                ]}
                accessibilityRole={streak.onPress ? "button" : "text"}
                accessibilityLabel={`Week streak ${streak.count} weeks`}
              >
                <MaterialCommunityIcons
                  name={"fire" as IconName}
                  size={16}
                  color={theme.color.accent}
                />
                <Text style={styles.streakText}>{streak.count}</Text>
              </Pressable>
            ) : null}
            {typeof smartLevel?.level === "number" ? (
              <Pressable
                disabled={!smartLevel.onPress}
                onPress={smartLevel.onPress}
                style={({ pressed }) => [
                  styles.streakPill,
                  uniformActionSize && styles.uniformAction,
                  smartLevel.onPress && pressed && styles.streakPillPressed,
                ]}
                accessibilityRole={smartLevel.onPress ? "button" : "text"}
                accessibilityLabel={`Smart Level ${smartLevel.level}`}
              >
                <MaterialCommunityIcons
                  name={"magic-staff" as IconName}
                  size={16}
                  color={theme.color.accent}
                />
                <Text style={styles.streakText}>{smartLevel.level}</Text>
              </Pressable>
            ) : null}
            {addBtn ? (
              addBtn.variant === "badge" ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.badgeButton,
                    pressed && styles.badgeButtonPressed,
                  ]}
                  hitSlop={theme.space.xs}
                  accessibilityRole="button"
                  accessibilityLabel={
                    addBtn.accessibilityLabel ??
                    addBtn.label ??
                    "Add to freezer"
                  }
                  onPress={addBtn.onPress}
                  testID={addBtn.testID}
                >
                  <MaterialCommunityIcons
                    name={addBtn.iconName ?? ("snowflake" as IconName)}
                    size={18}
                    color={theme.color.accent}
                  />
                  <Text style={styles.badgeButtonText}>
                    {addBtn.label ?? "Add to freezer"}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  style={({ pressed }) => [
                    styles.iconButton,
                    styles.addButton,
                    addBtn.active && styles.addButtonActive,
                    pressed && styles.iconButtonPressed,
                  ]}
                  hitSlop={theme.space.xs}
                  accessibilityRole="button"
                  accessibilityLabel={addBtn.accessibilityLabel ?? "Add"}
                  onPress={addBtn.onPress}
                  testID={addBtn.testID}
                >
                  <MaterialCommunityIcons
                    name={addBtn.iconName ?? ("plus-circle" as IconName)}
                    size={24}
                    color={
                      addBtn.active
                        ? theme.color.accent
                        : theme.color.subtleInk
                    }
                  />
                </Pressable>
              )
            ) : null}
            {menuBtn ? (
              <Pressable
                style={({ pressed }) => [
                  styles.iconButton,
                  uniformActionSize && styles.uniformAction,
                  pressed && styles.iconButtonPressed,
                ]}
                hitSlop={theme.space.xs}
                accessibilityRole="button"
                accessibilityLabel={menuBtn.accessibilityLabel ?? "Open menu"}
                onPress={menuBtn.onPress}
                testID={menuBtn.testID}
              >
                <MaterialCommunityIcons
                  name={menuBtn.iconName ?? "dots-horizontal"}
                  size={22}
                  color={theme.color.ink}
                />
              </Pressable>
            ) : null}
          </View>
        </View>
        {header ? <View style={styles.customHeader}>{header}</View> : null}
      </View>

      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    safe: {
      flex: 1,
      paddingBottom: 0,
    },
    header: {
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space.md,
      paddingBottom: theme.space.md,
    },
    title: {
      fontSize: theme.type.size.h1,
      fontWeight: theme.type.weight.bold,
      color: theme.color.ink,
    },
    titleContainer: {
      flexShrink: 1,
      flexGrow: 1,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.space.md,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    profileButton: {
      width: 42,
      height: 42,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: theme.color.bg,
    },
    profileButtonText: {
      maxWidth: 34,
      color: "#FFFFFF",
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    profileCrown: {
      position: "absolute",
      top: -14,
      zIndex: 1,
    },
    streakPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
      paddingHorizontal: theme.space.sm,
      paddingVertical: theme.space.xs,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    streakText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    streakPillPressed: {
      opacity: 0.9,
    },
    uniformAction: {
      width: 48,
      height: 40,
      paddingHorizontal: 4,
      paddingVertical: 0,
      justifyContent: "center",
      borderRadius: 20,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      alignItems: "center",
      justifyContent: "center",
    },
    addButton: {
      width: 44,
      height: 44,
      backgroundColor: theme.color.surface,
    },
    addButtonActive: {
      borderColor: theme.color.accent,
      backgroundColor: theme.color.focus,
    },
    badgeButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.xs,
      paddingHorizontal: theme.space.md,
      height: 40,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    badgeButtonPressed: {
      opacity: 0.85,
    },
    badgeButtonText: {
      color: theme.color.accent,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    iconButtonPressed: {
      opacity: 0.85,
    },
    customHeader: {
      marginTop: theme.space.lg,
    },
    content: {
      flex: 1,
    },
  });
