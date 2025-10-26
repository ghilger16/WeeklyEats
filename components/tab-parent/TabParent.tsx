import { ReactNode, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  StyleProp,
  ViewStyle,
  TextStyle,
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
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const resolvedBackground = backgroundColor ?? theme.color.bg;

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: resolvedBackground }]}
      edges={["top", "left", "right", "bottom"]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, titleStyle]}>{title}</Text>
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
    content: {
      flex: 1,
    },
  });
