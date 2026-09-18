import { refreshScheduledNotifications } from "../../../services/notifications/service";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DevSettings, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useMemo } from "react";
import SettingsRow from "../../../components/settings/SettingsRow";
import TabParent from "../../../components/tab-parent/TabParent";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { useWeekStartController } from "../../../providers/week-start/WeekStartController";
import { PLANNED_WEEK_DISPLAY_NAMES } from "../../../types/weekPlan";
import { WeeklyTheme } from "../../../styles/theme";
import {
  getFeatureFlagDefaults,
  setFeatureFlagOverride,
  useFeatureFlags,
} from "../../../hooks/useFeatureFlags";
import type { FeatureFlags } from "../../../config/featureFlags";
import { useFamilyMembers } from "../../../hooks/useFamilyMembers";
import {
  isFamilyRatingsEligible,
  useRatingDisplayMode,
} from "../../../hooks/useRatingDisplayMode";
import { deriveFamilyInitials } from "../../../utils/familyInitials";
import { memberColorPalette } from "../../../components/meals/FamilyRatingIcons";
import { useSubscription } from "../../../hooks/useSubscription";

const FEATURE_FLAG_LABELS: Record<keyof FeatureFlags, string> = {
  recipeAutoFillEnabled: "Recipe Auto-fill",
  weekDashboardDateControlsEnabled: "Week Date Controls",
};

export default function MoreScreen() {
  const router = useRouter();
  const { theme, preference } = useThemeController();
  const { startDay } = useWeekStartController();
  const { members } = useFamilyMembers();
  const { mode: ratingDisplayMode } = useRatingDisplayMode();
  const subscription = useSubscription();
  const featureFlags = useFeatureFlags();
  const featureFlagDefaults = getFeatureFlagDefaults();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const familyInitials = useMemo(() => deriveFamilyInitials(members), [members]);
  const currentFamilyMember = members[0];

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

  const openFamilyModal = () => {
    router.push("/modals/family-members");
  };

  const openRatingStyleSelector = () => {
    router.push("/modals/rating-style");
  };

  const openFamilyProfile = () => {
    if (!currentFamilyMember) return;
    router.push({
      pathname: "/modals/family-profile",
      params: { memberId: currentFamilyMember.id },
    });
  };

  const resetOnboarding = async () => {
    await AsyncStorage.clear();
        await refreshScheduledNotifications();
    if (typeof DevSettings.reload === "function") {
      DevSettings.reload();
      return;
    }
    router.replace("/onboarding");
  };

  const weekStartLabel = PLANNED_WEEK_DISPLAY_NAMES[startDay];
  const canUseFamilyRatings = isFamilyRatingsEligible(members.length);
  const ratingStyleLabel =
    ratingDisplayMode === "family" ? "Family Ratings" : "Star Ratings";
  const featureFlagKeys = Object.keys(featureFlags) as Array<
    keyof FeatureFlags
  >;

  return (
    <TabParent
      backgroundColor={theme.color.bg}
      title="More"
      headerStyle={styles.header}
      titleStyle={styles.headerTitle}
      profileBtn={
        currentFamilyMember
          ? {
              onPress: openFamilyProfile,
              initials: familyInitials[currentFamilyMember.id] ?? "?",
              backgroundColor: memberColorPalette[0],
              isPro: subscription.status === "subscribed",
              accessibilityLabel: `Open profile for ${currentFamilyMember.name}, you`,
            }
          : undefined
      }
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
          <SettingsRow icon="bell-outline" label="Notifications" onPress={() => router.push("/modals/notifications")} />
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
            onPress={openFamilyModal}
          />
        </View>
        {canUseFamilyRatings ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Ratings</Text>
            <SettingsRow
              icon="star-outline"
              label="Rating Style"
              value={ratingStyleLabel}
              onPress={openRatingStyleSelector}
            />
          </View>
        ) : null}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Feature Flags</Text>
          {featureFlagKeys.map((key) => (
            <View style={styles.flagRow} key={key}>
              <View style={styles.flagTextGroup}>
                <Text style={styles.flagLabel}>{FEATURE_FLAG_LABELS[key]}</Text>
                <Text style={styles.flagDefault}>
                  Default: {featureFlagDefaults[key] ? "On" : "Off"}
                </Text>
              </View>
              <Switch
                value={featureFlags[key]}
                onValueChange={(value) => setFeatureFlagOverride(key, value)}
                trackColor={{
                  false: theme.color.surfaceAlt,
                  true: theme.color.accent,
                }}
                thumbColor={
                  featureFlags[key] ? theme.color.ink : theme.color.surface
                }
              />
            </View>
          ))}
        </View>
        {__DEV__ ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Testing</Text>
            <SettingsRow icon="bell-ring-outline" label="Test Notifications" onPress={() => router.push("/modals/test-notifications")} />
            <SettingsRow
              icon="restart"
              label="Reset Onboarding"
              onPress={resetOnboarding}
            />
            <SettingsRow
              icon="gift-outline"
              label="Subscription: First Week Free"
              value={subscription.status === "firstWeekFree" ? "Active" : undefined}
              onPress={() => void subscription.setDebugStatus("firstWeekFree")}
            />
            <SettingsRow
              icon="lock-outline"
              label="Subscription: Required"
              value={subscription.status === "subscriptionRequired" ? "Active" : undefined}
              onPress={() => void subscription.setDebugStatus("subscriptionRequired")}
            />
            <SettingsRow
              icon="crown-outline"
              label="Subscription: PRO"
              value={subscription.status === "subscribed" ? "Active" : undefined}
              onPress={() => void subscription.setDebugStatus("subscribed")}
            />
          </View>
        ) : null}
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
    flagRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: theme.space.md,
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.lg,
    },
    flagTextGroup: {
      flex: 1,
      gap: theme.space.xs,
    },
    flagLabel: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    flagDefault: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    sectionHeading: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textTransform: "uppercase",
      fontWeight: theme.type.weight.medium,
      letterSpacing: 1,
    },
  });
