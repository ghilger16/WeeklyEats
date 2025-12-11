import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutAnimation,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { Meal } from "../../types/meals";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { ServedMealEntry } from "../../stores/servedMealsStorage";
import { SERVED_ACTIONS, type ServedAction } from "./servedActions";
import { getRandomCelebrationMessage } from "./celebrations";
import RatingStars from "../meals/RatingStars";
import FreezerAmountModal from "../meals/FreezerAmountModal";
import { useMeals } from "../../hooks/useMeals";
import { EAT_OUT_MEAL_ID } from "../../types/specialMeals";

type TodayCardProps = {
  meal: Meal;
  dateLabel: string;
  notes?: string;
  servedEntry?: ServedMealEntry;
  sides?: string[];
  onMarkServed?: (message: string) => Promise<void> | void;
  onSelectOutcome?: (outcome: ServedAction["value"]) => Promise<void> | void;
};

export default function TodayCard({
  meal,
  dateLabel,
  notes,
  servedEntry,
  sides = [],
  onMarkServed,
  onSelectOutcome,
}: TodayCardProps) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { updateMeal } = useMeals();
  const [isExpanded, setExpanded] = useState(false);
  const servedFromEntry = servedEntry?.outcome === "served";
  const [isLocallyServed, setLocallyServed] = useState(servedFromEntry);
  const [isConfettiVisible, setConfettiVisible] = useState(false);
  const [showServedActions, setShowServedActions] = useState(false);
  const [celebrationMessage, setCelebrationMessage] = useState<string | null>(
    servedEntry?.celebrationMessage ?? null
  );
  const isEatOut = meal.id === EAT_OUT_MEAL_ID;
  const eatOutMessageRef = useRef<string | null>(null);
  const [isServedDrawerOpen, setServedDrawerOpen] = useState(false);
  const [servedExpanded, setServedExpanded] = useState<
    "rating" | "freezer" | "notes" | null
  >(null);
  const [rating, setRating] = useState(meal.rating ?? 0);
  const [inFreezer, setInFreezer] = useState(Boolean(meal.isFavorite));
  const [notesValue, setNotesValue] = useState(meal.prepNotes ?? "");
  const [isFreezerModalVisible, setFreezerModalVisible] = useState(false);

  const isServed = isLocallyServed || servedFromEntry;
  const prepNotesToShow = notes ?? meal.prepNotes ?? "";
  const sidesLabel = sides.length ? sides.join(" • ") : "";
  const servedActionsForMeal = useMemo(
    () =>
      isEatOut
        ? SERVED_ACTIONS.filter(
            (action) => action.value === "cookedAlt" || action.value === "skipped"
          )
        : SERVED_ACTIONS,
    [isEatOut]
  );
  const eatOutMessage = eatOutMessageRef.current;
  const servedButtonLabel = isEatOut ? "Change of Plans" : "Mark as Served";
  const confettiPieces = useRef(
    Array.from({ length: 24 }, () => ({
      translateY: new Animated.Value(0),
      translateX: new Animated.Value(0),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1),
      left: Math.random() * 100,
      size: 6 + Math.random() * 6,
      color: ["#5BC0EB", "#FDE74C", "#9BC53D", "#E55934", "#FA7921"][
        Math.floor(Math.random() * 5)
      ],
      delay: Math.random() * 120,
    }))
  ).current;

  useEffect(() => {
    setLocallyServed(servedFromEntry);
    setCelebrationMessage(servedEntry?.celebrationMessage ?? null);
  }, [servedFromEntry, servedEntry?.celebrationMessage]);

  useEffect(() => {
    setRating(meal.rating ?? 0);
    setInFreezer(Boolean(meal.isFavorite));
    setNotesValue(meal.prepNotes ?? "");
  }, [meal]);

  useEffect(() => {
    if (servedExpanded === null) {
      setServedDrawerOpen(false);
    }
  }, [servedExpanded]);

  useEffect(() => {
    if (!isServed) {
      setShowServedActions(false);
    }
  }, [isServed]);

  useEffect(() => {
    if (isServed && !isConfettiVisible) {
      setShowServedActions(true);
    }
  }, [isConfettiVisible, isServed]);

  useEffect(() => {
    if (isEatOut) {
      const messages = [
        "You’re dining out tonight. Enjoy the break!",
        "Enjoy a night out!",
        "No cooking tonight — treat yourself!",
        "Chef’s night off!",
      ];
      if (!eatOutMessageRef.current) {
        eatOutMessageRef.current =
          messages[Math.floor(Math.random() * messages.length)];
      }
    } else {
      eatOutMessageRef.current = null;
    }
  }, [isEatOut]);

  const triggerConfetti = useCallback(() => {
    setConfettiVisible(true);
    setShowServedActions(false);
    const animations = confettiPieces.map((piece) => {
      piece.translateY.setValue(0);
      piece.translateX.setValue(0);
      piece.rotate.setValue(0);
      piece.opacity.setValue(1);
      const yTarget = 140 + Math.random() * 80;
      const xTarget = (Math.random() * 2 - 1) * 40;
      const rotateTarget = (Math.random() * 2 - 1) * Math.PI;

      return Animated.parallel([
        Animated.timing(piece.translateY, {
          toValue: yTarget,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          delay: piece.delay,
          useNativeDriver: true,
        }),
        Animated.timing(piece.translateX, {
          toValue: xTarget,
          duration: 1200,
          easing: Easing.out(Easing.quad),
          delay: piece.delay,
          useNativeDriver: true,
        }),
        Animated.timing(piece.rotate, {
          toValue: rotateTarget,
          duration: 1200,
          easing: Easing.linear,
          delay: piece.delay,
          useNativeDriver: true,
        }),
        Animated.timing(piece.opacity, {
          toValue: 0,
          duration: 1200,
          easing: Easing.linear,
          delay: piece.delay,
          useNativeDriver: true,
        }),
      ]);
    });

    Animated.stagger(40, animations).start(() => {
      setConfettiVisible(false);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setShowServedActions(true);
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
      () => {}
    );
  }, [confettiPieces]);

  const handleCardPress = () => {
    if (isExpanded) {
      return;
    }

    if (meal.recipeUrl) {
      Linking.openURL(meal.recipeUrl).catch(() => {
        // Silently ignore for now; could surface toast later.
      });
    }
  };

  const handleToggleServed = () => {
    if (isServed) {
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  };

  const handleSelectAction = async (action: ServedAction["value"]) => {
    if (action !== "served") {
      setLocallyServed(false);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setExpanded(false);
      try {
        await onSelectOutcome?.(action);
      } catch (error) {
        console.warn("[TodayCard] Failed to log outcome", error);
      }
      return;
    }

    const message = celebrationMessage ?? getRandomCelebrationMessage();
    setCelebrationMessage(message);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(false);
    setLocallyServed(true);
    triggerConfetti();
    try {
      await onMarkServed?.(message);
    } catch (error) {
      setLocallyServed(false);
      console.warn("[TodayCard] Failed to mark served", error);
    }
  };
  const toggleServedPanel = (panel: Exclude<typeof servedExpanded, null>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setServedDrawerOpen(true);
    setServedExpanded((prev) => (prev === panel ? null : panel));
  };

  const handleToggleFreezer = () => {
    if (!meal) {
      return;
    }
    if (!inFreezer) {
      setFreezerModalVisible(true);
      return;
    }
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setInFreezer(false);
    updateMeal({
      id: meal.id,
      isFavorite: false,
    });
  };

  const handleFreezerModalClose = () => {
    setFreezerModalVisible(false);
  };

  const handleFreezerModalSave = (
    targetMeal: Meal,
    amount: string,
    unit: string,
    addedAt: string
  ) => {
    if (!targetMeal) {
      return;
    }
    updateMeal({
      id: targetMeal.id,
      isFavorite: true,
      freezerAmount: amount,
      freezerUnit: unit,
      freezerAddedAt: addedAt,
    });
    setInFreezer(true);
    setFreezerModalVisible(false);
  };
  const toggleIconName: keyof typeof MaterialCommunityIcons.glyphMap =
    isExpanded ? "chevron-up" : "chevron-down";

  const mealDetails = (
    <Pressable
      style={styles.touchArea}
      accessibilityRole={meal.recipeUrl ? "button" : "text"}
      accessibilityLabel={
        meal.recipeUrl
          ? `Open recipe for ${meal.title}`
          : `Meal details for ${meal.title}`
      }
      onPress={meal.recipeUrl ? handleCardPress : undefined}
    >
      <View style={styles.topRow}>
        <Text style={styles.date}>{dateLabel}</Text>
        <View style={styles.topRowMeta}>
          {meal.isFavorite ? (
            <View style={styles.freezerBadge}>
              <MaterialCommunityIcons
                name="snowflake"
                size={14}
                color={theme.color.accent}
              />
              <Text style={styles.freezerBadgeText}>Freezer</Text>
            </View>
          ) : meal.recipeUrl ? (
            <View style={styles.recipeTag}>
              <Text style={styles.recipeTagText}>Recipe</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={styles.emoji} accessibilityLabel={`${meal.title} meal`}>
        {meal.emoji}
      </Text>

      <Text style={styles.title}>{meal.title}</Text>
      {sidesLabel ? (
        <Text style={styles.sides}>{`w/ ${sidesLabel}`}</Text>
      ) : null}
      {isEatOut && eatOutMessage ? (
        <Text style={styles.eatOutMessage}>{eatOutMessage}</Text>
      ) : null}
      {prepNotesToShow ? (
        <Text style={styles.notes}>{prepNotesToShow}</Text>
      ) : null}
    </Pressable>
  );

  const renderServedActionButton = (
    icon: string,
    label: string,
    panel: Exclude<typeof servedExpanded, null>
  ) => (
    <Pressable
      key={label}
      onPress={() => toggleServedPanel(panel)}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.servedActionButton,
        servedExpanded === panel && styles.servedActionButtonActive,
        pressed && styles.servedActionButtonPressed,
      ]}
    >
      <MaterialCommunityIcons
        name={icon as any}
        size={20}
        color={
          servedExpanded === panel ? theme.color.ink : theme.color.subtleInk
        }
      />
    </Pressable>
  );

  return (
    <View style={styles.card}>
      {isConfettiVisible ? (
        <View pointerEvents="none" style={styles.confettiLayer}>
          {confettiPieces.map((piece, index) => (
            <Animated.View
              key={index}
              style={[
                styles.confettiPiece,
                {
                  backgroundColor: piece.color,
                  width: piece.size,
                  height: piece.size * 2,
                  left: `${piece.left}%`,
                  transform: [
                    { translateX: piece.translateX },
                    { translateY: piece.translateY },
                    {
                      rotate: piece.rotate.interpolate({
                        inputRange: [-Math.PI, Math.PI],
                        outputRange: ["-180deg", "180deg"],
                      }),
                    },
                  ],
                  opacity: piece.opacity,
                },
              ]}
            />
          ))}
        </View>
      ) : null}
      {isServed ? (
        <>
          <View style={styles.completionGraphic}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={96}
              color={theme.color.accent}
            />
          </View>
      <View style={styles.completionLabelRow}>
        <Text
          style={styles.completionEmoji}
          accessibilityLabel={`${meal.title} meal`}
        >
          {meal.emoji}
        </Text>
        <Text style={styles.completionLabel}>DINNER SERVED</Text>
      </View>
      {celebrationMessage ? (
        <Text style={styles.completionMessage}>{celebrationMessage}</Text>
      ) : null}
          {isEatOut && eatOutMessage ? (
            <Text style={styles.eatOutMessage}>{eatOutMessage}</Text>
          ) : null}
          {showServedActions ? (
            <View style={styles.servedActionRow}>
              {renderServedActionButton("star", "Rate meal", "rating")}
              {renderServedActionButton(
                inFreezer ? "check-circle" : "snowflake",
                inFreezer ? "Added to freezer" : "Add to freezer",
                "freezer"
              )}
              {renderServedActionButton("pencil", "Edit notes", "notes")}
            </View>
          ) : null}
          {isServedDrawerOpen && showServedActions ? (
            <View style={styles.servedDrawer}>
              {servedExpanded === "rating" ? (
                <View style={styles.servedSection}>
                  <Text style={styles.servedSectionLabel}>Rate this meal</Text>
                  <RatingStars
                    value={rating}
                    size={28}
                    gap={theme.space.sm}
                    onChange={setRating}
                  />
                </View>
              ) : null}
              {servedExpanded === "freezer" ? (
                <View style={styles.servedSection}>
                  <Text style={styles.servedSectionLabel}>Freezer</Text>
                  <Pressable
                    style={({ pressed }) => [
                      styles.servedToggleButton,
                      inFreezer && styles.servedToggleButtonActive,
                      pressed && styles.servedToggleButtonPressed,
                    ]}
                    onPress={handleToggleFreezer}
                    accessibilityRole="button"
                    accessibilityLabel="Toggle freezer favorite"
                  >
                    <MaterialCommunityIcons
                      name={inFreezer ? "check" : "plus"}
                      size={18}
                      color={theme.color.ink}
                    />
                    <Text style={styles.servedToggleButtonText}>
                      {inFreezer ? "Added to freezer" : "Add to freezer"}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
              {servedExpanded === "notes" ? (
                <View style={styles.servedSection}>
                  <Text style={styles.servedSectionLabel}>Prep notes</Text>
                  <TextInput
                    style={styles.servedNotesInput}
                    placeholder="Add notes for next time"
                    placeholderTextColor={theme.color.subtleInk}
                    multiline
                    value={notesValue}
                    onChangeText={setNotesValue}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </>
      ) : (
        <>
          {mealDetails}
          <Pressable
            style={({ pressed }) => [
              styles.servedButton,
              pressed && styles.servedButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={servedButtonLabel}
            onPress={handleToggleServed}
          >
            <Text style={styles.servedButtonText}>{servedButtonLabel}</Text>
            <MaterialCommunityIcons
              name={toggleIconName as any}
              size={18}
              color={theme.color.ink}
            />
          </Pressable>

          {isExpanded ? (
            <View style={styles.drawer}>
              {servedActionsForMeal.map((action) => (
                <Pressable
                  key={action.label}
                  style={({ pressed }) => [
                    styles.drawerButton,
                    pressed && styles.drawerButtonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={action.label}
                  onPress={() => handleSelectAction(action.value)}
                >
                  <MaterialCommunityIcons
                    name={action.icon}
                    size={18}
                    color={theme.color.ink}
                  />
                  <Text style={styles.drawerButtonText}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </>
      )}
      <FreezerAmountModal
        visible={isFreezerModalVisible}
        initialMeal={meal}
        initialAmount={meal?.freezerAmount ?? meal?.freezerQuantity ?? ""}
        initialUnit={meal?.freezerUnit}
        initialAddedAt={meal?.freezerAddedAt}
        onDismiss={handleFreezerModalClose}
        onComplete={handleFreezerModalSave}
      />
    </View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.lg,
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space.lg,
      paddingBottom: theme.space.lg,
      gap: theme.space.lg,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
      overflow: "hidden",
      position: "relative",
    },
    confettiLayer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflow: "hidden",
    },
    confettiPiece: {
      position: "absolute",
      borderRadius: 2,
    },
    touchArea: {
      alignItems: "center",
      gap: theme.space.sm,
    },
    topRow: {
      width: "100%",
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    date: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    recipeTag: {
      paddingHorizontal: theme.space.sm,
      paddingVertical: theme.space.xs,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
    },
    recipeTagText: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    topRowMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs,
    },
    freezerBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: theme.space.xs,
      paddingVertical: 2,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    freezerBadgeText: {
      color: theme.color.accent,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    emoji: {
      fontSize: 48,
    },
    title: {
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    sides: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      textAlign: "center",
    },
    eatOutMessage: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      textAlign: "center",
    },
    notes: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      textAlign: "center",
    },
    completionGraphic: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: theme.space.lg,
    },
    completionLabelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.sm,
    },
    completionEmoji: {
      fontSize: 20,
    },
    completionLabel: {
      textAlign: "center",
      color: theme.color.accent,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
      letterSpacing: 0.5,
    },
    completionMessage: {
      textAlign: "center",
      color: theme.color.ink,
      fontSize: theme.type.size.sm + 4,
    },
    servedActionRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.lg,
      alignSelf: "center",
      width: "100%",
    },
    servedActionButton: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
    },
    servedActionButtonActive: {
      backgroundColor: theme.color.accent,
      borderColor: theme.color.accent,
    },
    servedActionButtonPressed: {
      opacity: 0.9,
    },
    servedDrawer: {
      paddingVertical: theme.space.md,
      paddingHorizontal: theme.space.xs,
      gap: theme.space.md,
    },
    servedSection: {
      gap: theme.space.sm,
    },
    servedSectionLabel: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    servedToggleButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      paddingVertical: theme.space.sm,
      paddingHorizontal: theme.space.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
    },
    servedToggleButtonActive: {
      backgroundColor: theme.color.success,
    },
    servedToggleButtonPressed: {
      opacity: 0.9,
    },
    servedToggleButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
    servedNotesInput: {
      minHeight: 80,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.border,
      backgroundColor: theme.color.surfaceAlt,
      padding: theme.space.md,
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      textAlignVertical: "top",
    },
    servedButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.space.sm,
      backgroundColor: theme.color.success,
      borderRadius: theme.radius.xl,
      paddingVertical: theme.space.md,
    },
    servedButtonPressed: {
      opacity: 0.85,
    },
    servedButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    drawer: {
      gap: theme.space.sm,
    },
    drawerButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.sm,
      paddingVertical: theme.space.sm,
      paddingHorizontal: theme.space.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.color.surfaceAlt,
    },
    drawerButtonPressed: {
      opacity: 0.9,
    },
    drawerButtonText: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
    },
  });
