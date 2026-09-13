import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { memberColorPalette } from "../../components/meals/FamilyRatingIcons";
import { useFamilyMembers } from "../../hooks/useFamilyMembers";
import { useMeals } from "../../hooks/useMeals";
import { useServedMeals } from "../../hooks/useServedMeals";
import { useSubscription } from "../../hooks/useSubscription";
import { useThemeController } from "../../providers/theme/ThemeController";
import { getWeekPlanHistory } from "../../stores/weekPlanStorage";
import { WeeklyTheme, alpha } from "../../styles/theme";
import { deriveFamilyInitials } from "../../utils/familyInitials";

type ActionRowProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  subtitle?: string;
  onPress: () => void;
  primary?: boolean;
  styles: ReturnType<typeof createStyles>;
  theme: WeeklyTheme;
};

const formatMonthYear = (date: Date) =>
  date.toLocaleDateString("en-US", { month: "short", year: "numeric" });

const ActionRow = ({ icon, title, subtitle, onPress, primary = false, styles, theme }: ActionRowProps) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title} style={({ pressed }) => [styles.actionRow, primary && styles.primaryAction, pressed && styles.actionPressed]}>
    <MaterialCommunityIcons name={icon} size={24} color={primary ? "#FFFFFF" : theme.color.accent} />
    <View style={styles.actionCopy}>
      <Text style={[styles.actionTitle, primary && styles.primaryActionText]}>{title}</Text>
      {subtitle ? <Text style={[styles.actionSubtitle, primary && styles.primaryActionText]}>{subtitle}</Text> : null}
    </View>
    {!primary ? <MaterialCommunityIcons name="chevron-right" size={24} color={theme.color.subtleInk} /> : null}
  </Pressable>
);

