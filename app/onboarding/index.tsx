import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFamilyMembers } from "../../hooks/useFamilyMembers";
import { useThemeController } from "../../providers/theme/ThemeController";
import { useWeekStartController } from "../../providers/week-start/WeekStartController";
import { WeeklyTheme } from "../../styles/theme";
import {
  PLANNED_WEEK_DISPLAY_NAMES,
  PLANNED_WEEK_ORDER,
  PlannedWeekDayKey,
} from "../../types/weekPlan";
import {
  setOnboardingAccount,
  setOnboardingCompleted,
} from "../../stores/onboardingStorage";
import { deriveFamilyInitials } from "../../utils/familyInitials";

type OnboardingStep =
  | "welcome"
  | "account"
  | "trust"
  | "shoppingDay"
  | "family"
  | "paywall";

const STEPS: OnboardingStep[] = [
  "welcome",
  "account",
  "trust",
  "shoppingDay",
  "family",
  "paywall",
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { setStartDay, startDay } = useWeekStartController();
  const { addMember } = useFamilyMembers();
  const [stepIndex, setStepIndex] = useState(0);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [shoppingDay, setShoppingDay] =
    useState<PlannedWeekDayKey>(startDay);
  const [familyMembers, setFamilyMembers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [familyMemberInput, setFamilyMemberInput] = useState("");
  const [isFamilyDeleteMode, setFamilyDeleteMode] = useState(false);
  const [isFinishing, setFinishing] = useState(false);

  const step = STEPS[stepIndex];
  const progress = `${stepIndex + 1} / ${STEPS.length}`;

  const goNext = useCallback(() => {
    setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, []);

  const goBack = useCallback(() => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const finishOnboarding = useCallback(async () => {
    if (isFinishing) {
      return;
    }

    setFinishing(true);
    await setOnboardingAccount({
      email: email.trim(),
      password,
    });
    await setStartDay(shoppingDay);

    for (const member of familyMembers) {
      const trimmed = member.name.trim();
      if (trimmed) {
        await addMember(trimmed);
      }
    }

    await setOnboardingCompleted(true);
    router.replace("/week-dashboard");
  }, [
    addMember,
    email,
    familyMembers,
    isFinishing,
    password,
    router,
    setStartDay,
    shoppingDay,
  ]);

  const handleAccountContinue = useCallback(async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Account setup", "Add an email and password to continue.");
      return;
    }

    await setOnboardingAccount({
      email: email.trim(),
      password,
    });
    goNext();
  }, [email, goNext, password]);

  const familyInitialsMap = useMemo(
    () => deriveFamilyInitials(familyMembers),
    [familyMembers]
  );

  const handleAddFamilyMember = useCallback(() => {
    const trimmed = familyMemberInput.trim();
    if (!trimmed) {
      return;
    }
    setFamilyMembers((prev) => [
      {
        id: `onboarding-member-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        name: trimmed,
      },
      ...prev,
    ]);
    setFamilyMemberInput("");
    setFamilyDeleteMode(false);
  }, [familyMemberInput]);

  const handleRemoveFamilyMember = useCallback((id: string) => {
    setFamilyMembers((prev) => prev.filter((member) => member.id !== id));
  }, []);

  const toggleFamilyDeleteMode = useCallback(() => {
    if (familyMembers.length === 0) {
      return;
    }
    setFamilyDeleteMode((prev) => !prev);
  }, [familyMembers.length]);

  const renderStep = () => {
    switch (step) {
      case "welcome":
        return (
          <View style={styles.centeredStep}>
            <View style={styles.logoMark}>
              <MaterialCommunityIcons
                name="silverware-fork-knife"
                size={44}
                color={theme.color.accent}
              />
            </View>
            <Text style={styles.heroTitle}>Weekly Eats</Text>
            <Text style={styles.heroSubtitle}>
              Plan once. Eat happy all week.
            </Text>
            <Pressable style={styles.primaryButton} onPress={goNext}>
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </Pressable>
          </View>
        );
      case "account":
        return (
          <View style={styles.step}>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              We will save this locally for now and use it for sync later.
            </Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={theme.color.subtleInk}
              autoCapitalize="none"
              keyboardType="email-address"
              style={styles.input}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={theme.color.subtleInk}
              secureTextEntry
              style={styles.input}
            />
            <View style={styles.socialRow}>
              <View style={styles.socialButton}>
                <Text style={styles.socialButtonText}>Apple</Text>
              </View>
              <View style={styles.socialButton}>
                <Text style={styles.socialButtonText}>Google</Text>
              </View>
            </View>
            <Pressable style={styles.primaryButton} onPress={handleAccountContinue}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>
          </View>
        );
      case "trust":
        return (
          <View style={styles.step}>
            <Text style={styles.title}>Built for calmer weeks</Text>
            <View style={styles.badgeList}>
              <TrustBadge icon="star" text="Rated 4.8 stars" />
              <TrustBadge icon="lightbulb-on-outline" text="Saves families 2 hours a week" />
              <TrustBadge icon="cash-multiple" text="Helps cut grocery waste" />
            </View>
            <Pressable style={styles.primaryButton} onPress={goNext}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>
          </View>
        );
      case "shoppingDay":
        return (
          <View style={styles.step}>
            <Text style={styles.title}>Pick your grocery reset day</Text>
            <Text style={styles.subtitle}>
              Choosing one shopping day each week gives your meal plan a clear
              rhythm: plan before you shop, restock once, and start fresh on the
              same day.
            </Text>
            <Text style={styles.sectionLabel}>Grocery shopping day</Text>
            <View style={styles.dayGrid}>
              {PLANNED_WEEK_ORDER.map((day) => {
                const selected = shoppingDay === day;
                return (
                  <Pressable
                    key={day}
                    onPress={() => setShoppingDay(day)}
                    style={[
                      styles.dayChip,
                      selected && styles.dayChipSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        selected && styles.dayChipTextSelected,
                      ]}
                    >
                      {PLANNED_WEEK_DISPLAY_NAMES[day].slice(0, 3)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.primaryButton} onPress={goNext}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>
          </View>
        );
      case "family":
        return (
          <View style={styles.step}>
            <View style={styles.familyTable}>
              <View style={styles.familyHandle} />
              <View style={styles.familyHeader}>
                <Text style={styles.familyEmoji}>🧑‍🍳</Text>
                <Text style={styles.familyTitle}>Family Table</Text>
                <Text style={styles.familySubtitle}>
                  Add the people you cook for. We’ll keep their initials handy.
                </Text>
              </View>
              {familyMembers.length > 0 ? (
                <View style={styles.familyChipGrid}>
                  {familyMembers.map((member) => (
                    <Pressable
                      key={member.id}
                      onPress={() => {
                        if (isFamilyDeleteMode) {
                          handleRemoveFamilyMember(member.id);
                        }
                      }}
                      accessibilityRole={
                        isFamilyDeleteMode ? "button" : undefined
                      }
                      accessibilityLabel={
                        isFamilyDeleteMode
                          ? `Remove ${member.name}`
                          : `Family member ${member.name}`
                      }
                      style={({ pressed }) => [
                        styles.familyChip,
                        pressed && styles.familyChipPressed,
                        isFamilyDeleteMode && styles.familyChipDeleteMode,
                      ]}
                    >
                      <View style={styles.familyChipInitial}>
                        <Text style={styles.familyChipInitialText}>
                          {familyInitialsMap[member.id] ?? "?"}
                        </Text>
                      </View>
                      <Text style={styles.familyChipName} numberOfLines={1}>
                        {member.name}
                      </Text>
                      {isFamilyDeleteMode ? (
                        <MaterialCommunityIcons
                          name="close"
                          size={16}
                          color={theme.color.subtleInk}
                        />
                      ) : null}
                    </Pressable>
                  ))}
                </View>
              ) : null}
              <View style={styles.familyInputRow}>
                <TextInput
                  value={familyMemberInput}
                  onChangeText={setFamilyMemberInput}
                  placeholder="Add a family member"
                  placeholderTextColor={theme.color.subtleInk}
                  style={styles.familyTextInput}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleAddFamilyMember}
                />
                <Pressable
                  onPress={toggleFamilyDeleteMode}
                  disabled={familyMembers.length === 0}
                  accessibilityRole="button"
                  accessibilityLabel={
                    isFamilyDeleteMode
                      ? "Exit delete mode"
                      : "Delete family members"
                  }
                  style={({ pressed }) => [
                    styles.familyTrashButton,
                    pressed &&
                      familyMembers.length > 0 &&
                      styles.familyTrashPressed,
                    isFamilyDeleteMode && styles.familyTrashActive,
                    familyMembers.length === 0 && styles.familyTrashDisabled,
                  ]}
                >
                  <MaterialCommunityIcons
                    name={isFamilyDeleteMode ? "trash-can" : "trash-can-outline"}
                    size={28}
                    color={theme.color.ink}
                  />
                </Pressable>
              </View>
            </View>
            <Pressable style={styles.primaryButton} onPress={goNext}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>
          </View>
        );
      case "paywall":
        return (
          <View style={styles.step}>
            <Text style={styles.title}>Try Weekly Eats Pro</Text>
            <Text style={styles.subtitle}>
              Unlock the full planner before your first week gets busy.
            </Text>
            <View style={styles.priceCard}>
              <Text style={styles.priceBadge}>Best value</Text>
              <Text style={styles.priceTitle}>$34.99 / year</Text>
              <Text style={styles.priceSubtext}>Start with a free trial</Text>
            </View>
            <View style={styles.secondaryPriceCard}>
              <Text style={styles.priceTitle}>$4.99 / month</Text>
            </View>
            <Pressable style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Start Free Trial</Text>
            </Pressable>
            <Pressable
              style={styles.skipButton}
              onPress={finishOnboarding}
              disabled={isFinishing}
            >
              <Text style={styles.skipButtonText}>
                {isFinishing ? "Finishing..." : "Skip for Now"}
              </Text>
            </Pressable>
            <View style={styles.featureList}>
              {[
                "Unlimited Meals",
                "Grocery Staples",
                "Family Ratings",
                "Freezer Stash",
                "Widgets",
              ].map((feature) => (
                <View style={styles.featureRow} key={feature}>
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={18}
                    color={theme.color.success}
                  />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
            <View style={styles.faqCard}>
              <Text style={styles.faqTitle}>Can I use it free?</Text>
              <Text style={styles.faqText}>
                Yes. Free keeps the basics available with limits while Pro
                unlocks the full weekly system.
              </Text>
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <View style={styles.topBar}>
          {stepIndex > 0 ? (
            <Pressable onPress={goBack} style={styles.backButton}>
              <MaterialCommunityIcons
                name="arrow-left"
                size={22}
                color={theme.color.ink}
              />
            </Pressable>
          ) : (
            <View style={styles.backButtonPlaceholder} />
          )}
          <Text style={styles.progressText}>{progress}</Text>
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {renderStep()}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function TrustBadge({ icon, text }: { icon: any; text: string }) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.trustBadge}>
      <MaterialCommunityIcons name={icon} size={22} color={theme.color.accent} />
      <Text style={styles.trustText}>{text}</Text>
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.color.bg,
    },
    keyboardView: {
      flex: 1,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space.md,
    },
    backButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
    },
    backButtonPlaceholder: {
      width: 44,
      height: 44,
    },
    progressText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: theme.space.xl,
      paddingVertical: theme.space["2xl"],
    },
    centeredStep: {
      flex: 1,
      minHeight: 560,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.lg,
    },
    step: {
      gap: theme.space.lg,
    },
    logoMark: {
      width: 96,
      height: 96,
      borderRadius: theme.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surface,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
    },
    heroTitle: {
      color: theme.color.ink,
      fontSize: 40,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    heroSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.h2,
      textAlign: "center",
      lineHeight: theme.type.size.h2 * 1.3,
    },
    title: {
      color: theme.color.ink,
      fontSize: theme.type.size.h1,
      fontWeight: theme.type.weight.bold,
    },
    subtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      lineHeight: theme.type.size.base * 1.4,
    },
    input: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.md,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    primaryButton: {
      minHeight: 52,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.color.accent,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.space.lg,
    },
    primaryButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    socialRow: {
      flexDirection: "row",
      gap: theme.space.sm,
    },
    socialButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    socialButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    badgeList: {
      gap: theme.space.md,
    },
    trustBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
      padding: theme.space.lg,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
    },
    trustText: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    sectionLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    dayGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.sm,
    },
    dayChip: {
      minWidth: 72,
      minHeight: 44,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    dayChipSelected: {
      backgroundColor: theme.color.accent,
      borderColor: theme.color.accent,
    },
    dayChipText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    dayChipTextSelected: {
      color: theme.color.ink,
    },
    familyTable: {
      gap: theme.space.lg,
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space.lg,
      paddingBottom: theme.space["2xl"],
      marginHorizontal: -theme.space.xl,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      backgroundColor: theme.color.surface,
    },
    familyHandle: {
      alignSelf: "center",
      width: 52,
      height: 5,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      opacity: 0.8,
    },
    familyHeader: {
      alignItems: "center",
      gap: theme.space.sm,
    },
    familyEmoji: {
      fontSize: 36,
    },
    familyTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h1,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    familySubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      lineHeight: theme.type.size.base * 1.25,
      textAlign: "center",
    },
    familyChipGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.sm,
    },
    familyChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      maxWidth: "100%",
      borderRadius: theme.radius.full,
      paddingVertical: theme.space.xs,
      paddingLeft: theme.space.xs,
      paddingRight: theme.space.md,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    familyChipPressed: {
      opacity: 0.8,
    },
    familyChipDeleteMode: {
      borderColor: theme.color.danger,
    },
    familyChipInitial: {
      width: 34,
      height: 34,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.accent,
    },
    familyChipInitialText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    familyChipName: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
      maxWidth: 180,
    },
    familyInputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
    },
    familyTextInput: {
      flex: 1,
      minHeight: 64,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surfaceAlt,
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      paddingHorizontal: theme.space.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    familyTrashButton: {
      width: 72,
      height: 72,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.accent,
    },
    familyTrashPressed: {
      opacity: 0.82,
    },
    familyTrashActive: {
      borderWidth: 2,
      borderColor: theme.color.ink,
    },
    familyTrashDisabled: {
      opacity: 0.5,
    },
    priceCard: {
      gap: theme.space.xs,
      padding: theme.space.lg,
      borderRadius: theme.radius.lg,
      backgroundColor:
        theme.mode === "dark" ? "rgba(255, 75, 145, 0.16)" : "#FFF0F6",
      borderWidth: 1,
      borderColor: theme.color.accent,
    },
    secondaryPriceCard: {
      padding: theme.space.lg,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    priceBadge: {
      alignSelf: "flex-start",
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    priceTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
    },
    priceSubtext: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
    },
    skipButton: {
      minHeight: 48,
      borderRadius: theme.radius.xl,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
    },
    skipButtonText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    featureList: {
      gap: theme.space.sm,
    },
    featureRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
    },
    featureText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
    },
    faqCard: {
      gap: theme.space.xs,
      padding: theme.space.lg,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
    },
    faqTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    faqText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      lineHeight: theme.type.size.sm * 1.4,
    },
  });
