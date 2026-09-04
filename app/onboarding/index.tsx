import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
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
import { useMeals } from "../../hooks/useMeals";
import { useSubscription } from "../../hooks/useSubscription";
import { useThemeController } from "../../providers/theme/ThemeController";
import { useWeekStartController } from "../../providers/week-start/WeekStartController";
import { WeeklyTheme } from "../../styles/theme";
import {
  PLANNED_WEEK_DISPLAY_NAMES,
  PLANNED_WEEK_ORDER,
  PlannedWeekDayKey,
} from "../../types/weekPlan";
import {
  setFirstFullWeekPlanned,
  setFirstWeekExperienceActive,
  setOnboardingCompleted,
} from "../../stores/onboardingStorage";
import { deriveFamilyInitials } from "../../utils/familyInitials";
import { createMealId, Meal } from "../../types/meals";

type OnboardingStep =
  | "welcome"
  | "benefits"
  | "shoppingDay"
  | "family"
  | "quickMeals"
  | "paywall";

const STEPS: OnboardingStep[] = [
  "welcome",
  "benefits",
  "shoppingDay",
  "family",
  "quickMeals",
  "paywall",
];

const QUICK_MEALS = [
  { title: "Tacos", emoji: "🌮" },
  { title: "Spaghetti", emoji: "🍝" },
  { title: "Pizza", emoji: "🍕" },
  { title: "Burgers", emoji: "🍔" },
  { title: "Grilled Chicken", emoji: "🍗" },
  { title: "Stir Fry", emoji: "🥦" },
  { title: "Salmon", emoji: "🐟" },
  { title: "Mac & Cheese", emoji: "🧀" },
  { title: "Quesadillas", emoji: "🫓" },
  { title: "Meatloaf", emoji: "🍖" },
  { title: "Chili", emoji: "🍲" },
  { title: "Ramen", emoji: "🍜" },
] as const;

const normalizeMealTitle = (title: string) => title.trim().toLowerCase();

type QuickMealTransitionPhase = "idle" | "grouping" | "confirmed";

const createQuickMeal = (title: string, emoji: string): Meal => ({
  id: createMealId(),
  title: title.trim(),
  emoji,
  rating: 0,
  servedCount: 0,
  showServedCount: false,
  plannedCostTier: 2,
  locked: false,
  isFavorite: false,
  createdAt: new Date().toISOString(),
});