export default function FamilyProfileModal() {
  const router = useRouter();
  const { memberId: memberIdParam } = useLocalSearchParams<{ memberId?: string | string[] }>();
  const memberId = Array.isArray(memberIdParam) ? memberIdParam[0] : memberIdParam;
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { members } = useFamilyMembers();
  const { meals } = useMeals();
  const { entries: servedEntries, refresh: refreshServedMeals } = useServedMeals();
  const subscription = useSubscription();
  const [weeksPlanned, setWeeksPlanned] = useState(0);
  const [isResetting, setResetting] = useState(false);
  const initials = useMemo(() => deriveFamilyInitials(members), [members]);
  const foundMemberIndex = members.findIndex((member) => member.id === memberId);
  const memberIndex = foundMemberIndex >= 0 ? foundMemberIndex : 0;
  const currentMember = members[memberIndex];
  const isSubscribed = subscription.status === "subscribed";
  const planStatus = subscription.status === "firstWeekFree"
    ? "Free Week"
    : subscription.status === "subscriptionRequired"
      ? "Expired"
      : "Weekly Eats Pro";
  const memberSince = useMemo(() => {
    const timestamps = [...meals.map((meal) => meal.createdAt), ...servedEntries.map((entry) => entry.servedAtISO)]
      .map((value) => (value ? Date.parse(value) : Number.NaN))
      .filter(Number.isFinite);
    return timestamps.length ? formatMonthYear(new Date(Math.min(...timestamps))) : formatMonthYear(new Date());
  }, [meals, servedEntries]);

  const { refresh: refreshSubscription } = subscription;
  useFocusEffect(useCallback(() => {
    void refreshSubscription();
    void refreshServedMeals();
    void getWeekPlanHistory().then((history) => setWeeksPlanned(history.length));
  }, [refreshServedMeals, refreshSubscription]));

  const resetWeeklyEats = () => {
    Alert.alert("Reset Weekly Eats?", "This permanently removes your meals, plans, ratings, and settings from this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Reset", style: "destructive", onPress: async () => {
        setResetting(true);
        await AsyncStorage.clear();
        router.dismissAll();
        router.replace("/onboarding");
      } },
    ]);
  };
  const renewalLabel = subscription.renewalDateISO
    ? `Renews on ${new Date(subscription.renewalDateISO).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    : "Yearly plan";

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close your profile" />
      <SafeAreaView style={styles.sheet} edges={["bottom", "left", "right"]}>
        <View style={styles.handle} />
        <Pressable onPress={() => router.back()} hitSlop={theme.space.sm} accessibilityRole="button" accessibilityLabel="Close your profile" style={({ pressed }) => [styles.closeButton, pressed && styles.actionPressed]}>
          <MaterialCommunityIcons name="close" size={23} color={theme.color.ink} />
        </Pressable>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.identity}>
            {isSubscribed ? <MaterialCommunityIcons name="chef-hat" size={32} color={theme.color.accent} style={styles.chefHat} /> : null}
            <View style={[styles.avatar, { backgroundColor: memberColorPalette[memberIndex % memberColorPalette.length] }]}>
              {currentMember ? <Text style={styles.avatarText}>{initials[currentMember.id] ?? "?"}</Text> : <MaterialCommunityIcons name="account-outline" size={34} color="#FFFFFF" />}
            </View>
            {isSubscribed ? <Text style={styles.proBadge}>WEEKLY EATS PRO</Text> : null}
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}><Text style={styles.statLabel}>Weeks</Text><Text style={styles.statValue}>{weeksPlanned}</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.stat}><Text style={styles.statLabel}>Joined</Text><Text style={styles.statValue}>{memberSince}</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={styles.statLabel}>Plan</Text>
              <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                {subscription.isLoading ? "…" : planStatus}
              </Text>
            </View>
          </View>

          {subscription.isLoading ? <View style={styles.loadingCard}><ActivityIndicator color={theme.color.accent} /></View> : (
            <View style={[styles.statusCard, isSubscribed && styles.proStatusCard]}>
              <View style={styles.statusCopyRow}>
                <View style={styles.statusIcon}><MaterialCommunityIcons name={isSubscribed ? "chef-hat" : "calendar-check"} size={28} color={theme.color.accent} /></View>
                <View style={styles.statusCopy}>
                  <Text style={styles.statusTitle}>{subscription.status === "firstWeekFree" ? "Your first week is on us! 🎉" : subscription.status === "subscriptionRequired" ? "Great job! 🎉" : "You're on Weekly Eats PRO"}</Text>
                  <Text style={styles.statusText}>{subscription.status === "firstWeekFree" ? "Plan and enjoy your first full week free.\nNo subscription required." : subscription.status === "subscriptionRequired" ? "You planned your first week. Subscribe to plan your next week and keep making dinner easier." : renewalLabel}</Text>
                </View>
              </View>
            </View>
          )}

          {subscription.status !== "firstWeekFree" ? (
          <View style={styles.actions}>
            {subscription.status === "subscriptionRequired" ? <>
              <ActionRow icon="chef-hat" title="Continue with Weekly Eats" subtitle={subscription.annualPriceString ? `${subscription.annualPriceString} / year` : "Annual subscription"} onPress={() => void subscription.purchaseAnnual()} primary styles={styles} theme={theme} />
              <ActionRow icon="restore" title="Restore Purchases" onPress={() => void subscription.restorePurchases()} styles={styles} theme={theme} />
            </> : <>
              <ActionRow icon="credit-card-outline" title="Manage Subscription" onPress={() => void subscription.manageSubscription()} styles={styles} theme={theme} />
              <ActionRow icon="restore" title="Restore Purchases" onPress={() => void subscription.restorePurchases()} styles={styles} theme={theme} />
            </>}
          </View>
          ) : null}

          <View style={styles.footer}>
            <Text style={styles.savedCopy}>Your meals, plans, and history are always saved locally.</Text>
            <Pressable disabled={isResetting} onPress={resetWeeklyEats} accessibilityRole="button" accessibilityLabel="Reset Weekly Eats data" style={({ pressed }) => [styles.resetButton, pressed && styles.actionPressed]}>
              <Text style={styles.resetText}>{isResetting ? "Resetting…" : "Reset Weekly Eats"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.38)" },
  sheet: { height: "92%", overflow: "hidden", borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, backgroundColor: theme.color.bg, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
  handle: { width: 48, height: 5, alignSelf: "center", marginTop: theme.space.sm, borderRadius: theme.radius.full, backgroundColor: theme.color.subtleInk, opacity: 0.35 },
  closeButton: { position: "absolute", top: theme.space.lg, right: theme.space.xl, zIndex: 2, width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full, backgroundColor: theme.color.surfaceAlt },
  content: { paddingHorizontal: theme.space.xl, paddingTop: theme.space["2xl"] + theme.space.lg, paddingBottom: theme.space["2xl"], gap: theme.space.xl },
  identity: { minHeight: 94, alignItems: "center", justifyContent: "center", gap: theme.space.xs },
  avatar: { width: 68, height: 68, borderRadius: theme.radius.full, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFFFFF", fontSize: theme.type.size.h1, fontWeight: theme.type.weight.bold },
  chefHat: { marginBottom: -12, zIndex: 1 },
  proBadge: { overflow: "hidden", paddingHorizontal: theme.space.sm, paddingVertical: 3, borderRadius: theme.radius.full, color: "#FFFFFF", backgroundColor: theme.color.accent, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold },
  stats: { flexDirection: "row", alignItems: "stretch" },
  stat: { flex: 1, minWidth: 0, alignItems: "center", gap: theme.space.xs, paddingHorizontal: theme.space.xs },
  statLabel: { color: theme.color.subtleInk, fontSize: theme.type.size.xs, textAlign: "center" },
  statValue: { color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold, textAlign: "center" },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: theme.color.border },
  loadingCard: { minHeight: 170, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.lg, backgroundColor: theme.color.surface },
  statusCard: { minHeight: 170, overflow: "hidden", padding: theme.space.lg, borderRadius: theme.radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: alpha(theme.color.accent, 0.45), backgroundColor: alpha(theme.color.accent, theme.mode === "dark" ? 0.12 : 0.06) },
  proStatusCard: { borderColor: alpha(theme.color.success, 0.55) },
  statusCopyRow: { alignItems: "center", gap: theme.space.md, zIndex: 1 },
  statusIcon: { width: 48, height: 48, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full, backgroundColor: alpha(theme.color.accent, 0.12) },
  statusCopy: { alignItems: "center", gap: theme.space.sm },
  statusTitle: { color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold, textAlign: "center" },
  statusText: { color: theme.color.ink, fontSize: theme.type.size.sm, lineHeight: 21, textAlign: "center" },
  actions: { gap: theme.space.md },
  actionRow: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: theme.space.md, paddingHorizontal: theme.space.lg, paddingVertical: theme.space.md, borderRadius: theme.radius.lg, backgroundColor: theme.color.surfaceAlt, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.color.border },
  primaryAction: { justifyContent: "center", backgroundColor: theme.color.accent, borderColor: theme.color.accent },
  actionCopy: { flex: 1, gap: 3 },
  actionTitle: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
  actionSubtitle: { color: theme.color.subtleInk, fontSize: theme.type.size.sm, lineHeight: 19 },
  primaryActionText: { color: "#FFFFFF", textAlign: "center" },
  actionPressed: { opacity: 0.72 },
  footer: { alignItems: "center", gap: theme.space.lg, paddingTop: theme.space.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border },
  savedCopy: { color: theme.color.subtleInk, fontSize: theme.type.size.xs, lineHeight: 18, textAlign: "center" },
  resetButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: theme.space.lg },
  resetText: { color: theme.color.danger, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold },
});
