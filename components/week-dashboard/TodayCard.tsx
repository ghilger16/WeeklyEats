import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Keyboard,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { Meal } from "../../types/meals";
import {
  EAT_OUT_MEAL,
  EAT_OUT_MEAL_ID,
  FLEX_NIGHT_MEAL_ID,
} from "../../types/specialMeals";
import { ServedMealEntry } from "../../stores/servedMealsStorage";
import { type ServedOutcome } from "./servedActions";
import { useFamilyMembers } from "../../hooks/useFamilyMembers";
import { FamilyRatingValue } from "../../types/meals";
import { getFamilyRatingSummary } from "../../utils/familyRatings";
import FamilyRatingRow from "../meals/FamilyRatingRow";
import FreezerAmountModal from "../meals/FreezerAmountModal";
import RatingStars from "../meals/RatingStars";
import { RatingDisplayMode } from "../../hooks/useRatingDisplayMode";

const EAT_OUT_MESSAGES = [
  "No cooking tonight! 🎉",
  "Dinner’s someone else’s job tonight. 😌",
  "Kitchen’s closed tonight! 🙌",
  "Enjoy the night off from cooking. ✨",
  "No dishes tonight! 🎉",
] as const;

type TodayCardProps = {
  meal: Meal;
  dateLabel: string;
  dateKey?: string;
  notes?: string;
  servedEntry?: ServedMealEntry;
  sides?: string[];
  onMarkServed?: (message: string) => Promise<void> | void;
  onSelectOutcome?: (outcome: ServedOutcome) => Promise<void> | void;
  onChangePlans?: () => void;
  onChangeFamilyRating?: (memberId: string, rating: FamilyRatingValue) => void;
  isGalaxyMeal?: boolean;
  onSaveFreezer?: (amount: string, unit: string, addedAt: string) => void;
  onRemoveFreezer?: () => void;
  onSavePrepNotes?: (notes: string) => void;
  ratingMode?: RatingDisplayMode;
  onChangeMealRating?: (rating: number) => void;
};

type CelebrationPhase = "idle" | "burst" | "complete" | "carousel";
type CarouselPage = "ratings" | "served" | "freezer" | "notes";

const SPARKLES = [
  { x: -72, y: -34, color: "#FF4D8D" }, { x: -48, y: -66, color: "#FEC107" },
  { x: -18, y: -76, color: "#FF8AB5" }, { x: 26, y: -70, color: "#FEC107" },
  { x: 65, y: -42, color: "#FF4D8D" }, { x: 72, y: 2, color: "#FEC107" },
  { x: -70, y: 8, color: "#FF8AB5" }, { x: 42, y: 22, color: "#FF4D8D" },
] as const;