export default function OnboardingScreen() {
  const router = useRouter();
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { setStartDay } = useWeekStartController();
  const { addMember } = useFamilyMembers();
  const { meals, addMeal } = useMeals();
  const subscription = useSubscription();
  const [stepIndex, setStepIndex] = useState(0);
  const [shoppingDay, setShoppingDay] =
    useState<PlannedWeekDayKey | null>(null);
  const [familyMembers, setFamilyMembers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [familyMemberInput, setFamilyMemberInput] = useState("");
  const [isFinishing, setFinishing] = useState(false);
  const [selectedMealTitles, setSelectedMealTitles] = useState<Set<string>>(
    new Set()
  );
  const [isSavingQuickMeals, setSavingQuickMeals] = useState(false);
  const [quickMealTransitionPhase, setQuickMealTransitionPhase] =
    useState<QuickMealTransitionPhase>("idle");
  const [savedQuickMealCount, setSavedQuickMealCount] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const familyMemberInputRef = useRef<TextInput | null>(null);
  const quickMealButtonScale = useRef(new Animated.Value(1)).current;
  const quickMealUnselectedOpacity = useRef(new Animated.Value(1)).current;
  const quickMealSelectedOpacity = useRef(new Animated.Value(1)).current;
  const quickMealGroupProgress = useRef(new Animated.Value(0)).current;
  const quickMealConfirmationOpacity = useRef(new Animated.Value(0)).current;

  const step = STEPS[stepIndex];
  const progress = `${stepIndex + 1} / ${STEPS.length}`;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const goNext = useCallback(() => {
    setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, []);

  const goBack = useCallback(() => {
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const finishOnboarding = useCallback(async () => {
    if (isFinishing || !shoppingDay) {
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

    await Promise.all([
      setOnboardingCompleted(true),
      setFirstWeekExperienceActive(true),
      setFirstFullWeekPlanned(false),
    ]);
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

  const availableQuickMeals = QUICK_MEALS;

  const toggleQuickMeal = useCallback((title: string) => {
    const key = normalizeMealTitle(title);
    setSelectedMealTitles((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleContinueQuickMeals = useCallback(() => {
    if (quickMealTransitionPhase === "confirmed") {
      goNext();
      setQuickMealTransitionPhase("idle");
      quickMealButtonScale.setValue(1);
      quickMealUnselectedOpacity.setValue(1);
      quickMealSelectedOpacity.setValue(1);
      quickMealGroupProgress.setValue(0);
      quickMealConfirmationOpacity.setValue(0);
      setSavedQuickMealCount(0);
      return;
    }
    if (
      selectedMealTitles.size < 3 ||
      isSavingQuickMeals ||
      quickMealTransitionPhase !== "idle"
    ) return;
    setSavingQuickMeals(true);
    const existingTitles = new Set(
      meals.map((meal) => normalizeMealTitle(meal.title))
    );
    availableQuickMeals.forEach((option) => {
      const key = normalizeMealTitle(option.title);
      if (!selectedMealTitles.has(key) || existingTitles.has(key)) return;
      addMeal(createQuickMeal(option.title, option.emoji));
      existingTitles.add(key);
    });
    setSavedQuickMealCount(selectedMealTitles.size);

    const finishSaving = () => {
      setQuickMealTransitionPhase("confirmed");
      quickMealConfirmationOpacity.setValue(0);
      Animated.timing(quickMealConfirmationOpacity, {
        toValue: 1,
        duration: reduceMotion ? 140 : 220,
        useNativeDriver: true,
      }).start(() => setSavingQuickMeals(false));
    };

    Animated.sequence([
      Animated.timing(quickMealButtonScale, {
        toValue: 0.94,
        duration: reduceMotion ? 0 : 90,
        useNativeDriver: true,
      }),
      Animated.timing(quickMealButtonScale, {
        toValue: 1,
        duration: reduceMotion ? 0 : 80,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setQuickMealTransitionPhase("grouping");
      if (reduceMotion) {
        Animated.parallel([
          Animated.timing(quickMealUnselectedOpacity, {
            toValue: 0.12,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.timing(quickMealSelectedOpacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }),
        ]).start(finishSaving);
        return;
      }
      Animated.parallel([
        Animated.timing(quickMealUnselectedOpacity, {
          toValue: 0.08,
          duration: 260,
          useNativeDriver: true,
        }),
        Animated.timing(quickMealGroupProgress, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.sequence([
          Animated.delay(390),
          Animated.timing(quickMealSelectedOpacity, {
            toValue: 0,
            duration: 260,
            useNativeDriver: true,
          }),
        ]),
      ]).start(finishSaving);
    });
  }, [
    addMeal,
    availableQuickMeals,
    goNext,
    isSavingQuickMeals,
    meals,
    quickMealButtonScale,
    quickMealConfirmationOpacity,
    quickMealGroupProgress,
    quickMealSelectedOpacity,
    quickMealUnselectedOpacity,
    quickMealTransitionPhase,
    reduceMotion,
    selectedMealTitles,
  ]);

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
            <View style={styles.shoppingDayHero}>
              <View style={styles.shoppingDayIconWrap}>
                <MaterialCommunityIcons
                  name="calendar-check-outline"
                  size={50}
                  color={theme.color.accent}
                />
                <MaterialCommunityIcons
                  name="creation"
                  size={15}
                  color={theme.color.warning}
                  style={styles.shoppingDaySparkle}
                />
              </View>
              <Text style={styles.shoppingDayTitle}>
                Make dinner one less thing to think about.
              </Text>
            </View>
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
          <View style={styles.shoppingDayStep}>
            <View style={styles.shoppingDayMain}>
              <View style={styles.shoppingDayHero}>
                <View style={styles.shoppingDayIconWrap}>
                  <MaterialCommunityIcons
                    name="cart-heart"
                    size={50}
                    color={theme.color.accent}
                  />
                  <MaterialCommunityIcons
                    name="creation"
                    size={15}
                    color={theme.color.warning}
                    style={styles.shoppingDaySparkle}
                  />
                </View>
                <Text style={styles.shoppingDayTitle}>
                  Shop once.{"\n"}Enjoy all week.
                </Text>
                <Text style={styles.shoppingDaySubtitle}>
                  Choosing one shopping day helps you plan better, save money,
                  and keep your week running smoothly.
                </Text>
              </View>

              <View style={styles.shoppingDaySelection}>
                <Text style={styles.shoppingDayPrompt}>
                  What’s your grocery day?
                </Text>
                <View style={[styles.dayGrid, styles.shoppingDayGrid]}>
                  {PLANNED_WEEK_ORDER.map((day) => {
                    const selected = shoppingDay === day;
                    return (
                      <Pressable
                        key={day}
                        onPress={() => setShoppingDay(day)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={PLANNED_WEEK_DISPLAY_NAMES[day]}
                        style={[
                          styles.dayChip,
                          styles.shoppingDayChip,
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
              </View>
            </View>

            <Pressable
              disabled={!shoppingDay}
              accessibilityRole="button"
              accessibilityState={{ disabled: !shoppingDay }}
              style={[
                styles.primaryButton,
                styles.shoppingDayContinue,
                !shoppingDay && styles.primaryButtonDisabled,
              ]}
              onPress={goNext}
            >
              <Text style={styles.primaryButtonText}>Continue</Text>
            </Pressable>
          </View>
        );
      case "family":
        return (
          <View style={styles.familyStep}>
            <View style={styles.shoppingDayHero}>
              <View style={styles.shoppingDayIconWrap}>
                <Text style={styles.familyEmoji}>👩‍🍳</Text>
                <MaterialCommunityIcons
                  name="creation"
                  size={15}
                  color={theme.color.warning}
                  style={styles.shoppingDaySparkle}
                />
              </View>
              <Text style={styles.shoppingDayTitle}>Who are you cooking for?</Text>
              <Text style={styles.shoppingDaySubtitle}>
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
                      {index === 0 ? (
                        <Text style={styles.familyYouLabel}>you</Text>
                      ) : null}
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
      case "quickMeals":
        return (
          <View style={styles.quickMealsStep}>
              <Animated.View style={styles.quickMealSelectionContent}>
                <View
                  style={[
                    styles.quickMealsHeader,
                    (isSavingQuickMeals ||
                      quickMealTransitionPhase !== "idle") &&
                      styles.quickMealsHeaderHidden,
                  ]}
                  accessibilityElementsHidden={
                    isSavingQuickMeals || quickMealTransitionPhase !== "idle"
                  }
                  importantForAccessibility={
                    isSavingQuickMeals || quickMealTransitionPhase !== "idle"
                      ? "no-hide-descendants"
                      : "auto"
                  }
                >
                  <Text style={styles.title}>Start your meal library</Text>
                  <Text style={styles.subtitle}>
                    Choose meals your family already eats
                  </Text>
                </View>

                {quickMealTransitionPhase === "confirmed" ? (
                  <Animated.View
                    style={[
                      styles.quickMealLibrarySuccess,
                      {
                        opacity: quickMealConfirmationOpacity,
                        transform: [
                          {
                            scale: quickMealConfirmationOpacity.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.94, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <View style={styles.quickMealLibraryIconWrap}>
                      <MaterialCommunityIcons
                        name="folder-heart-outline"
                        size={52}
                        color={theme.color.accent}
                      />
                    </View>
                    <Text style={styles.quickMealLibrarySuccessTitle}>
                      Your library is started!
                    </Text>
                    <Text style={styles.quickMealLibrarySuccessCopy}>
                      You now have {savedQuickMealCount} meals in your library.
                      Add more anytime, then use them to plan your weeks.
                    </Text>
                  </Animated.View>
                ) : (
                  <View style={styles.quickMealGrid}>
                    {availableQuickMeals.map((meal, index) => {
                    const selected = selectedMealTitles.has(normalizeMealTitle(meal.title));
                    const row = Math.floor(index / 2);
                    const translateX = quickMealGroupProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, index % 2 === 0 ? 74 : -74],
                    });
                    const translateY = quickMealGroupProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, (5.7 - row) * 52],
                    });
                    const selectedScale = quickMealGroupProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 0.28],
                    });
                    return (
                      <Animated.View
                        key={normalizeMealTitle(meal.title)}
                        style={[
                          styles.quickMealChipAnimatedWrap,
                          selected && styles.quickMealChipAnimatedWrapSelected,
                          {
                            opacity: selected
                              ? quickMealSelectedOpacity
                              : quickMealUnselectedOpacity,
                            transform: selected
                              ? [
                                  { translateX },
                                  { translateY },
                                  { scale: selectedScale },
                                ]
                              : [],
                          },
                        ]}
                      >
                        <Pressable
                          onPress={() => toggleQuickMeal(meal.title)}
                          disabled={quickMealTransitionPhase !== "idle"}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: selected }}
                          style={({ pressed }) => [
                            styles.quickMealChip,
                            styles.quickMealChipInsideWrap,
                            selected && styles.quickMealChipSelected,
                            pressed && styles.quickMealChipPressed,
                          ]}
                        >
                          <Text style={styles.quickMealEmoji}>{meal.emoji}</Text>
                          <Text style={styles.quickMealText} numberOfLines={2}>{meal.title}</Text>
                          {selected ? (
                            <MaterialCommunityIcons name="check-circle" size={18} color={theme.color.ink} />
                          ) : null}
                        </Pressable>
                      </Animated.View>
                    );
                    })}
                  </View>
                )}

                {quickMealTransitionPhase === "confirmed" ? (
                  <Animated.View
                    style={[
                      styles.quickMealSavedSummary,
                      { opacity: quickMealConfirmationOpacity },
                    ]}
                    accessibilityLiveRegion="polite"
                  >
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={22}
                      color={theme.color.success}
                    />
                    <Text style={styles.quickMealSavedSummaryText}>
                      {savedQuickMealCount} meals added to your library!
                    </Text>
                  </Animated.View>
                ) : quickMealTransitionPhase === "grouping" ? (
                  <Animated.View
                    style={[
                      styles.quickMealSavingSummary,
                      {
                        transform: [
                          {
                            scale: quickMealGroupProgress.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.96, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                    accessibilityLiveRegion="polite"
                  >
                    <MaterialCommunityIcons
                      name="bookshelf"
                      size={23}
                      color={theme.color.accent}
                    />
                    <Text style={styles.quickMealSavingSummaryText}>
                      Adding to My Meals…
                    </Text>
                  </Animated.View>
                ) : (
                  <View style={styles.quickMealSummary}>
                    <Text style={styles.quickMealSummaryCount}>{selectedMealTitles.size} selected</Text>
                    <View style={styles.quickMealSummaryEmojis}>
                      {availableQuickMeals
                        .filter((meal) => selectedMealTitles.has(normalizeMealTitle(meal.title)))
                        .slice(0, 6)
                        .map((meal) => <Text key={normalizeMealTitle(meal.title)} style={styles.quickMealSummaryEmoji}>{meal.emoji}</Text>)}
                    </View>
                    {selectedMealTitles.size > 0 ? (
                      <Pressable
                        onPress={() => setSelectedMealTitles(new Set())}
                        disabled={quickMealTransitionPhase !== "idle"}
                        accessibilityRole="button"
                        accessibilityLabel="Clear selected meals"
                      >
                        <MaterialCommunityIcons name="close" size={21} color={theme.color.subtleInk} />
                      </Pressable>
                    ) : null}
                  </View>
                )}

                <View style={styles.quickMealInfoSpacer} />

                {selectedMealTitles.size < 3 ? (
                  <Text style={styles.quickMealMinimum}>Pick at least 3 meals to continue.</Text>
                ) : null}
                <Animated.View style={{ transform: [{ scale: quickMealButtonScale }] }}>
                  <Pressable
                    style={[
                      styles.primaryButton,
                      quickMealTransitionPhase === "idle" &&
                        selectedMealTitles.size < 3 &&
                        styles.primaryButtonDisabled,
                    ]}
                    onPress={handleContinueQuickMeals}
                    disabled={
                      isSavingQuickMeals ||
                      (quickMealTransitionPhase === "idle" &&
                        selectedMealTitles.size < 3)
                    }
                  >
                    <Text
                      style={[
                        styles.primaryButtonText,
                        quickMealTransitionPhase === "idle" &&
                          selectedMealTitles.size < 3 &&
                          styles.primaryButtonTextDisabled,
                      ]}
                    >
                      {quickMealTransitionPhase === "confirmed"
                        ? "Continue"
                        : quickMealTransitionPhase === "grouping"
                          ? "Adding…"
                          : selectedMealTitles.size >= 3
                            ? `Add ${selectedMealTitles.size} Meals to Library`
                            : "Add Meals to Library"}
                    </Text>
                  </Pressable>
                </Animated.View>
              </Animated.View>
          </View>
        );
      case "paywall":
        return (
          <View style={styles.firstWeekStep}>
            <View style={styles.firstWeekHeading}>
              <MaterialCommunityIcons name="calendar-heart" size={56} color={theme.color.accent} />
              <View style={styles.firstWeekTitleWrap}>
                <Text style={styles.firstWeekTitle}>Your first week</Text>
                <View style={styles.firstWeekAccentTitleRow}>
                  <Text style={styles.firstWeekAccentTitle}>is on us!</Text>
                  <MaterialCommunityIcons name="heart-plus-outline" size={35} color={theme.color.accent} />
                </View>
              </View>
            </View>
            <Text style={styles.firstWeekSubtitle}>
              Plan and use your first complete weekly plan with no subscription and no charge.
            </Text>
            <View style={styles.firstWeekFreeCard}>
              <View style={styles.firstWeekCardTop}>
                <View style={styles.firstWeekGiftCircle}>
                  <MaterialCommunityIcons name="gift-outline" size={45} color={theme.color.accent} />
                </View>
                <View style={styles.firstWeekFreeCopy}>
                  <Text style={styles.priceTitle}>One full week. Free.</Text>
                  {["Plan 7 dinners", "Get your grocery list", "Track, rate, and make it better"].map((feature) => (
                    <View style={styles.featureRow} key={feature}>
                      <MaterialCommunityIcons name="check-circle" size={17} color={theme.color.accent} />
                      <Text style={styles.featureText}>{feature}</Text>
                    </View>
                  ))}
                </View>
                <MaterialCommunityIcons name="star-four-points" size={31} color="#FFD3E4" style={styles.firstWeekSparkle} />
              </View>
              <Text style={styles.noSubscriptionCopy}>
                Planning your first week <Text style={styles.noSubscriptionEmphasis}>will not{"\n"}start a subscription.</Text>
              </Text>
              <View style={styles.firstWeekWaveBack} />
              <View style={styles.firstWeekWaveFront} />
            </View>

            <View style={styles.weekFeatureSection}>
              <View style={styles.weekFeatureHeading}>
                <MaterialCommunityIcons name="heart" size={20} color={theme.color.accent} />
                <Text style={styles.weekFeatureHeadingText}>Here’s what you can do this week</Text>
              </View>
              <View style={styles.weekFeatureList}>
                {[
                  ["calendar-heart", "Plan your", "week"],
                  ["cart-outline", "Create your", "grocery list"],
                  ["star", "Rate meals", "as you go"],
                  ["archive-outline", "Track freezer", "meals"],
                  ["trending-up", "Get smarter", "suggestions"],
                ].map(([icon, lineOne, lineTwo]) => (
                  <View style={styles.weekFeatureItem} key={lineOne}>
                    <View style={styles.weekFeatureIcon}>
                      <MaterialCommunityIcons name={icon as any} size={25} color={theme.color.accent} />
                    </View>
                    <Text style={styles.weekFeatureText}>{lineOne}{"\n"}{lineTwo}</Text>
                  </View>
                ))}
              </View>
            </View>
            <Pressable
              style={styles.firstWeekPrimaryButton}
              onPress={finishOnboarding}
              disabled={isFinishing}
            >
              <LinearGradient colors={["#FF3984", "#FF4B91"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.firstWeekPrimaryGradient}>
                <MaterialCommunityIcons name="calendar-heart" size={24} color="#FFFFFF" />
                <Text style={styles.firstWeekPrimaryText}>{isFinishing ? "Getting things ready…" : "Plan My First Week Free"}</Text>
              </LinearGradient>
            </Pressable>
            <Pressable style={styles.learnMoreButton} accessibilityRole="button">
              <Text style={styles.learnMoreText}>Learn More About Weekly Eats</Text>
            </Pressable>
            <View style={styles.afterFirstWeekRow}>
              <MaterialCommunityIcons name="shield-check-outline" size={29} color={theme.color.accent} />
              <Text style={styles.afterFirstWeekCopy}>After your first free week, you can choose Weekly Eats Pro to keep planning future weeks for $34.99/year.</Text>
            </View>
            <View style={styles.restoreDivider} />
            <Pressable onPress={() => void subscription.restorePurchases()} accessibilityRole="button" accessibilityLabel="Restore purchases" style={styles.restoreButton}>
              <MaterialCommunityIcons name="restore" size={21} color={theme.color.accent} />
              <Text style={styles.restoreText}>Already subscribed? <Text style={styles.restoreTextStrong}>Restore Purchases</Text></Text>
            </Pressable>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        enabled={step !== "family"}
        style={styles.keyboardView}
      >
        <View style={styles.topBar}>
          {stepIndex > 0 ? (
            <Pressable
              onPress={goBack}
              disabled={
                isSavingQuickMeals || quickMealTransitionPhase !== "idle"
              }
              style={styles.backButton}
            >
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
    shoppingDayStep: {
      flex: 1,
      minHeight: 570,
      justifyContent: "space-between",
      gap: theme.space.xl,
    },
    shoppingDayHero: {
      alignItems: "center",
      gap: theme.space.lg,
      paddingTop: theme.space.sm,
      paddingHorizontal: theme.space.sm,
    },
    shoppingDayMain: {
      gap: theme.space["2xl"] + theme.space.sm,
    },
    shoppingDayIconWrap: {
      width: 88,
      height: 88,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
      position: "relative",
    },
    shoppingDaySparkle: {
      position: "absolute",
      right: 13,
      top: 13,
    },
    shoppingDayTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h1,
      lineHeight: theme.type.size.h1 * 1.18,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    shoppingDaySubtitle: {
      maxWidth: 340,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      lineHeight: theme.type.size.base * 1.45,
      textAlign: "center",
    },
    shoppingDaySelection: {
      alignItems: "center",
      gap: theme.space.md,
    },
    shoppingDayPrompt: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
      textAlign: "center",
    },
    shoppingDayGrid: {
      justifyContent: "center",
      maxWidth: 360,
    },
    shoppingDayChip: {
      minWidth: 70,
    },
    shoppingDayContinue: {
      width: "100%",
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
    familyYouLabel: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
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
    quickMealsStep: {
      flex: 1,
      minHeight: 560,
    },
    quickMealSelectionContent: {
      gap: theme.space.lg,
    },
    quickMealsHeader: {
      gap: theme.space.sm,
    },
    quickMealsHeaderHidden: {
      opacity: 0,
    },
    quickMealGrid: {
      position: "relative",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.space.sm,
    },
    quickMealLibrarySuccess: {
      minHeight: 328,
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.md,
      paddingHorizontal: theme.space.lg,
    },
    quickMealLibraryIconWrap: {
      width: 78,
      height: 78,
      borderRadius: theme.radius.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        theme.mode === "dark" ? "rgba(255, 75, 145, 0.16)" : "#FFF0F7",
    },
    quickMealLibrarySuccessTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    quickMealLibrarySuccessCopy: {
      maxWidth: 330,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      lineHeight: theme.type.size.base * 1.4,
      textAlign: "center",
    },
    quickMealChipAnimatedWrap: {
      minHeight: 48,
      maxWidth: "100%",
      flexGrow: 1,
      flexBasis: "44%",
    },
    quickMealChipAnimatedWrapSelected: {
      zIndex: 2,
      elevation: 2,
    },
    quickMealChip: {
      minHeight: 48,
      maxWidth: "100%",
      flexGrow: 1,
      flexBasis: "44%",
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    quickMealChipInsideWrap: {
      width: "100%",
      minHeight: 48,
      flexBasis: "auto",
      flexGrow: 0,
    },
    quickMealChipSelected: {
      backgroundColor:
        theme.mode === "dark" ? "rgba(255, 75, 145, 0.34)" : "#FFE0EC",
      borderColor: theme.color.accent,
    },
    quickMealChipPressed: {
      opacity: 0.78,
      transform: [{ scale: 0.985 }],
    },
    quickMealEmoji: {
      fontSize: 20,
    },
    quickMealText: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    quickMealSummary: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
      paddingHorizontal: theme.space.md,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surfaceAlt,
    },
    quickMealSummaryCount: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    quickMealSummaryEmojis: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
    },
    quickMealSummaryEmoji: {
      fontSize: 19,
    },
    quickMealSavedSummary: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.sm,
      paddingHorizontal: theme.space.md,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.success,
    },
    quickMealSavedSummaryText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    quickMealInfoSpacer: {
      height: 58,
    },
    quickMealSavingSummary: {
      minHeight: 54,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.sm,
      paddingHorizontal: theme.space.md,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.accent,
    },
    quickMealSavingSummaryText: {
      color: theme.color.accent,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    quickMealMinimum: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
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
    firstWeekStep: { gap: 20, paddingBottom: theme.space.lg },
    firstWeekHeading: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.lg,
      paddingHorizontal: 4,
    },
    firstWeekTitleWrap: { flex: 1 },
    firstWeekTitle: { color: theme.color.ink, fontSize: 31, lineHeight: 36, fontWeight: theme.type.weight.bold },
    firstWeekAccentTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    firstWeekAccentTitle: { color: theme.color.accent, fontSize: 31, lineHeight: 36, fontWeight: theme.type.weight.bold },
    firstWeekSubtitle: { color: theme.color.subtleInk, fontSize: 17, lineHeight: 25 },
    firstWeekFreeCard: {
      position: "relative",
      overflow: "hidden",
      paddingTop: 24,
      paddingHorizontal: 20,
      paddingBottom: 48,
      borderRadius: theme.radius.lg,
      backgroundColor:
        theme.mode === "dark" ? "rgba(255, 75, 145, 0.14)" : "#FFF0F6",
      borderWidth: 1,
      borderColor: theme.color.accent,
    },
    firstWeekCardTop: { flexDirection: "row", alignItems: "flex-start", gap: theme.space.lg },
    firstWeekGiftCircle: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: theme.mode === "dark" ? "rgba(255,75,145,.15)" : "#FFE4EE" },
    firstWeekFreeCopy: { flex: 1, gap: theme.space.sm },
    firstWeekSparkle: { position: "absolute", right: 0, top: 0 },
    noSubscriptionCopy: {
      marginTop: theme.space.lg,
      paddingTop: theme.space.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.cardOutline,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      lineHeight: 23,
      textAlign: "center",
      zIndex: 2,
    },
    noSubscriptionEmphasis: { color: theme.color.accent, fontWeight: theme.type.weight.bold },
    firstWeekWaveBack: { position: "absolute", left: -35, bottom: -38, width: "72%", height: 63, borderRadius: 80, backgroundColor: "#FF4B91", transform: [{ rotate: "8deg" }] },
    firstWeekWaveFront: { position: "absolute", right: -45, bottom: -43, width: "72%", height: 70, borderRadius: 80, backgroundColor: "#F92D7E", transform: [{ rotate: "-7deg" }] },
    weekFeatureSection: { gap: theme.space.md },
    weekFeatureHeading: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
    weekFeatureHeadingText: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
    weekFeatureList: { flexDirection: "row", justifyContent: "space-between", gap: 5 },
    weekFeatureItem: { flex: 1, alignItems: "center", gap: 6 },
    weekFeatureIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: theme.mode === "dark" ? "rgba(255,75,145,.15)" : "#FFEAF2" },
    weekFeatureText: { color: theme.color.ink, fontSize: 11, lineHeight: 15, textAlign: "center" },
    firstWeekPrimaryButton: { borderRadius: theme.radius.full, overflow: "hidden" },
    firstWeekPrimaryGradient: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm, paddingHorizontal: theme.space.lg },
    firstWeekPrimaryText: { color: "#FFFFFF", fontSize: 19, fontWeight: theme.type.weight.bold },
    learnMoreButton: { minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full, backgroundColor: theme.color.surfaceAlt },
    learnMoreText: { color: theme.color.subtleInk, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
    afterFirstWeekRow: { flexDirection: "row", alignItems: "center", gap: theme.space.md, paddingHorizontal: theme.space.lg },
    afterFirstWeekCopy: {
      flex: 1,
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      lineHeight: 20,
    },
    restoreDivider: { height: StyleSheet.hairlineWidth, backgroundColor: theme.color.border },
    restoreButton: {
      minHeight: 44,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.sm,
    },
    restoreText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    restoreTextStrong: { color: theme.color.accent, fontWeight: theme.type.weight.bold },
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
      fontSize: 19,
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
      fontSize: theme.type.size.sm,
      lineHeight: 19,
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
