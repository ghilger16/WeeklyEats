import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  Animated,
  Easing,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
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
import MealEmoji from "../../components/emoji/MealEmoji";
import {
  BEEF_STIR_FRY_EMOJI_TOKEN,
  CHILI_EMOJI_TOKEN,
  MAC_AND_CHEESE_EMOJI_TOKEN,
  MEATLOAF_EMOJI_TOKEN,
} from "../../components/emoji/customEmojiRegistry";
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
import {
  createMealId,
  Meal,
  MealIngredient,
  ShoppingCategory,
} from "../../types/meals";
import { trackAction } from "../../services/analytics";

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

type QuickMealOption = Pick<
  Meal,
  "title" | "emoji" | "difficulty" | "expense" | "cuisine"
> & { ingredients: readonly MealIngredient[] };

const keyIngredient = (
  name: string,
  category: ShoppingCategory,
) => ({ name, category, ingredientType: "keyIngredient" as const });

const pantryStaple = (
  name: string,
  category: ShoppingCategory,
) => ({ name, category, ingredientType: "pantryStaple" as const });

const QUICK_MEALS = [
  { title: "Tacos", emoji: "🌮", cuisine: "mexican", difficulty: 1, expense: 2, ingredients: [keyIngredient("Ground Beef", "meat"), keyIngredient("Taco Shells", "pantry"), keyIngredient("Cheese", "dairy"), keyIngredient("Lettuce", "produce"), keyIngredient("Tomato", "produce"), pantryStaple("Taco Seasoning", "spices"), pantryStaple("Salsa", "condiments")] },
  { title: "Spaghetti", emoji: "🍝", cuisine: "italian", difficulty: 1, expense: 1, ingredients: [keyIngredient("Spaghetti", "pastaAndRice"), keyIngredient("Ground Beef", "meat"), keyIngredient("Marinara Sauce", "pantry"), keyIngredient("Parmesan Cheese", "dairy"), pantryStaple("Garlic", "produce"), pantryStaple("Italian Seasoning", "spices")] },
  { title: "Frozen Pizza", emoji: "🍕", cuisine: "italian", difficulty: 2, expense: 2, ingredients: [keyIngredient("Frozen Pizza", "frozen")] },
  { title: "Burgers", emoji: "🍔", cuisine: "american", difficulty: 1, expense: 2, ingredients: [keyIngredient("Ground Beef", "meat"), keyIngredient("Hamburger Buns", "bakery"), keyIngredient("Cheese", "dairy"), keyIngredient("Lettuce", "produce"), keyIngredient("Tomato", "produce"), keyIngredient("Onion", "produce"), pantryStaple("Ketchup", "condiments"), pantryStaple("Mustard", "condiments")] },
  { title: "Grilled Cheese", emoji: "🥪", cuisine: "american", difficulty: 1, expense: 1, ingredients: [keyIngredient("Bread", "bakery"), keyIngredient("Cheese", "dairy"), pantryStaple("Butter", "dairy")] },
  { title: "Stir Fry", emoji: BEEF_STIR_FRY_EMOJI_TOKEN, cuisine: "chinese", difficulty: 2, expense: 2, ingredients: [keyIngredient("Beef Strips", "meat"), keyIngredient("Broccoli", "produce"), keyIngredient("Bell Pepper", "produce"), keyIngredient("Rice", "pastaAndRice"), keyIngredient("Stir-fry Sauce", "condiments"), pantryStaple("Soy Sauce", "condiments"), pantryStaple("Cooking Oil", "pantry")] },
  { title: "Chicken Nuggets", emoji: "🍗", cuisine: "american", difficulty: 1, expense: 1, ingredients: [keyIngredient("Frozen Chicken Nuggets", "frozen")] },
  { title: "Mac & Cheese", emoji: MAC_AND_CHEESE_EMOJI_TOKEN, cuisine: "american", difficulty: 2, expense: 2, ingredients: [keyIngredient("Elbow Macaroni", "pastaAndRice"), keyIngredient("Cheese", "dairy"), keyIngredient("Milk", "dairy"), keyIngredient("Butter", "dairy"), pantryStaple("Flour", "baking"), pantryStaple("Salt", "spices")] },
  { title: "Quesadillas", emoji: "🫓", cuisine: "mexican", difficulty: 1, expense: 1, ingredients: [keyIngredient("Flour Tortillas", "bakery"), keyIngredient("Cheese", "dairy"), keyIngredient("Chicken Breast", "meat"), keyIngredient("Bell Pepper", "produce"), keyIngredient("Salsa", "condiments"), pantryStaple("Cooking Oil", "pantry")] },
  { title: "Meatloaf", emoji: MEATLOAF_EMOJI_TOKEN, cuisine: "american", difficulty: 3, expense: 2, ingredients: [keyIngredient("Ground Beef", "meat"), keyIngredient("Egg", "dairy"), keyIngredient("Breadcrumbs", "pantry"), keyIngredient("Onion", "produce"), keyIngredient("Milk", "dairy"), pantryStaple("Ketchup", "condiments"), pantryStaple("Worcestershire Sauce", "condiments")] },
  { title: "Chili", emoji: CHILI_EMOJI_TOKEN, cuisine: "texMex", difficulty: 2, expense: 2, ingredients: [keyIngredient("Ground Beef", "meat"), keyIngredient("Kidney Beans", "canned"), keyIngredient("Diced Tomatoes", "canned"), keyIngredient("Tomato Sauce", "canned"), keyIngredient("Onion", "produce"), pantryStaple("Chili Powder", "spices"), pantryStaple("Cumin", "spices")] },
  { title: "Chicken & Rice", emoji: "🍛", cuisine: "american", difficulty: 2, expense: 2, ingredients: [keyIngredient("Chicken Breast", "meat"), keyIngredient("Rice", "pastaAndRice"), keyIngredient("Chicken Broth", "pantry")] },
] as const satisfies readonly QuickMealOption[];

