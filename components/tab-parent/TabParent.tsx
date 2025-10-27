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

type Props = {
  title?: string;
  header?: ReactNode;
  children: ReactNode;
  backgroundColor?: string;
  headerStyle?: StyleProp<ViewStyle>;
  titleStyle?: StyleProp<TextStyle>;
  addBtn?: {
    onPress: () => void;
    testID?: string;
    accessibilityLabel?: string;
  };
  menuBtn?: {
    onPress: () => void;
    testID?: string;
    accessibilityLabel?: string;
  };
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
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const resolvedBackground = backgroundColor ?? theme.color.bg;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: resolvedBackground }]}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={[styles.header, headerStyle]}>
        <View style={styles.headerRow}>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, titleStyle]}>{title}</Text>
          </View>
          <View style={styles.actions}>
            {addBtn ? (
              <Pressable
                style={({ pressed }) => [
                  styles.iconButton,
                  styles.addButton,
                  pressed && styles.iconButtonPressed,
                ]}
                hitSlop={theme.space.xs}
                accessibilityRole="button"
                accessibilityLabel={addBtn.accessibilityLabel ?? "Add"}
                onPress={addBtn.onPress}
                testID={addBtn.testID}
              >
                <MaterialCommunityIcons
                  name="plus-circle"
                  size={22}
                  color={theme.color.accent}
                />
              </Pressable>
            ) : null}
            {menuBtn ? (
              <Pressable
                style={({ pressed }) => [
                  styles.iconButton,
                  pressed && styles.iconButtonPressed,
                ]}
                hitSlop={theme.space.xs}
                accessibilityRole="button"
                accessibilityLabel={menuBtn.accessibilityLabel ?? "Open menu"}
                onPress={menuBtn.onPress}
                testID={menuBtn.testID}
              >
                <MaterialCommunityIcons
                  name="dots-horizontal"
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
      backgroundColor: theme.color.surface,
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
