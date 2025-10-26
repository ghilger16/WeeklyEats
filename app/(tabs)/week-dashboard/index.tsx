import { Text, StyleSheet } from "react-native";
import { useMemo } from "react";
import TabParent from "../../../components/tab-parent/TabParent";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";

export default function WeekDashboardScreen() {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <TabParent title="Week Dashboard">
      <Text style={styles.p}>Plan your dinners for the week here.</Text>
    </TabParent>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    p: {
      fontSize: theme.type.size.base,
      color: theme.color.ink,
    },
  });