const normalizeMealTitle = (title: string) => title.trim().toLowerCase();

type QuickMealTransitionPhase = "idle" | "grouping" | "confirmed";
type ShoppingDayFlowPhase = "selecting" | "transitioning" | "flow";

type TravelingChipLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
  translateX: number;
  translateY: number;
  targetWidth: number;
  targetHeight: number;
};

const createQuickMeal = (option: QuickMealOption): Meal => ({
  id: createMealId(),
  title: option.title.trim(),
  emoji: option.emoji,
  ingredients: [...(option.ingredients ?? [])],
  difficulty: option.difficulty,
  expense: option.expense,
  cuisine: option.cuisine,
  rating: 0,
  servedCount: 0,
  showServedCount: false,
  plannedCostTier:
    !option.expense || option.expense <= 2 ? 1 : option.expense >= 4 ? 3 : 2,
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
  const [shoppingDayFlowPhase, setShoppingDayFlowPhase] =
    useState<ShoppingDayFlowPhase>("selecting");
  const [travelingChipLayout, setTravelingChipLayout] =
    useState<TravelingChipLayout | null>(null);
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
  const [familyKeyboardInset, setFamilyKeyboardInset] = useState(0);
  const familyMemberInputRef = useRef<TextInput | null>(null);
  const familyListScrollRef = useRef<ScrollView | null>(null);
  const shoppingDayStepRef = useRef<View | null>(null);
  const selectedShoppingDayRef = useRef<View | null>(null);
  const shoppingDayDestinationRef = useRef<View | null>(null);
  const shoppingInitialOpacity = useRef(new Animated.Value(1)).current;
  const shoppingInitialTranslateY = useRef(new Animated.Value(0)).current;
  const shoppingFlowHeaderProgress = useRef(new Animated.Value(0)).current;
  const shoppingChipProgress = useRef(new Animated.Value(0)).current;
  const shoppingChipOpacity = useRef(new Animated.Value(1)).current;
  const shoppingShopCardProgress = useRef(new Animated.Value(0)).current;
  const shoppingPlanCardProgress = useRef(new Animated.Value(0)).current;
  const shoppingDinnerCardProgress = useRef(new Animated.Value(0)).current;
  const shoppingCardRotation = useRef(new Animated.Value(0)).current;
  const shoppingConnectorsProgress = useRef(new Animated.Value(0)).current;
  const quickMealButtonScale = useRef(new Animated.Value(1)).current;
  const quickMealUnselectedOpacity = useRef(new Animated.Value(1)).current;
  const quickMealSelectedOpacity = useRef(new Animated.Value(1)).current;
  const quickMealGroupProgress = useRef(new Animated.Value(0)).current;
  const quickMealConfirmationOpacity = useRef(new Animated.Value(0)).current;

  const step = STEPS[stepIndex];
  const progress = `${stepIndex + 1} / ${STEPS.length}`;

  useEffect(() => {
    trackAction("onboarding_started");
  }, []);

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

  useEffect(() => {
    shoppingCardRotation.setValue(0);
    if (step !== "shoppingDay" || shoppingDayFlowPhase !== "flow" || reduceMotion) return;

    // Advance clockwise only. Reset after a full lap, where 3 and 0
    // represent the same positions, so the cards never animate backwards.
    let nextPosition = 0;
    let completedRotations = 0;
    let animation: Animated.CompositeAnimation | undefined;
    const interval = setInterval(() => {
      if (nextPosition === 3) {
        shoppingCardRotation.setValue(0);
        nextPosition = 0;
      }
      nextPosition += 1;
      animation = Animated.timing(shoppingCardRotation, {
        toValue: nextPosition,
        duration: 550,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: false,
        isInteraction: false,
      });
      animation.start(({ finished }) => {
        if (finished && nextPosition === 3) {
          completedRotations += 1;
          if (completedRotations === 2) clearInterval(interval);
        }
      });
    }, 3000);

    return () => {
      clearInterval(interval);
      animation?.stop();
    };
  }, [reduceMotion, shoppingCardRotation, shoppingDayFlowPhase, step]);

  const goNext = useCallback(() => {
    setStepIndex((prev) => Math.min(prev + 1, STEPS.length - 1));
  }, []);

  const goBack = useCallback(() => {
    if (step === "shoppingDay" && shoppingDayFlowPhase === "flow") {
      shoppingInitialOpacity.setValue(1);
      shoppingInitialTranslateY.setValue(0);
      shoppingFlowHeaderProgress.setValue(0);
      shoppingChipProgress.setValue(0);
      shoppingChipOpacity.setValue(0);
      shoppingShopCardProgress.setValue(0);
      shoppingPlanCardProgress.setValue(0);
      shoppingDinnerCardProgress.setValue(0);
      shoppingConnectorsProgress.setValue(0);
      setTravelingChipLayout(null);
      setShoppingDayFlowPhase("selecting");
      return;
    }
    setStepIndex((prev) => Math.max(prev - 1, 0));
  }, [
    shoppingChipOpacity,
    shoppingChipProgress,
    shoppingConnectorsProgress,
    shoppingDayFlowPhase,
    shoppingDinnerCardProgress,
    shoppingFlowHeaderProgress,
    shoppingInitialOpacity,
    shoppingInitialTranslateY,
    shoppingPlanCardProgress,
    shoppingShopCardProgress,
    step,
  ]);

  const runShoppingDayFlowTransition = useCallback(
    (layout: TravelingChipLayout | null) => {
      setTravelingChipLayout(layout);
      setShoppingDayFlowPhase("transitioning");
      shoppingInitialOpacity.setValue(1);
      shoppingInitialTranslateY.setValue(0);
      shoppingFlowHeaderProgress.setValue(0);
      shoppingChipProgress.setValue(0);
      shoppingChipOpacity.setValue(layout && !reduceMotion ? 1 : 0);
      shoppingShopCardProgress.setValue(0);
      shoppingPlanCardProgress.setValue(0);
      shoppingDinnerCardProgress.setValue(0);
      shoppingConnectorsProgress.setValue(0);

      const duration = reduceMotion ? 180 : 520;
      const animation = reduceMotion
        ? Animated.parallel([
            Animated.timing(shoppingInitialOpacity, {
              toValue: 0,
              duration,
              useNativeDriver: true,
            }),
            Animated.timing(shoppingFlowHeaderProgress, {
              toValue: 1,
              duration,
              useNativeDriver: true,
            }),
            Animated.timing(shoppingShopCardProgress, {
              toValue: 1,
              duration,
              useNativeDriver: true,
            }),
            Animated.timing(shoppingPlanCardProgress, {
              toValue: 1,
              duration,
              useNativeDriver: true,
            }),
            Animated.timing(shoppingDinnerCardProgress, {
              toValue: 1,
              duration,
              useNativeDriver: true,
            }),
            Animated.timing(shoppingConnectorsProgress, {
              toValue: 1,
              duration,
              useNativeDriver: true,
            }),
          ])
        : Animated.parallel([
            Animated.parallel([
              Animated.timing(shoppingInitialOpacity, {
                toValue: 0,
                duration: 210,
                useNativeDriver: true,
              }),
              Animated.timing(shoppingInitialTranslateY, {
                toValue: -14,
                duration: 250,
                useNativeDriver: true,
              }),
              Animated.sequence([
                Animated.delay(90),
                Animated.timing(shoppingFlowHeaderProgress, {
                  toValue: 1,
                  duration: 260,
                  useNativeDriver: true,
                }),
              ]),
            ]),
            Animated.sequence([
              Animated.delay(90),
              Animated.timing(shoppingChipProgress, {
                toValue: 1,
                duration,
                easing: Easing.bezier(0.22, 0.76, 0.28, 1),
                useNativeDriver: false,
              }),
              Animated.parallel([
                Animated.timing(shoppingShopCardProgress, {
                  toValue: 1,
                  duration: 180,
                  useNativeDriver: true,
                }),
                Animated.timing(shoppingChipOpacity, {
                  toValue: 0,
                  duration: 100,
                  // This opacity is applied to the same view whose width and
                  // height morph with shoppingChipProgress. Keeping every
                  // animation on that view on the JS driver prevents the
                  // native driver from attempting unsupported layout styles.
                  useNativeDriver: false,
                }),
              ]),
              Animated.stagger(80, [
                Animated.timing(shoppingPlanCardProgress, {
                  toValue: 1,
                  duration: 210,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }),
                Animated.timing(shoppingDinnerCardProgress, {
                  toValue: 1,
                  duration: 210,
                  easing: Easing.out(Easing.cubic),
                  useNativeDriver: true,
                }),
              ]),
              Animated.timing(shoppingConnectorsProgress, {
                toValue: 1,
                duration: 140,
                useNativeDriver: true,
              }),
            ]),
          ]);

      animation.start(({ finished }) => {
        if (finished) setShoppingDayFlowPhase("flow");
      });
    },
    [
      reduceMotion,
      shoppingChipOpacity,
      shoppingChipProgress,
      shoppingConnectorsProgress,
      shoppingDinnerCardProgress,
      shoppingFlowHeaderProgress,
      shoppingInitialOpacity,
      shoppingInitialTranslateY,
      shoppingPlanCardProgress,
      shoppingShopCardProgress,
    ],
  );

  const handleShoppingDayContinue = useCallback(() => {
    if (!shoppingDay || shoppingDayFlowPhase === "transitioning") return;
    if (shoppingDayFlowPhase === "flow") {
      goNext();
      return;
    }
    if (reduceMotion) {
      runShoppingDayFlowTransition(null);
      return;
    }

    const root = shoppingDayStepRef.current;
    const source = selectedShoppingDayRef.current;
    const destination = shoppingDayDestinationRef.current;
    if (!root || !source || !destination) {
      runShoppingDayFlowTransition(null);
      return;
    }
    root.measureInWindow((rootX, rootY) => {
      source.measureInWindow((sourceX, sourceY, sourceWidth, sourceHeight) => {
        destination.measureInWindow(
          (targetX, targetY, targetWidth, targetHeight) => {
            runShoppingDayFlowTransition({
              left: sourceX - rootX,
              top: sourceY - rootY,
              width: sourceWidth,
              height: sourceHeight,
              translateX: targetX - sourceX,
              translateY: targetY - sourceY,
              targetWidth,
              targetHeight,
            });
          },
        );
      });
    });
  }, [
    goNext,
    reduceMotion,
    runShoppingDayFlowTransition,
    shoppingDay,
    shoppingDayFlowPhase,
  ]);

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
    trackAction("onboarding_completed", {
      grocery_day_set: true,
      grocery_day: shoppingDay,
      family_member_count: familyMembers.filter((member) => member.name.trim())
        .length,
      meal_library_size: meals.length,
    });
    router.replace("/week-dashboard");
  }, [
    addMember,
    familyMembers,
    isFinishing,
    meals.length,
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

  const scrollFamilyInputIntoView = useCallback(() => {
    requestAnimationFrame(() => {
      familyListScrollRef.current?.scrollToEnd({ animated: true });
    });
    setTimeout(() => {
      familyListScrollRef.current?.scrollToEnd({ animated: true });
    }, 300);
  }, []);

  useEffect(() => {
    if (step !== "family") {
      setFamilyKeyboardInset(0);
      return;
    }

    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      familyListScrollRef.current?.getNativeScrollRef()?.measureInWindow((_x, y, _width, height) => {
        const coveredHeight = Math.max(
          0,
          y + height - event.endCoordinates.screenY,
        );
        setFamilyKeyboardInset(coveredHeight);
        requestAnimationFrame(() => {
          setTimeout(() => {
            familyListScrollRef.current?.scrollToEnd({ animated: true });
          }, 50);
        });
      });
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setFamilyKeyboardInset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [step]);

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
      addMeal(createQuickMeal(option));
      existingTitles.add(key);
    });
    setSavedQuickMealCount(selectedMealTitles.size);

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

  useEffect(() => {
    if (quickMealTransitionPhase !== "grouping") return;

    const animation = reduceMotion
      ? Animated.parallel([
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
        ])
      : Animated.parallel([
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
        ]);

    animation.start(({ finished }) => {
      if (!finished) return;
      quickMealConfirmationOpacity.setValue(0);
      setQuickMealTransitionPhase("confirmed");
    });
    return () => animation.stop();
  }, [
    quickMealConfirmationOpacity,
    quickMealGroupProgress,
    quickMealSelectedOpacity,
    quickMealTransitionPhase,
    quickMealUnselectedOpacity,
    reduceMotion,
  ]);

  useEffect(() => {
    if (quickMealTransitionPhase !== "confirmed") return;

    const animation = Animated.timing(quickMealConfirmationOpacity, {
      toValue: 1,
      duration: reduceMotion ? 140 : 220,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished) setSavingQuickMeals(false);
    });
    return () => animation.stop();
  }, [quickMealConfirmationOpacity, quickMealTransitionPhase, reduceMotion]);

  const renderShoppingDayStep = () => {
    const selectedDayName = shoppingDay
      ? PLANNED_WEEK_DISPLAY_NAMES[shoppingDay]
      : "Shopping day";
    const rotatingSlotStyle = (initialSlot: number) => {
      // Clockwise: top, bottom-right, bottom-left.
      const slots = [
        { left: "14%", top: 0, width: "72%" },
        { left: "56%", top: 225, width: "44%" },
        { left: "0%", top: 225, width: "44%" },
      ];
      const positions = [0, 1, 2, 3].map((offset) => slots[(initialSlot + offset) % 3]);
      return {
        position: "absolute" as const,
        zIndex: 1,
        left: shoppingCardRotation.interpolate({ inputRange: [0, 1, 2, 3], outputRange: positions.map((slot) => slot.left) }),
        top: shoppingCardRotation.interpolate({ inputRange: [0, 1, 2, 3], outputRange: positions.map((slot) => slot.top) }),
        width: shoppingCardRotation.interpolate({ inputRange: [0, 1, 2, 3], outputRange: positions.map((slot) => slot.width) }),
      };
    };
    const animatedCardStyle = (progress: Animated.Value, fromX: number) => ({
      opacity: progress,
      transform: [
        {
          translateX: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [fromX, 0],
          }),
        },
        {
          translateY: progress.interpolate({
            inputRange: [0, 1],
            outputRange: [14, 0],
          }),
        },
      ],
    });

    return (
      <View ref={shoppingDayStepRef} collapsable={false} style={styles.shoppingDayStep}>
        <View style={styles.shoppingDayTransitionStage}>
          <Animated.View
            pointerEvents={shoppingDayFlowPhase === "selecting" ? "auto" : "none"}
            accessibilityElementsHidden={shoppingDayFlowPhase !== "selecting"}
            importantForAccessibility={shoppingDayFlowPhase === "selecting" ? "auto" : "no-hide-descendants"}
            style={[
              styles.shoppingDayMain,
              {
                opacity: shoppingInitialOpacity,
                transform: [{ translateY: shoppingInitialTranslateY }],
              },
            ]}
          >
            <View style={styles.shoppingDayHero}>
              <View style={styles.shoppingDayIconWrap}>
                <MaterialCommunityIcons name="cart-heart" size={50} color={theme.color.accent} />
                <MaterialCommunityIcons name="creation" size={15} color={theme.color.warning} style={styles.shoppingDaySparkle} />
              </View>
              <Text style={styles.shoppingDayTitle}>Shop once.{"\n"}Enjoy all week.</Text>
              <Text style={styles.shoppingDaySubtitle}>
                Choosing one shopping day helps you plan better, save money,
                and keep your week running smoothly.
              </Text>
            </View>

            <View style={styles.shoppingDaySelection}>
              <Text style={styles.shoppingDayPrompt}>What’s your grocery day?</Text>
              <View style={[styles.dayGrid, styles.shoppingDayGrid]}>
                {PLANNED_WEEK_ORDER.map((day) => {
                  const selected = shoppingDay === day;
                  return (
                    <View
                      key={day}
                      ref={selected ? selectedShoppingDayRef : undefined}
                      collapsable={false}
                    >
                      <Pressable
                        onPress={() => setShoppingDay(day)}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={PLANNED_WEEK_DISPLAY_NAMES[day]}
                        style={[styles.dayChip, styles.shoppingDayChip, selected && styles.dayChipSelected]}
                      >
                        <Text style={[styles.dayChipText, selected && styles.dayChipTextSelected]}>
                          {PLANNED_WEEK_DISPLAY_NAMES[day].slice(0, 3)}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          </Animated.View>

          <View
            pointerEvents="none"
            accessibilityElementsHidden={shoppingDayFlowPhase === "selecting"}
            importantForAccessibility={shoppingDayFlowPhase === "selecting" ? "no-hide-descendants" : "auto"}
            style={styles.shoppingFlowLayer}
          >
            <Animated.View
              style={[
                styles.shoppingFlowHeader,
                {
                  opacity: shoppingFlowHeaderProgress,
                  transform: [{
                    translateY: shoppingFlowHeaderProgress.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }),
                  }],
                },
              ]}
            >
              <Text style={styles.shoppingFlowTitle}>Your plan, simplified</Text>
              <Text style={styles.shoppingFlowSubtitle}>Plan, shop, and enjoy — on repeat.</Text>
            </Animated.View>

            <View style={styles.shoppingFlowLoop}>
              <Animated.View style={rotatingSlotStyle(2)}>
                <Animated.View style={[styles.shoppingFlowCard, styles.shoppingFlowSecondaryCard, styles.shoppingFlowPlanCard, styles.shoppingFlowRotatingCard, animatedCardStyle(shoppingPlanCardProgress, -18)]}>
                  <View style={styles.shoppingFlowSecondaryIcon}>
                    <MaterialCommunityIcons name="format-list-checks" size={27} color={theme.color.accent} />
                  </View>
                  <View style={styles.shoppingFlowSecondaryContent}>
                    <Text style={styles.shoppingFlowSecondaryTitle}>Plan once</Text>
                    <Text style={styles.shoppingFlowSecondaryCopy}>Choose your meals for the week.</Text>
                  </View>
                </Animated.View>
              </Animated.View>

              <Animated.View style={rotatingSlotStyle(0)}>
                <Animated.View
                  style={[
                    styles.shoppingFlowCard,
                    styles.shoppingFlowShopCard,
                    styles.shoppingFlowRotatingCard,
                    {
                      opacity: shoppingShopCardProgress,
                      transform: [{
                        scale: shoppingShopCardProgress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }),
                      }],
                    },
                  ]}
                >
                  <View style={styles.shoppingFlowPrimaryIcon}>
                    <MaterialCommunityIcons name="cart-outline" size={30} color={theme.color.accent} />
                  </View>
                  <Text style={styles.shoppingFlowCardTitle}>Shop once</Text>
                  <View
                    ref={shoppingDayDestinationRef}
                    collapsable={false}
                    style={styles.shoppingFlowDayPill}
                  >
                    <MaterialCommunityIcons name="calendar-check-outline" size={17} color={theme.color.accent} />
                    <Animated.Text
                      style={[
                        styles.shoppingFlowDayPillText,
                        {
                          fontSize: shoppingCardRotation.interpolate({
                            inputRange: [0, 1, 2, 3],
                            outputRange: [
                              theme.type.size.sm,
                              theme.type.size.xs,
                              theme.type.size.xs,
                              theme.type.size.sm,
                            ],
                          }),
                        },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.8}
                    >
                      Every {selectedDayName}
                    </Animated.Text>
                  </View>
                  <Text style={styles.shoppingFlowCardCopy}>Get everything you need in one trip.</Text>
                </Animated.View>
              </Animated.View>

              <Animated.View style={rotatingSlotStyle(1)}>
                <Animated.View style={[styles.shoppingFlowCard, styles.shoppingFlowSecondaryCard, styles.shoppingFlowDinnerCard, styles.shoppingFlowRotatingCard, animatedCardStyle(shoppingDinnerCardProgress, 18)]}>
                  <View style={styles.shoppingFlowSecondaryIcon}>
                    <MaterialCommunityIcons name="bowl-mix-outline" size={28} color={theme.color.accent} />
                  </View>
                  <View style={styles.shoppingFlowSecondaryContent}>
                    <Text style={styles.shoppingFlowSecondaryTitle}>Cook &amp; Serve</Text>
                    <Text style={styles.shoppingFlowSecondaryCopy}>Know what’s for dinner all week.</Text>
                  </View>
                </Animated.View>
              </Animated.View>

              <Animated.View style={[styles.shoppingFlowPlanToShop, { opacity: shoppingConnectorsProgress }]}>
                <MaterialCommunityIcons name="arrow-top-right" size={19} color={theme.color.accent} />
              </Animated.View>
              <Animated.View style={[styles.shoppingFlowShopToDinner, { opacity: shoppingConnectorsProgress }]}>
                <MaterialCommunityIcons name="arrow-bottom-right" size={19} color={theme.color.accent} />
              </Animated.View>
              <Animated.View style={[styles.shoppingFlowDinnerToPlan, { opacity: shoppingConnectorsProgress }]}>
                <MaterialCommunityIcons name="arrow-left" size={19} color={theme.color.accent} />
              </Animated.View>
            </View>
          </View>
        </View>

        <Pressable
          disabled={!shoppingDay || shoppingDayFlowPhase === "transitioning"}
          accessibilityRole="button"
          accessibilityState={{ disabled: !shoppingDay || shoppingDayFlowPhase === "transitioning" }}
          style={[
            styles.primaryButton,
            styles.shoppingDayContinue,
            (!shoppingDay || shoppingDayFlowPhase === "transitioning") && styles.primaryButtonDisabled,
          ]}
          onPress={handleShoppingDayContinue}
        >
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>

        {travelingChipLayout && shoppingDayFlowPhase === "transitioning" ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.shoppingTravelingChip,
              {
                left: travelingChipLayout.left,
                top: travelingChipLayout.top,
                width: shoppingChipProgress.interpolate({ inputRange: [0, 1], outputRange: [travelingChipLayout.width, travelingChipLayout.targetWidth] }),
                height: shoppingChipProgress.interpolate({ inputRange: [0, 1], outputRange: [travelingChipLayout.height, travelingChipLayout.targetHeight] }),
                borderRadius: shoppingChipProgress.interpolate({ inputRange: [0, 1], outputRange: [theme.radius.md, theme.radius.full] }),
                backgroundColor: shoppingChipProgress.interpolate({ inputRange: [0, 1], outputRange: [theme.color.accent, theme.mode === "dark" ? "#442735" : "#FFE7F0"] }),
                opacity: shoppingChipOpacity,
                transform: [
                  { translateX: shoppingChipProgress.interpolate({ inputRange: [0, 1], outputRange: [0, travelingChipLayout.translateX] }) },
                  { translateY: shoppingChipProgress.interpolate({ inputRange: [0, 1], outputRange: [0, travelingChipLayout.translateY] }) },
                ],
              },
            ]}
          >
            <Animated.Text style={[styles.shoppingTravelingShortText, { opacity: shoppingChipProgress.interpolate({ inputRange: [0, 0.35, 0.58, 1], outputRange: [1, 1, 0, 0] }) }]}>
              {selectedDayName.slice(0, 3)}
            </Animated.Text>
            <Animated.View style={[styles.shoppingTravelingFullContent, { opacity: shoppingChipProgress.interpolate({ inputRange: [0, 0.48, 0.72, 1], outputRange: [0, 0, 1, 1] }) }]}>
              <MaterialCommunityIcons name="calendar-check-outline" size={17} color={theme.color.accent} />
              <Text style={styles.shoppingTravelingFullText}>Every {selectedDayName}</Text>
            </Animated.View>
          </Animated.View>
        ) : null}
      </View>
    );
  };

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
        return renderShoppingDayStep();
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
              <ScrollView
                ref={familyListScrollRef}
                style={styles.familyListScroll}
                contentContainerStyle={[
                  styles.familyListContent,
                  familyKeyboardInset > 0 && {
                    paddingBottom: familyKeyboardInset + theme.space.xs,
                  },
                ]}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                onContentSizeChange={() => {
                  if (familyMemberInputRef.current?.isFocused()) {
                    scrollFamilyInputIntoView();
                  }
                }}
              >
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
                <View style={styles.familyInputRow}>
                  <TextInput
                    ref={familyMemberInputRef}
                    value={familyMemberInput}
                    onChangeText={setFamilyMemberInput}
                    onFocus={scrollFamilyInputIntoView}
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
              </ScrollView>
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
                          <MealEmoji
                            value={meal.emoji}
                            size={22}
                            style={styles.quickMealEmoji}
                          />
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
                        .map((meal) => (
                          <MealEmoji
                            key={normalizeMealTitle(meal.title)}
                            value={meal.emoji}
                            size={20}
                            style={styles.quickMealSummaryEmoji}
                          />
                        ))}
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
            <Pressable
              style={styles.learnMoreButton}
              accessibilityRole="link"
              onPress={() => {
                void Linking.openURL("https://weeklyeats.site").catch(() => {
                  Alert.alert("Couldn’t open the website", "Please try again in a moment.");
                });
              }}
            >
              <Text style={styles.learnMoreText}>Learn More About Weekly Eats</Text>
            </Pressable>
            <View style={styles.afterFirstWeekRow}>
              <MaterialCommunityIcons name="shield-check-outline" size={29} color={theme.color.accent} />
              <Text style={styles.afterFirstWeekCopy}>After your first free week, you can choose Weekly Eats Pro to keep planning future weeks{subscription.annualPriceString ? ` for ${subscription.annualPriceString}/year` : " with an annual subscription"}.</Text>
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
                isSavingQuickMeals ||
                quickMealTransitionPhase !== "idle" ||
                shoppingDayFlowPhase === "transitioning"
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
        {step === "family" ? (
          <View style={styles.familyPageContent}>{renderStep()}</View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {renderStep()}
          </ScrollView>
        )}
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
    familyPageContent: {
      flex: 1,
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
      position: "relative",
    },
    shoppingDayTransitionStage: {
      minHeight: 500,
      position: "relative",
    },
    shoppingDayHero: {
      alignItems: "center",
      gap: theme.space.lg,
      paddingTop: theme.space.sm,
      paddingHorizontal: theme.space.sm,
    },
    shoppingDayMain: {
      gap: theme.space["2xl"] + theme.space.sm,
      minHeight: 500,
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
    shoppingFlowLayer: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      paddingHorizontal: theme.space.xs,
    },
    shoppingFlowHeader: {
      alignItems: "center",
      gap: theme.space.xs,
      marginBottom: theme.space.md,
    },
    shoppingFlowTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h1,
      lineHeight: theme.type.size.h1 * 1.15,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    shoppingFlowSubtitle: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      lineHeight: theme.type.size.sm * 1.35,
      textAlign: "center",
    },
    shoppingFlowCard: {
      alignItems: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 7 },
      shadowOpacity: theme.mode === "dark" ? 0.2 : 0.08,
      shadowRadius: 14,
      elevation: 3,
    },
    shoppingFlowShopCard: {
      position: "absolute",
      top: 0,
      left: "14%",
      width: "72%",
      minHeight: 185,
      justifyContent: "center",
      gap: theme.space.xs,
      paddingHorizontal: theme.space.sm,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.xl,
      borderWidth: 1.5,
      backgroundColor: theme.color.surface,
    },
    shoppingFlowRotatingCard: {
      position: "relative",
      top: 0,
      bottom: undefined,
      left: 0,
      right: undefined,
      width: "100%",
      minHeight: 185,
    },
    shoppingFlowPrimaryIcon: {
      width: 48,
      height: 48,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        theme.mode === "dark" ? "rgba(255,75,145,0.17)" : "#FFE7F0",
    },
    shoppingFlowCardTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    shoppingFlowDayPill: {
      maxWidth: "100%",
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.xs,
      paddingHorizontal: theme.space.xs,
      borderRadius: theme.radius.full,
      backgroundColor:
        theme.mode === "dark" ? "#442735" : "#FFE7F0",
    },
    shoppingFlowDayPillText: {
      flexShrink: 1,
      textAlign: "center",
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    shoppingFlowCardCopy: {
      maxWidth: 220,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      lineHeight: theme.type.size.sm * 1.25,
      textAlign: "center",
    },
    shoppingFlowLoop: {
      width: "100%",
      height: 410,
      position: "relative",
    },
    shoppingFlowPlanToShop: {
      position: "absolute",
      zIndex: 0,
      top: 188,
      left: "24%",
      transform: [{ rotate: "-10deg" }],
    },
    shoppingFlowShopToDinner: {
      position: "absolute",
      zIndex: 0,
      top: 188,
      right: "24%",
      transform: [{ rotate: "10deg" }],
    },
    shoppingFlowDinnerToPlan: {
      position: "absolute",
      zIndex: 0,
      top: 300,
      left: "44%",
      right: "44%",
      height: 16,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
    },
    shoppingFlowSecondaryCard: {
      position: "absolute",
      bottom: 20,
      zIndex: 1,
      width: "44%",
      minHeight: 165,
      justifyContent: "center",
      gap: theme.space.xs,
      paddingHorizontal: theme.space.sm,
      paddingVertical: theme.space.sm,
      borderRadius: theme.radius.xl,
    },
    shoppingFlowPlanCard: {
      left: 0,
      backgroundColor: theme.color.surface,
    },
    shoppingFlowDinnerCard: {
      right: 0,
      backgroundColor: theme.color.surface,
    },
    shoppingFlowSecondaryIcon: {
      width: 42,
      height: 42,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor:
        theme.mode === "dark" ? "rgba(255,75,145,0.15)" : "#FFE7F0",
    },
    shoppingFlowSecondaryContent: {
      alignItems: "center",
      gap: 2,
    },
    shoppingFlowSecondaryTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    shoppingFlowSecondaryCopy: {
      flexShrink: 1,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      lineHeight: theme.type.size.xs * 1.3,
      textAlign: "center",
    },
    shoppingTravelingChip: {
      position: "absolute",
      zIndex: 20,
      elevation: 20,
      overflow: "hidden",
      alignItems: "center",
      justifyContent: "center",
    },
    shoppingTravelingShortText: {
      position: "absolute",
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    shoppingTravelingFullContent: {
      position: "absolute",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.xs,
    },
    shoppingTravelingFullText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
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
      flex: 1,
      minHeight: 160,
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
    familyListScroll: {
      flex: 1,
    },
    familyListContent: {
      gap: theme.space.xs,
      paddingBottom: theme.space.xs,
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
    firstWeekFreeCard: {
      position: "relative",
      overflow: "hidden",
      paddingTop: 24,
      paddingHorizontal: 20,
      paddingBottom: 48,
      borderRadius: theme.radius.lg,
      backgroundColor: theme.color.surface,
      borderWidth: 1,
      borderColor: theme.color.border,
    },
    firstWeekCardTop: { flexDirection: "row", alignItems: "flex-start", gap: theme.space.lg },
    firstWeekGiftCircle: { width: 76, height: 76, borderRadius: 38, alignItems: "center", justifyContent: "center", backgroundColor: theme.color.surfaceAlt },
    firstWeekFreeCopy: { flex: 1, gap: theme.space.sm },
    firstWeekSparkle: { position: "absolute", right: 0, top: 0 },
    noSubscriptionCopy: {
      marginTop: theme.space.lg,
      paddingTop: theme.space.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.color.border,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      lineHeight: 23,
      textAlign: "center",
      zIndex: 2,
    },
    noSubscriptionEmphasis: { color: theme.color.accent, fontWeight: theme.type.weight.bold },
    firstWeekWaveBack: { position: "absolute", left: -35, bottom: -38, width: "72%", height: 63, borderRadius: 80, backgroundColor: theme.color.surfaceAlt, transform: [{ rotate: "8deg" }] },
    firstWeekWaveFront: { position: "absolute", right: -45, bottom: -43, width: "72%", height: 70, borderRadius: 80, backgroundColor: theme.color.border, transform: [{ rotate: "-7deg" }] },
    weekFeatureSection: { gap: theme.space.md },
    weekFeatureHeading: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
    weekFeatureHeadingText: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
    weekFeatureList: { flexDirection: "row", justifyContent: "space-between", gap: 5 },
    weekFeatureItem: { flex: 1, alignItems: "center", gap: 6 },
    weekFeatureIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: theme.color.surfaceAlt },
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
