import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
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
import { memberColorPalette } from "../../components/meals/FamilyRatingIcons";
import { useFamilyMembers } from "../../hooks/useFamilyMembers";
import { useThemeController } from "../../providers/theme/ThemeController";
import { useWeekStartController } from "../../providers/week-start/WeekStartController";
import { WeeklyTheme } from "../../styles/theme";
import {
  PLANNED_WEEK_DISPLAY_NAMES,
  PLANNED_WEEK_ORDER,
  PlannedWeekDayKey,
} from "../../types/weekPlan";
import { setOnboardingCompleted } from "../../stores/onboardingStorage";
import { deriveFamilyInitials } from "../../utils/familyInitials";

type OnboardingStep =
  | "welcome"
  | "benefits"
  | "shoppingDay"
  | "family"
  | "paywall";

const STEPS: OnboardingStep[] = [
  "welcome",
  "benefits",
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
  const [shoppingDay, setShoppingDay] =
    useState<PlannedWeekDayKey>(startDay);
  const [familyMembers, setFamilyMembers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [familyMemberInput, setFamilyMemberInput] = useState("");
  const [isFinishing, setFinishing] = useState(false);
  const familyMemberInputRef = useRef<TextInput | null>(null);

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
    familyMembers,
    isFinishing,
    router,
    setStartDay,
    shoppingDay,
  ]);

  const familyInitialsMap = useMemo(
    () => deriveFamilyInitials(familyMembers),
    [familyMembers]
  );

  const handleAddFamilyMember = useCallback(() => {
    const trimmed = familyMemberInput.trim();
    if (!trimmed) {
      familyMemberInputRef.current?.focus();
      return;
    }
    const normalized = trimmed.toLowerCase();
    const alreadyExists = familyMembers.some(
      (member) => member.name.trim().toLowerCase() === normalized
    );
    if (alreadyExists) {
      setFamilyMemberInput("");
      familyMemberInputRef.current?.focus();
      return;
    }
    setFamilyMembers((prev) => [
      ...prev,
      {
        id: `onboarding-member-${Date.now().toString(36)}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,
        name: trimmed,
      },
    ]);
    setFamilyMemberInput("");
  }, [familyMemberInput, familyMembers]);

  const handleRemoveFamilyMember = useCallback((id: string) => {
    setFamilyMembers((prev) => prev.filter((member) => member.id !== id));
  }, []);

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
      case "benefits":
        return (
          <View style={styles.step}>
            <Text style={styles.title}>
              Make dinner one less thing to think about.
            </Text>
            <View style={styles.benefitList}>
              <BenefitCard
                icon="calendar-check-outline"
                title="Plan your week once"
                text="Know what’s for dinner before the week gets busy."
              />
              <BenefitCard
                icon="cart-outline"
                title="Shop with a ready-made list"
                text="Your planned meals automatically build your grocery list."
              />
              <BenefitCard
                icon="heart-outline"
                title="Remember what everyone loves"
                text="Family ratings help bring the favorites back."
              />
            </View>
            <Pressable style={styles.primaryButton} onPress={goNext}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>
          </View>
        );
      case "shoppingDay":
        return (
          <View style={styles.step}>
            <Text style={styles.title}>When do you usually grocery shop?</Text>
            <Text style={styles.subtitle}>
              We’ll use this to know when it’s time to plan your next week.
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
          <View style={styles.familyStep}>
            <View style={styles.familyHeader}>
              <Text style={styles.familyEmoji}>👩‍🍳</Text>
              <Text style={styles.familyTitle}>Who are you cooking for?</Text>
              <Text style={styles.familySubtitle}>
                Add your family so everyone can rate meals.
              </Text>
            </View>
            <View style={styles.familyManagement}>
              <Text style={styles.familySectionLabel}>Your family</Text>
              {familyMembers.length > 0 ? (
                <View style={styles.familyList}>
                  {familyMembers.map((member, index) => (
                    <View
                      key={member.id}
                      style={styles.familyRow}
                    >
                      <View
                        style={[
                          styles.familyAvatar,
                          {
                            backgroundColor:
                              memberColorPalette[
                                index % memberColorPalette.length
                              ],
                          },
                        ]}
                      >
                        <Text style={styles.familyAvatarText}>
                          {familyInitialsMap[member.id] ?? "?"}
                        </Text>
                      </View>
                      <Text style={styles.familyMemberName} numberOfLines={1}>
                        {member.name}
                      </Text>
                      <Pressable
                        onPress={() => handleRemoveFamilyMember(member.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${member.name}`}
                        hitSlop={10}
                        style={({ pressed }) => [
                          styles.familyRemoveButton,
                          pressed && styles.familyControlPressed,
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="close"
                          size={19}
                          color={theme.color.subtleInk}
                        />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.familyInputRow}>
                <TextInput
                  ref={familyMemberInputRef}
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
                  onPress={handleAddFamilyMember}
                  accessibilityRole="button"
                  accessibilityLabel="Add family member"
                  style={({ pressed }) => [
                    styles.familyAddButton,
                    pressed && styles.familyControlPressed,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="plus"
                    size={22}
                    color={theme.color.accent}
                  />
                </Pressable>
              </View>
            </View>
            <Pressable
              style={[
                styles.primaryButton,
                styles.familyContinueButton,
                familyMembers.length === 0 && styles.primaryButtonDisabled,
              ]}
              onPress={goNext}
              disabled={familyMembers.length === 0}
            >
              <Text
                style={[
                  styles.primaryButtonText,
                  familyMembers.length === 0 &&
                    styles.primaryButtonTextDisabled,
                ]}
              >
                Continue
              </Text>
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
              <Text style={styles.priceSubtext}>
                7 days free, then $34.99/year
              </Text>
            </View>
            <View style={styles.secondaryPriceCard}>
              <Text style={styles.priceTitle}>$4.99 / month</Text>
            </View>
            <Pressable
              style={styles.primaryButton}
              onPress={finishOnboarding}
              disabled={isFinishing}
            >
              <Text style={styles.primaryButtonText}>
                {isFinishing ? "Starting..." : "Start Free Trial"}
              </Text>
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
                "Plan your whole week in seconds",
                "Build your grocery list automatically",
                "Remember what your family actually likes",
                "Keep track of freezer meals",
                "Get smarter meal suggestions over time",
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
                unlocks the full weekly planning experience.
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

function BenefitCard({
  icon,
  title,
  text,
}: {
  icon: any;
  title: string;
  text: string;
}) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.benefitCard}>
      <View style={styles.benefitIcon}>
        <MaterialCommunityIcons
          name={icon}
          size={24}
          color={theme.color.accent}
        />
      </View>
      <View style={styles.benefitCopy}>
        <Text style={styles.benefitTitle}>{title}</Text>
        <Text style={styles.benefitText}>{text}</Text>
      </View>
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
    primaryButton: {
      minHeight: 52,
      borderRadius: theme.radius.xl,
      backgroundColor: theme.color.accent,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: theme.space.lg,
    },
    primaryButtonDisabled: {
      opacity: 0.48,
    },
    primaryButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    primaryButtonTextDisabled: {
      color: theme.color.subtleInk,
    },
    benefitList: {
      gap: theme.space.md,
    },
    benefitCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
      padding: theme.space.lg,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
    },
    benefitIcon: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.md,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
    },
    benefitCopy: {
      flex: 1,
      gap: theme.space.xs,
    },
    benefitTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    benefitText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      lineHeight: theme.type.size.sm * 1.35,
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
    familyStep: {
      flex: 1,
      gap: theme.space.xl,
    },
    familyHeader: {
      alignItems: "center",
      gap: theme.space.md,
      paddingHorizontal: theme.space.sm,
      marginBottom: theme.space.sm,
    },
    familyEmoji: {
      fontSize: 42,
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
    familyManagement: {
      gap: theme.space.sm,
    },
    familySectionLabel: {
      marginBottom: theme.space.xs,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.bold,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    familyList: {
      gap: theme.space.xs,
    },
    familyRow: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      borderRadius: theme.radius.md,
      paddingHorizontal: theme.space.sm,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    familyAvatar: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
    },
    familyAvatarText: {
      color: "#FFFFFF",
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    familyMemberName: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    familyRemoveButton: {
      width: 32,
      height: 32,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
    },
    familyInputRow: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    familyTextInput: {
      flex: 1,
      minHeight: 48,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      paddingHorizontal: theme.space.md,
    },
    familyAddButton: {
      width: 44,
      height: 44,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      marginRight: theme.space.xs,
    },
    familyControlPressed: {
      opacity: 0.65,
    },
    familyContinueButton: {
      marginTop: "auto",
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
