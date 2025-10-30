import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import SettingsRow from "../../../components/settings/SettingsRow";
import TabParent from "../../../components/tab-parent/TabParent";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { useWeekStartController } from "../../../providers/week-start/WeekStartController";
import { PLANNED_WEEK_DISPLAY_NAMES } from "../../../types/weekPlan";
import { WeeklyTheme } from "../../../styles/theme";

export default function MoreScreen() {
  const router = useRouter();
  const { theme, preference } = useThemeController();
  const { startDay } = useWeekStartController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const preferenceLabel =
    preference === "system"
      ? "System"
      : preference === "light"
      ? "Light"
      : "Dark";

  const openThemeSelector = () => {
    router.push("/modals/theme-select");
  };

  const openWeekStartSelector = () => {
    router.push("/modals/week-start");
  };

  const weekStartLabel = PLANNED_WEEK_DISPLAY_NAMES[startDay];

  return (
    <TabParent
      backgroundColor={theme.color.bg}
      title="More"
      headerStyle={styles.header}
      titleStyle={styles.headerTitle}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Appearance</Text>
          <SettingsRow
            icon="palette-outline"
            label="Color Theme"
            value={preferenceLabel}
            onPress={openThemeSelector}
          />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Preferences</Text>
          <SettingsRow icon="bell-outline" label="Notifications" />
          <SettingsRow
            icon="calendar-start"
            label="Week Start Day"
            value={weekStartLabel}
            onPress={openWeekStartSelector}
          />
        </View>
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Family</Text>
          <SettingsRow
            icon="account-multiple-outline"
            label="Manage Family Members"
          />
        </View>
      </ScrollView>
    </TabParent>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    header: {
      borderBottomWidth: 0,
      paddingBottom: theme.space.sm,
    },
    headerTitle: {
      fontSize: theme.type.size.h1,
      fontWeight: theme.type.weight.bold,
      color: theme.color.ink,
    },
    scrollContent: {
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space["2xl"],
      paddingBottom: theme.space["2xl"],
      gap: theme.space["2xl"],
    },
    section: {
      gap: theme.space.md,
    },
    sectionHeading: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textTransform: "uppercase",
      fontWeight: theme.type.weight.medium,
      letterSpacing: 1,
    },
  });