export default function TodayCard({
  meal,
  dateLabel,
  dateKey,
  notes,
  servedEntry,
  sides = [],
  onMarkServed,
  onChangePlans,
  onChangeFamilyRating,
  isGalaxyMeal = false,
  onSaveFreezer,
  onRemoveFreezer,
  onSavePrepNotes,
  ratingMode = "family",
  onChangeMealRating,
}: TodayCardProps) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const servedFromEntry = servedEntry?.outcome === "served";
  const [isLocallyServed, setLocallyServed] = useState(servedFromEntry);
  const [isSaving, setSaving] = useState(false);
  const [phase, setPhase] = useState<CelebrationPhase>("idle");
  const [reduceMotion, setReduceMotion] = useState(false);
  const [carouselOrder, setCarouselOrder] = useState<CarouselPage[] | null>(null);
  const [ratingsWereNeeded, setRatingsWereNeeded] = useState<boolean | null>(null);
  const [activePage, setActivePage] = useState(0);
  const [carouselWidth, setCarouselWidth] = useState(0);
  const [isFreezerModalVisible, setFreezerModalVisible] = useState(false);
  const [notesDraft, setNotesDraft] = useState(meal.prepNotes ?? "");
  const [isNotesFocused, setNotesFocused] = useState(false);
  const savingRef = useRef(false);
  const carouselRef = useRef<ScrollView | null>(null);
  const notesInputRef = useRef<TextInput | null>(null);
  const experienceKeyRef = useRef(`${meal.id}:${dateKey ?? dateLabel}`);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { members } = useFamilyMembers();
  const checkScale = useRef(new Animated.Value(servedFromEntry ? 1 : 0.8)).current;
  const successOpacity = useRef(new Animated.Value(servedFromEntry ? 1 : 0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const sparkleProgress = useRef(new Animated.Value(0)).current;
  const completionProgress = useRef(new Animated.Value(0)).current;
  const ratingProgress = useRef(new Animated.Value(0)).current;
  const isServed = servedFromEntry || isLocallyServed;
  const isEatOut = meal.id === EAT_OUT_MEAL_ID;
  const isFlexNight = meal.id === FLEX_NIGHT_MEAL_ID;
  const sidesLabel = sides.join(" · ");
  const prepNotes = notes ?? meal.prepNotes?.trim();
  const hasPrepNotes = Boolean(prepNotes?.trim());
  const eatOutNote = isEatOut
    ? notes?.trim() ||
      (meal.title !== EAT_OUT_MEAL.title ? meal.title.trim() : "") ||
      meal.prepNotes?.trim()
    : undefined;
  const eatOutMessage = useMemo(() => {
    const stableKey = dateKey ?? dateLabel;
    const hash = [...stableKey].reduce(
      (total, character) => total + character.charCodeAt(0),
      0,
    );
    return EAT_OUT_MESSAGES[hash % EAT_OUT_MESSAGES.length];
  }, [dateKey, dateLabel]);

  const memberIds = useMemo(() => members.map((member) => member.id), [members]);
  const useRatingStars = ratingMode === "summary" || members.length <= 1;
  const ratingsNeeded = useRatingStars
    ? (meal.rating ?? 0) === 0
    : members.length > 1 && memberIds.some(
        (memberId) => (meal.familyRatings?.[memberId] ?? 0) === 0,
      );
  const familySummary = useMemo(
    () => getFamilyRatingSummary(meal.familyRatings, memberIds),
    [meal.familyRatings, memberIds],
  );
  const isFamilyStar = !useRatingStars && Boolean(familySummary?.isUnanimousHeart);

  const initializeCarousel = useCallback(() => {
    if (carouselOrder) return;
    const order: CarouselPage[] = ratingsNeeded
      ? ["served", "ratings", "freezer", "notes"]
      : ["served", "freezer", "notes", "ratings"];
    setRatingsWereNeeded(ratingsNeeded);
    setCarouselOrder(order);
    setActivePage(0);
  }, [carouselOrder, ratingsNeeded]);

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  }, []);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  useEffect(() => {
    setNotesDraft(meal.prepNotes ?? "");
  }, [meal.id, meal.prepNotes]);

  useEffect(() => {
    const nextKey = `${meal.id}:${dateKey ?? dateLabel}`;
    if (experienceKeyRef.current === nextKey) return;
    experienceKeyRef.current = nextKey;
    clearTimers();
    setCarouselOrder(null);
    setRatingsWereNeeded(null);
    setActivePage(0);
    setPhase("idle");
    contentOpacity.setValue(1);
    sparkleProgress.setValue(0);
    completionProgress.setValue(0);
    ratingProgress.setValue(0);
  }, [clearTimers, completionProgress, contentOpacity, dateKey, dateLabel, meal.id, ratingProgress, sparkleProgress]);

  useEffect(() => {
    if (isServed && phase === "idle") initializeCarousel();
  }, [initializeCarousel, isServed, phase]);

  useEffect(() => {
    if (phase !== "idle") return;
    setLocallyServed(servedFromEntry);
    checkScale.setValue(servedFromEntry ? 1 : 0.8);
    successOpacity.setValue(servedFromEntry ? 1 : 0);
  }, [checkScale, phase, servedFromEntry, successOpacity]);

  const handleServed = async () => {
    if (isServed || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setLocallyServed(true);
    const shouldCelebrate = !isEatOut && !isFlexNight;
    setPhase(shouldCelebrate ? "burst" : "idle");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    if (!shouldCelebrate) {
      Animated.parallel([
        Animated.spring(checkScale, { toValue: 1, speed: 18, bounciness: 8, useNativeDriver: true }),
        Animated.timing(successOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    }
    if (shouldCelebrate) {
    Animated.sequence([
      Animated.timing(buttonScale, { toValue: 0.94, duration: reduceMotion ? 0 : 90, useNativeDriver: true }),
      Animated.spring(buttonScale, { toValue: 1, speed: 24, bounciness: reduceMotion ? 0 : 10, useNativeDriver: true }),
    ]).start();
    Animated.parallel([
      Animated.timing(contentOpacity, { toValue: 0, duration: reduceMotion ? 120 : 360, delay: reduceMotion ? 0 : 260, useNativeDriver: true }),
      Animated.timing(sparkleProgress, { toValue: 1, duration: reduceMotion ? 1 : 520, useNativeDriver: true }),
    ]).start();
    const completionTimer = setTimeout(() => {
      setPhase("complete");
      Animated.spring(completionProgress, { toValue: 1, speed: 18, bounciness: reduceMotion ? 0 : 9, useNativeDriver: true }).start();
    }, reduceMotion ? 120 : 480);
    const ratingTimer = setTimeout(() => {
      initializeCarousel();
      setPhase("carousel");
      Animated.timing(ratingProgress, { toValue: 1, duration: reduceMotion ? 160 : 360, useNativeDriver: true }).start();
    }, reduceMotion ? 650 : 1200);
    timersRef.current.push(completionTimer, ratingTimer);
    }
    try {
      await onMarkServed?.("Dinner served");
    } catch (error) {
      clearTimers();
      setLocallyServed(false);
      setPhase("idle");
      contentOpacity.setValue(1);
      sparkleProgress.setValue(0);
      completionProgress.setValue(0);
      ratingProgress.setValue(0);
      console.warn("[TodayCard] Failed to mark served", error);
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const openRecipe = () => {
    const url = meal.recipeUrl?.trim();
    if (url) Linking.openURL(url).catch(() => {});
  };

  const scrollToPage = (index: number) => {
    if (!carouselWidth) return;
    notesInputRef.current?.blur();
    setNotesFocused(false);
    Keyboard.dismiss();
    carouselRef.current?.scrollTo({ x: index * carouselWidth, animated: !reduceMotion });
    setActivePage(index);
  };

  const handleCarouselMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!carouselWidth) return;
    const nextPage = Math.round(event.nativeEvent.contentOffset.x / carouselWidth);
    if (nextPage !== activePage) {
      notesInputRef.current?.blur();
      setNotesFocused(false);
      Keyboard.dismiss();
    }
    setActivePage(nextPage);
  };

  const renderCarouselPage = (page: CarouselPage) => {
    if (page === "ratings") {
      return (
        <View style={[styles.carouselPageContent, styles.ratingsPageContent]}>
          <Text style={styles.carouselPrompt}>{ratingsWereNeeded ? "How was the meal?" : "Still the same ratings?"}</Text>
          <Text style={styles.ratingLabel}>{useRatingStars ? "RATING" : "FAMILY RATING"}</Text>
          <View style={styles.ratingMembers}>
            {useRatingStars ? (
              <RatingStars value={meal.rating ?? 0} size={32} gap={theme.space.sm} onChange={onChangeMealRating} />
            ) : (
              <FamilyRatingRow compact ratings={meal.familyRatings} onChange={(memberId, rating) => onChangeFamilyRating?.(memberId, rating)} />
            )}
          </View>
        </View>
      );
    }
    if (page === "served") {
      return (
        <View style={styles.carouselPageContent}>
          <MaterialCommunityIcons name="check-circle" size={62} color={theme.color.accent} />
          <Text style={styles.carouselPrompt}>Served!</Text>
          <Text style={styles.carouselMealTitle}>{meal.title}</Text>
          {sidesLabel ? <Text style={styles.carouselSubtext}>{sidesLabel}</Text> : null}
        </View>
      );
    }
    if (page === "freezer") {
      const inFreezer = Boolean(meal.isFavorite);
      return (
        <View style={[styles.carouselPageContent, styles.freezerPageContent]}>
          <MaterialCommunityIcons name="snowflake" size={48} color={theme.color.accent} />
          <Text style={styles.carouselPrompt}>{inFreezer ? "Saved for later" : "Save some for later?"}</Text>
          <Text style={styles.carouselSubtext}>{inFreezer ? `${meal.title} is in your freezer.` : `Add ${meal.title} to your freezer.`}</Text>
          <Pressable onPress={() => inFreezer ? onRemoveFreezer?.() : setFreezerModalVisible(true)} style={({ pressed }) => [styles.carouselButton, styles.freezerButton, pressed && styles.pressed]} accessibilityRole="button">
            <Text style={styles.carouselButtonText}>{inFreezer ? "Remove from Freezer" : "Add to Freezer"}</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={[styles.carouselPageContent, styles.notesPageContent]}>
        {!isNotesFocused ? <MaterialCommunityIcons name="note-edit-outline" size={34} color={theme.color.accent} /> : null}
        <View style={styles.notesHeadingRow}>
          {isNotesFocused ? <MaterialCommunityIcons name="note-edit-outline" size={21} color={theme.color.accent} /> : null}
          <Text style={styles.carouselPrompt}>Anything to remember?</Text>
        </View>
        <TextInput ref={notesInputRef} value={notesDraft} onChangeText={setNotesDraft} onFocus={() => setNotesFocused(true)} placeholder="Add a note for next time" placeholderTextColor={theme.color.subtleInk} multiline style={[styles.notesInput, isNotesFocused && styles.notesInputFocused]} />
        {isNotesFocused ? (
          <View style={styles.notesActions}>
            <Pressable
              onPress={() => {
                setNotesDraft(meal.prepNotes ?? "");
                setNotesFocused(false);
                Keyboard.dismiss();
              }}
              style={({ pressed }) => [styles.notesAction, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.notesCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onSavePrepNotes?.(notesDraft.trim());
                setNotesFocused(false);
                Keyboard.dismiss();
              }}
              style={({ pressed }) => [styles.notesAction, styles.notesDoneAction, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <Text style={styles.notesDoneText}>Done</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  const isCelebrating = phase !== "idle" && phase !== "carousel" && !isEatOut && !isFlexNight;
  const showCarousel = isServed && !isEatOut && !isFlexNight && (phase === "carousel" || phase === "idle") && Boolean(carouselOrder);

  return (
    <View style={[
      styles.card,
      !isEatOut && !isFlexNight && styles.fixedMealCard,
      isServed && !isEatOut && styles.cardServed,
      isFamilyStar && !isGalaxyMeal && styles.familyStarCard,
      isGalaxyMeal && styles.galaxyCard,
    ]}>
      {isFamilyStar ? (
        <View pointerEvents="none" style={styles.cardAchievementIcon}>
          <MaterialCommunityIcons
            name={isGalaxyMeal ? "creation" : "star"}
            size={22}
            color={isGalaxyMeal ? "#8B5CF6" : "#F2D15B"}
            accessibilityLabel={isGalaxyMeal ? "Galaxy Meal" : "Family Star"}
          />
        </View>
      ) : null}
      {showCarousel ? (
        <Animated.View
          style={[styles.carouselShell, { opacity: phase === "carousel" ? ratingProgress : 1, transform: [{ translateX: phase === "carousel" ? ratingProgress.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : 34, 0] }) : 0 }] }]}
          onLayout={(event) => setCarouselWidth(event.nativeEvent.layout.width)}
        >
          {carouselWidth > 0 ? (
            <ScrollView
              ref={carouselRef}
              horizontal
              pagingEnabled
              directionalLockEnabled
              alwaysBounceVertical={false}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              bounces={false}
              onMomentumScrollEnd={handleCarouselMomentumEnd}
              keyboardShouldPersistTaps="handled"
            >
              {carouselOrder?.map((page) => <View key={page} style={[styles.carouselPage, { width: carouselWidth }]}>{renderCarouselPage(page)}</View>)}
            </ScrollView>
          ) : null}
          <View style={styles.pageIndicators}>
            {carouselOrder?.map((page, index) => (
              <Pressable key={page} onPress={() => scrollToPage(index)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Show ${page} card`}>
                <View style={[styles.pageDot, index === activePage && styles.pageDotActive]} />
              </Pressable>
            ))}
          </View>
        </Animated.View>
      ) : isCelebrating && phase !== "burst" ? (
        <View style={styles.celebrationContent} accessibilityLiveRegion="polite">
          <Animated.View style={[styles.completionMark, {
            opacity: completionProgress,
            transform: [
              { translateY: 0 },
              { scale: completionProgress.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 1 : 0.65, 1] }) },
            ],
          }]}>
            <MaterialCommunityIcons name="check-circle" size={76} color={theme.color.accent} />
            <Text style={styles.servedCelebrationText}>Served!</Text>
          </Animated.View>
        </View>
      ) : (
      <Animated.View style={[styles.normalContent, { opacity: phase === "idle" ? 1 : contentOpacity }]}>
      <View style={[styles.headerRow, isFamilyStar && styles.headerRowWithAchievement]}>
        <Text style={styles.eyebrow}>{dateLabel.toUpperCase()}</Text>
        <View style={styles.badges}>
          {meal.isFavorite ? (
            <MaterialCommunityIcons name="snowflake" size={17} color={theme.color.accent} />
          ) : null}
          {isServed && phase !== "burst" && !isEatOut ? (
            <Animated.View style={{ opacity: successOpacity, transform: [{ scale: checkScale }] }}>
              <MaterialCommunityIcons name="check-circle" size={24} color={theme.color.accent} />
            </Animated.View>
          ) : null}
        </View>
      </View>

      {isEatOut ? (
        <View style={styles.eatOutContent}>
          <View style={styles.eatOutIcon}>
            <MaterialCommunityIcons
              name="silverware-fork-knife"
              size={30}
              color={theme.color.accent}
            />
          </View>
          <View style={styles.eatOutTitleGroup}>
            <Text style={styles.title}>Eat Out</Text>
            {eatOutNote ? <Text style={styles.eatOutNote}>{eatOutNote}</Text> : null}
          </View>
          <View style={styles.eatOutDivider}>
            <View style={styles.eatOutDividerLine} />
            <MaterialCommunityIcons name="heart" size={10} color={theme.color.accent} />
            <View style={styles.eatOutDividerLine} />
          </View>
          <Text style={styles.eatOutMessage} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {eatOutMessage}
          </Text>
          <Pressable
            onPress={onChangePlans}
            accessibilityRole="button"
            accessibilityLabel="Change Eat Out plan"
            style={({ pressed }) => [styles.eatOutChange, pressed && styles.pressed]}
          >
            <MaterialCommunityIcons name="swap-horizontal" size={17} color={theme.color.accent} />
            <Text style={styles.eatOutChangeText}>Change</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={[styles.mealRow, !hasPrepNotes && styles.mealRowCentered]}>
            <Text style={styles.emoji}>{meal.emoji || "🍽️"}</Text>
            <View style={[styles.mealText, !hasPrepNotes && styles.mealTextCentered]}>
              <Text style={[styles.title, !hasPrepNotes && styles.mealTitleCentered]}>{meal.title}</Text>
              {isFlexNight ? <Text style={styles.meta}>Keep tonight flexible</Text> : null}
              {sidesLabel ? <Text style={styles.sides}>w/ {sidesLabel}</Text> : null}
              {hasPrepNotes ? <Text style={styles.notes}>{prepNotes?.trim()}</Text> : null}
            </View>
          </View>
          {isServed && phase !== "burst" ? (
            <Animated.View style={[styles.completedRow, { opacity: successOpacity }]}>
              <MaterialCommunityIcons name="check" size={18} color={theme.color.accent} />
              <Text style={styles.completedText}>Served</Text>
            </Animated.View>
          ) : (
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <Pressable
                onPress={handleServed}
                disabled={isSaving}
                accessibilityRole="button"
                accessibilityLabel={`Mark ${meal.title} as served`}
                style={({ pressed }) => [styles.servedButton, pressed && styles.pressed]}
              >
                <View style={styles.servedButtonInner}>
                <MaterialCommunityIcons name="check" size={21} color="#FFFFFF" />
                <Text style={styles.servedButtonText}>Mark as Served</Text>
                </View>
              </Pressable>
            </Animated.View>
          )}
          <View style={styles.secondaryActions}>
            {meal.recipeUrl?.trim() ? (
              <Pressable onPress={openRecipe} accessibilityRole="link" style={styles.textButton}>
                <MaterialCommunityIcons name="link-variant" size={19} color={theme.color.accent} />
                <Text style={styles.textButtonLabel}>Recipe</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onChangePlans} accessibilityRole="button" style={styles.textButton}>
              <MaterialCommunityIcons name="swap-horizontal" size={19} color={theme.color.subtleInk} />
              <Text style={[styles.textButtonLabel, styles.changeLabel]}>Change</Text>
            </Pressable>
          </View>
        </>
      )}
      </Animated.View>
      )}
      {!reduceMotion && phase === "burst" && !isFlexNight ? SPARKLES.map((sparkle, index) => (
        <Animated.View key={`button-sparkle-${index}`} pointerEvents="none" style={[styles.sparkle, { backgroundColor: sparkle.color, opacity: sparkleProgress.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 0] }), transform: [{ translateX: sparkleProgress.interpolate({ inputRange: [0, 1], outputRange: [0, sparkle.x] }) }, { translateY: sparkleProgress.interpolate({ inputRange: [0, 1], outputRange: [35, sparkle.y + 35] }) }, { scale: sparkleProgress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1, 0.3] }) }] }]} />
      )) : null}
      <FreezerAmountModal
        visible={isFreezerModalVisible}
        initialMeal={meal}
        initialAmount={meal.freezerAmount ?? meal.freezerQuantity ?? ""}
        initialUnit={meal.freezerUnit}
        initialAddedAt={meal.freezerAddedAt}
        onDismiss={() => setFreezerModalVisible(false)}
        onComplete={(_meal, amount, unit, addedAt) => {
          onSaveFreezer?.(amount, unit, addedAt);
          setFreezerModalVisible(false);
        }}
      />
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    card: { backgroundColor: theme.color.surface, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.color.cardOutline, padding: theme.space.lg, gap: theme.space.lg },
    normalContent: { gap: theme.space.lg },
    cardServed: { backgroundColor: theme.color.surfaceAlt, borderColor: theme.color.border },
    familyStarCard: { borderColor: "#F2D15B" },
    galaxyCard: { borderColor: "#7C4DFF" },
    cardAchievementIcon: { position: "absolute", top: 12, right: 14, zIndex: 5 },
    fixedMealCard: { height: 255, padding: theme.space.lg * 0.85 },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerRowWithAchievement: { paddingRight: 28 },
    eyebrow: { color: theme.color.accent, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold, letterSpacing: 0.8 },
    badges: { flexDirection: "row", alignItems: "center", gap: theme.space.sm },
    mealRow: { flexDirection: "row", alignItems: "center", gap: theme.space.md, marginTop: 6 },
    mealRowCentered: { justifyContent: "center" },
    emoji: { fontSize: 42 },
    mealText: { flex: 1, gap: theme.space.xs },
    mealTextCentered: { flex: 0, alignItems: "center" },
    title: { color: theme.color.ink, fontSize: theme.type.size.h2, fontWeight: theme.type.weight.bold },
    mealTitleCentered: { textAlign: "center" },
    meta: { color: theme.color.subtleInk, fontSize: theme.type.size.sm },
    sides: { color: theme.color.ink, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium },
    notes: { color: theme.color.subtleInk, fontSize: theme.type.size.xs },
    eatOutContent: { alignItems: "center", gap: theme.space.md },
    eatOutIcon: { alignItems: "center", justifyContent: "center" },
    eatOutTitleGroup: { alignItems: "center", gap: 2 },
    eatOutDivider: { width: "100%", flexDirection: "row", alignItems: "center", gap: theme.space.xs },
    eatOutDividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.color.accent, opacity: 0.55 },
    eatOutMessage: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.medium, textAlign: "center" },
    eatOutNote: { color: theme.color.subtleInk, fontSize: theme.type.size.sm, textAlign: "center" },
    eatOutChange: { minHeight: 30, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.xs, paddingHorizontal: theme.space.sm },
    eatOutChangeText: { color: theme.color.accent, fontSize: theme.type.size.sm, fontWeight: theme.type.weight.medium },
    servedButton: { minHeight: 50, borderRadius: theme.radius.xl, backgroundColor: theme.color.accent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm },
    servedButtonInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm },
    servedButtonText: { color: "#FFFFFF", fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
    completedRow: { minHeight: 46, borderRadius: theme.radius.xl, backgroundColor: theme.mode === "dark" ? "rgba(255,75,145,0.10)" : "rgba(255,75,145,0.07)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.xs },
    completedText: { color: theme.color.accent, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold },
    secondaryActions: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.xl, marginTop: 5 },
    textButton: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: theme.space.xs, paddingHorizontal: 9 },
    textButtonLabel: { color: theme.color.accent, fontSize: theme.type.size.sm * 1.1, fontWeight: theme.type.weight.medium },
    changeLabel: { color: theme.color.subtleInk },
    pressed: { opacity: 0.75 },
    celebrationContent: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: theme.space.md, overflow: "visible" },
    completionMark: { alignItems: "center", justifyContent: "center", gap: theme.space.xs },
    servedCelebrationText: { color: theme.color.accent, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold },
    sparkle: { position: "absolute", left: "50%", top: "50%", width: 8, height: 8, borderRadius: 4, marginLeft: -4, marginTop: -4 },
    ratingLabel: { color: theme.color.subtleInk, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold, letterSpacing: 0.8 },
    ratingMembers: { width: "100%", marginTop: theme.space.lg },
    carouselShell: { flex: 1, width: "100%", overflow: "hidden" },
    carouselPage: { height: 191, justifyContent: "center", paddingHorizontal: theme.space.xs },
    carouselPageContent: { flex: 1, alignItems: "center", justifyContent: "center", gap: theme.space.sm, paddingVertical: theme.space.xs },
    ratingsPageContent: { paddingVertical: 0 },
    freezerPageContent: { gap: theme.space.md },
    notesPageContent: { gap: 10, paddingVertical: 0 },
    notesHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm },
    carouselPrompt: { color: theme.color.ink, fontSize: theme.type.size.title, fontWeight: theme.type.weight.bold, textAlign: "center" },
    carouselMealTitle: { color: theme.color.ink, fontSize: theme.type.size.base, fontWeight: theme.type.weight.bold, textAlign: "center" },
    carouselSubtext: { color: theme.color.subtleInk, fontSize: theme.type.size.sm, textAlign: "center", paddingHorizontal: theme.space.lg },
    carouselButton: { minHeight: 44, borderRadius: theme.radius.xl, backgroundColor: theme.color.accent, alignItems: "center", justifyContent: "center", paddingHorizontal: theme.space.xl },
    freezerButton: { marginTop: 5 },
    carouselButtonText: { color: "#FFFFFF", fontSize: theme.type.size.sm, fontWeight: theme.type.weight.bold },
    notesInput: { width: "100%", height: 90, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.color.border, backgroundColor: theme.color.surface, color: theme.color.ink, fontSize: theme.type.size.sm, paddingHorizontal: theme.space.md, paddingVertical: theme.space.sm, textAlignVertical: "top" },
    notesInputFocused: { height: 110 },
    notesActions: { width: "100%", minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: theme.space.sm },
    notesAction: { minHeight: 28, alignItems: "center", justifyContent: "center", borderRadius: theme.radius.full, paddingHorizontal: theme.space.md },
    notesDoneAction: { backgroundColor: theme.color.accent },
    notesCancelText: { color: theme.color.subtleInk, fontSize: theme.type.size.xs, fontWeight: theme.type.weight.medium },
    notesDoneText: { color: "#FFFFFF", fontSize: theme.type.size.xs, fontWeight: theme.type.weight.bold },
    pageIndicators: { height: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: theme.space.sm },
    pageDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.color.border },
    pageDotActive: { backgroundColor: theme.color.accent, width: 9, height: 9, borderRadius: 5 },
  });
