import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Href, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSubscription } from "../../hooks/useSubscription";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme, alpha } from "../../styles/theme";
import { trackAction } from "../../services/analytics";

const BENEFITS = [
  { icon: "calendar-week" as const, title: "Plan unlimited weeks" },
  { icon: "cart-outline" as const, title: "Build your grocery list automatically" },
  { icon: "star" as const, title: "Get smarter suggestions" },
];

const PRIVACY_POLICY_URL = "https://weeklyeats.site/privacy";
const TERMS_OF_USE_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

export default function SubscriptionRequiredModal() {
  const router = useRouter();
  const { planningIntent: planningIntentParam } = useLocalSearchParams<{ planningIntent?: string | string[] }>();
  const planningIntent = Array.isArray(planningIntentParam) ? planningIntentParam[0] : planningIntentParam;
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const subscription = useSubscription();
  const [isPurchasing, setPurchasing] = useState(false);
  const annualPriceLabel = subscription.annualPriceString
    ? `${subscription.annualPriceString} / year`
    : "Annual subscription";

  useEffect(() => {
    trackAction("paywall_viewed", {
      trigger: planningIntent ? "plan_week" : "unknown",
    });
  }, [planningIntent]);

  const continuePlanning = async () => {
    if (isPurchasing) return;
    setPurchasing(true);
    const result = await subscription.purchaseAnnual();
    setPurchasing(false);
    if (result.succeeded) {
      router.replace((planningIntent || "/modals/plan-week") as Href);
    }
  };

  const restoreAndContinue = async () => {
    const result = await subscription.restorePurchases();
    if (result.succeeded) {
      router.replace((planningIntent || "/modals/plan-week") as Href);
    }
  };

  return (
    <View style={styles.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Not now" />
      <SafeAreaView style={styles.sheet} edges={["bottom", "left", "right"]}>
        <View style={styles.handle} />
        <Pressable onPress={() => router.back()} hitSlop={theme.space.sm} accessibilityRole="button" accessibilityLabel="Close subscription paywall" style={({ pressed }) => [styles.close, pressed && styles.pressed]}>
          <MaterialCommunityIcons name="close" size={22} color={theme.color.ink} />
        </Pressable>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="calendar-check" size={48} color={theme.color.accent} />
          </View>
          <Text style={styles.title}>Ready for another week?</Text>

          <View style={styles.benefits}>
            {BENEFITS.map((benefit, index) => (
              <View key={benefit.title} style={[styles.benefit, index > 0 && styles.benefitDivider]}>
                <View style={styles.roundIcon}><MaterialCommunityIcons name={benefit.icon} size={25} color={theme.color.accent} /></View>
                <View style={styles.flexCopy}><Text style={styles.cardTitle}>{benefit.title}</Text></View>
              </View>
            ))}
          </View>

          <View style={styles.offer} accessible accessibilityLabel={`Weekly Eats Pro, ${annualPriceLabel}, auto-renewing annual subscription`}>
            <View style={styles.offerIcon}><MaterialCommunityIcons name="chef-hat" size={34} color={theme.color.accent} /></View>
            <View style={styles.flexCopy}>
              <Text style={styles.offerTitle}>Weekly Eats Pro</Text>
              <Text style={styles.price}>{annualPriceLabel}</Text>
              {subscription.monthlyEquivalentPriceString ? <Text style={styles.bodyText}>{subscription.monthlyEquivalentPriceString} per month</Text> : null}
            </View>
          </View>

          <Pressable disabled={isPurchasing} onPress={() => void continuePlanning()} accessibilityRole="button" accessibilityLabel={`Subscribe to Weekly Eats Pro for ${annualPriceLabel}`} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
            {isPurchasing ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Subscribe &amp; Continue</Text>}
          </Pressable>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Not Now" style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}><Text style={styles.secondaryText}>Not Now</Text></Pressable>
          <Pressable onPress={() => void restoreAndContinue()} accessibilityRole="button" accessibilityLabel="Restore Purchases" style={({ pressed }) => [styles.restore, pressed && styles.pressed]}>
            <MaterialCommunityIcons name="restore" size={20} color={theme.color.accent} /><Text style={styles.restoreText}>Restore Purchases</Text>
          </Pressable>
          <Text style={styles.renewalDisclosure}>Payment will be charged to your Apple Account. Subscription renews automatically each year unless cancelled at least 24 hours before the end of the current period. Manage or cancel in your Apple Account settings.</Text>
          <View style={styles.legalLinks}>
            <Pressable onPress={() => void Linking.openURL(PRIVACY_POLICY_URL)} accessibilityRole="link" accessibilityLabel="Open Privacy Policy"><Text style={styles.legalLinkText}>Privacy Policy</Text></Pressable>
            <Text style={styles.legalSeparator}>•</Text>
            <Pressable onPress={() => void Linking.openURL(TERMS_OF_USE_URL)} accessibilityRole="link" accessibilityLabel="Open Terms of Use"><Text style={styles.legalLinkText}>Terms of Use</Text></Pressable>
          </View>
          <Text style={styles.reassurance}>Your meals, plans, and history will always be here.</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.42)" },
  sheet: { height: "88%", overflow: "hidden", borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl, backgroundColor: theme.color.bg },
  handle: { position: "absolute", zIndex: 2, top: theme.space.sm, alignSelf: "center", width: 48, height: 5, borderRadius: theme.radius.full, backgroundColor: alpha(theme.color.subtleInk, 0.35) },
  close: { position: "absolute", zIndex: 3, top: theme.space.lg, right: theme.space.xl, width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full, backgroundColor: theme.color.surfaceAlt },
  content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: theme.space.xl, paddingTop: 54, paddingBottom: theme.space.xl, gap: theme.space.md },
  heroIcon: { alignSelf: "center", width: 68, height: 68, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full, backgroundColor: alpha(theme.color.accent, 0.1) },
  title: { color: theme.color.ink, fontSize: theme.type.size.h1, fontWeight: theme.type.weight.bold, textAlign: "center" },
  accomplishment: { minHeight: 86, flexDirection: "row", alignItems: "center", gap: theme.space.md, padding: theme.space.md, borderRadius: theme.radius.lg, backgroundColor: alpha(theme.color.accent, theme.mode === "dark" ? 0.14 : 0.07) },
  roundIcon: { width: 48, height: 48, flexShrink: 0, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full, backgroundColor: alpha(theme.color.accent, 0.11) },
  flexCopy: { flex: 1, gap: 3 },
  cardTitle: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
  bodyText: { color: theme.color.subtleInk, fontSize: theme.type.size.sm, lineHeight: 20 },
  benefits: { borderRadius: theme.radius.lg, backgroundColor: theme.color.surface },
  benefit: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: theme.space.md, paddingHorizontal: theme.space.md, paddingVertical: theme.space.sm },
  benefitDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.border },
  offer: { minHeight: 100, flexDirection: "row", alignItems: "center", gap: theme.space.md, padding: theme.space.md, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.accent, backgroundColor: alpha(theme.color.accent, theme.mode === "dark" ? 0.12 : 0.05) },
  offerIcon: { width: 54, height: 54, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full, backgroundColor: alpha(theme.color.accent, 0.11) },
  offerTitle: { color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  price: { color: theme.color.accent, fontSize: theme.type.size.h2, fontWeight: theme.type.weight.bold },
  primary: { minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full, backgroundColor: theme.color.accent },
  primaryText: { color: "#FFFFFF", fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
  secondary: { minHeight: 46, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full, backgroundColor: theme.color.surfaceAlt },
  secondaryText: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
  restore: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm },
  restoreText: { color: theme.color.accent, fontSize: theme.type.size.base, fontWeight: theme.type.weight.medium },
  renewalDisclosure: { color: theme.color.subtleInk, fontSize: 11, lineHeight: 15, textAlign: "center" },
  legalLinks: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm },
  legalLinkText: { color: theme.color.accent, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold, textDecorationLine: "underline" },
  legalSeparator: { color: theme.color.subtleInk, fontSize: theme.type.size.xs },
  reassurance: { color: theme.color.subtleInk, fontSize: theme.type.size.xs, lineHeight: 19, textAlign: "center" },
  pressed: { opacity: 0.75 },
});
