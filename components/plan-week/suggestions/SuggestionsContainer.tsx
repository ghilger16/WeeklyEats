import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ComponentRef } from "react";
import { Meal } from "../../../types/meals";
import { PlannedWeekDayKey } from "../../../types/weekPlan";
import { useThemeController } from "../../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../../styles/theme";
import { DayPinsState, normalizeDayPinsState } from "../../../types/dayPins";
import PinBoard from "../PinBoard";
import PinInventory, {
  InventoryPinId,
  isInventoryPinActive,
} from "../pins/PinInventory";
import {
  SuggestionBannerContext,
  getSuggestionBanner,
} from "./suggestionBanners";
import SuggestionsTab from "./SuggestionsTab";

type DifficultyKey = "easy" | "medium" | "hard";

type Props = {
  dayKey: PlannedWeekDayKey;
  meal?: Meal;
  suggestionContext?: SuggestionBannerContext;
  plannedMeal?: Meal;
  onAdd: () => void;
  onShuffle: () => void;
  pins: DayPinsState;
  onPinsChange: (next: DayPinsState) => void;
  hideContent?: boolean;
  showPlannedCard?: boolean;
  sides: string[];
  onAddSide: (value: string) => void;
  onRemoveSide: (index: number) => void;
};

const difficultyToLabel: Record<DifficultyKey, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
};

const getDifficultyLabel = (value: number | undefined): DifficultyKey => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "medium";
  }
  if (value <= 2) return "easy";
  if (value >= 4) return "hard";
  return "medium";
};

const formatLastServed = (iso?: string) => {
  if (!iso) return "Never served";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "Never served";
  }
  return `Last served: ${date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  })}`;
};

const BANNER_FADE_IN_MS = 140;
const BANNER_FADE_OUT_MS = 120;

export default function SuggestionsContainer({
  dayKey,
  meal,
  suggestionContext,
  plannedMeal,
  onAdd,
  onShuffle,
  pins,
  onPinsChange,
  hideContent = false,
  showPlannedCard = false,
  sides,
  onAddSide,
  onRemoveSide,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [isSwapping, setIsSwapping] = useState(false);
  const bannerOpacity = useRef(new Animated.Value(0)).current;
  const mealTitleRef = useRef<ComponentRef<typeof Text> | null>(null);
  const lastMealIdRef = useRef<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [bannerContext, setBannerContext] =
    useState<SuggestionBannerContext>("general");
  const [sideInput, setSideInput] = useState("");
  const [isSideDeleteMode, setSideDeleteMode] = useState(false);
  const [isInventoryVisible, setInventoryVisible] = useState(false);
  const [inventoryPulseTrigger, setInventoryPulseTrigger] = useState<{
    id: string;
    nonce: number;
  } | null>(null);

  const mealDifficulty = meal ? getDifficultyLabel(meal.difficulty) : null;
  const ratingLabel = meal && meal.rating ? meal.rating.toFixed(1) : "--";
  const costTier = meal?.expense
    ? Math.max(1, Math.min(3, Math.round(meal.expense / 2)))
    : meal?.plannedCostTier ?? 1;
  const costLabel = meal ? "$".repeat(costTier) : "--";

  const plannedCostTier = plannedMeal?.expense
    ? Math.max(1, Math.min(3, Math.round(plannedMeal.expense / 2)))
    : plannedMeal?.plannedCostTier ?? 1;
  const plannedCostLabel = plannedMeal ? "$".repeat(plannedCostTier) : null;
  const plannedDifficulty = plannedMeal
    ? getDifficultyLabel(plannedMeal.difficulty)
    : null;
  const plannedDifficultyText = plannedDifficulty
    ? difficultyToLabel[plannedDifficulty]
    : null;
  const plannedLastServed = plannedMeal
    ? formatLastServed(plannedMeal.updatedAt)
    : null;
  const plannedDifficultyColor = plannedDifficulty
    ? theme.color[difficultyToThemeColor(plannedDifficulty)]
    : undefined;
  const lastServedLabel = formatLastServed(meal?.updatedAt);
  const hasPlannedMeal = Boolean(plannedMeal);

  const hideBanner = useCallback(
    (animate = true) => {
      if (!bannerMessage) {
        bannerOpacity.setValue(0);
        setBannerMessage(null);
        return;
      }
      if (!animate) {
        bannerOpacity.setValue(0);
        setBannerMessage(null);
        return;
      }
      Animated.timing(bannerOpacity, {
        toValue: 0,
        duration: BANNER_FADE_OUT_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setBannerMessage(null);
        }
      });
    },
    [bannerMessage, bannerOpacity]
  );

  const displayBanner = useCallback(
    (message: string, context: SuggestionBannerContext) => {
      setBannerContext(context);
      setBannerMessage(message);
      Haptics.selectionAsync().catch(() => {});
      Animated.timing(bannerOpacity, {
        toValue: 1,
        duration: BANNER_FADE_IN_MS,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
    },
    [bannerOpacity]
  );

  const showBannerMessage = useCallback(
    (context: SuggestionBannerContext) => {
      const { message } = getSuggestionBanner({ context });
      if (bannerMessage) {
        Animated.timing(bannerOpacity, {
          toValue: 0,
          duration: BANNER_FADE_OUT_MS,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }).start(() => {
          displayBanner(message, context);
        });
        return;
      }
      displayBanner(message, context);
    },
    [bannerMessage, bannerOpacity, displayBanner]
  );

  const resolveBannerContext = useCallback((): SuggestionBannerContext => {
    if (suggestionContext) {
      return suggestionContext;
    }
    if (
      pins.freezerNight ||
      Boolean(meal?.freezerQuantity) ||
      Boolean(meal?.freezerAmount)
    ) {
      return "freezer";
    }
    if (pins.familyStar === "include" || meal?.isFavorite) {
      return "favorite";
    }
    if (pins.reuseWeeks) {
      return "reuse";
    }
    if (pins.effort) {
      return "difficulty";
    }
    return "general";
  }, [meal, pins, suggestionContext]);

  const formatSideLabel = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return "";
    }
    return trimmed
      .split(/\s+/)
      .map(
        (segment) =>
          segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase()
      )
      .join(" ");
  }, []);

  const handleSubmitSide = useCallback(() => {
    const formatted = formatSideLabel(sideInput);
    if (!formatted) {
      setSideInput("");
      return;
    }
    onAddSide(formatted);
    setSideInput("");
  }, [formatSideLabel, onAddSide, sideInput]);

  const toggleSideDeleteMode = useCallback(() => {
    setSideDeleteMode((prev) => !prev);
  }, []);

  const handleToggleInventory = useCallback(() => {
    setInventoryVisible((prev) => !prev);
  }, []);

  const handleAddInventoryPin = useCallback(
    (pin: InventoryPinId) => {
      if (isInventoryPinActive(pin, pins)) {
        setInventoryVisible(false);
        return;
      }
      Haptics.selectionAsync().catch(() => {});
      const next = normalizeDayPinsState(pins);
      let pulseId: string | null = null;
      switch (pin) {
        case "difficulty":
          next.effort = "easy";
          pulseId = "effort";
          break;
        case "expense":
          next.expense = "$";
          pulseId = "expense";
          break;
        case "reuse":
          next.reuseWeeks = 1;
          pulseId = "reuse";
          break;
        case "family":
          next.familyStar = "include";
          pulseId = "family-star";
          break;
        case "freezer":
          next.freezerNight = true;
          pulseId = "freezer";
          break;
        default:
          break;
      }
      onPinsChange(next);
      if (pulseId) {
        setInventoryPulseTrigger({ id: pulseId, nonce: Date.now() });
      }
      setInventoryVisible(false);
    },
    [onPinsChange, pins]
  );

  useEffect(() => {
    if (!meal || !meal.id) {
      return;
    }
    if (lastMealIdRef.current === meal.id) {
      return;
    }
    lastMealIdRef.current = meal.id;
    showBannerMessage(resolveBannerContext());
  }, [meal, resolveBannerContext, showBannerMessage]);

  useEffect(() => {
    if (!meal) {
      lastMealIdRef.current = null;
      hideBanner(false);
    }
  }, [hideBanner, meal]);

  useEffect(() => {
    if (!hasPlannedMeal) {
      setIsSwapping(false);
    }
  }, [hasPlannedMeal]);

  useEffect(() => {
    if (hasPlannedMeal) {
      setIsSwapping(false);
    }
  }, [plannedMeal?.id, hasPlannedMeal]);

  useEffect(() => {
    if (!inventoryPulseTrigger) {
      return;
    }
    const timeout = setTimeout(() => setInventoryPulseTrigger(null), 0);
    return () => clearTimeout(timeout);
  }, [inventoryPulseTrigger]);

  if (hideContent) {
    return null;
  }

  const shouldShowPlanned =
    showPlannedCard && hasPlannedMeal && !isSwapping && !isInventoryVisible;

  const showBanner = !isInventoryVisible;

  let content: ReactNode = null;
  if (isInventoryVisible) {
    content = (
      <View style={styles.inventoryWrapper}>
        <PinInventory value={pins} onAdd={handleAddInventoryPin} />
      </View>
    );
  } else if (shouldShowPlanned) {
    content = (
      <View style={styles.plannedCardWrapper}>
        <View style={styles.plannedCard}>
          <Pressable
            onPress={() => {
              setInventoryVisible(false);
              setIsSwapping(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Change meal"
            style={({ pressed }) => [
              styles.plannedSwapButton,
              pressed && styles.plannedSwapButtonPressed,
            ]}
          >
            <MaterialCommunityIcons
              name="swap-horizontal"
              size={20}
              color="#FFE6C7"
            />
          </Pressable>
          <View style={styles.plannedBadge}>
            <Text style={styles.plannedBadgeText}>DAY PLANNED</Text>
          </View>
          <Text style={styles.plannedEmoji}>{plannedMeal?.emoji ?? "🍽️"}</Text>
          <View style={styles.plannedMetaRow}>
            {plannedCostLabel ? (
              <Text style={[styles.plannedMetaText, styles.plannedMetaAccent]}>
                {plannedCostLabel}
              </Text>
            ) : null}
            {plannedDifficultyText ? (
              <View style={styles.plannedDifficultyMeta}>
                <View
                  style={[
                    styles.plannedDifficultyDot,
                    plannedDifficultyColor
                      ? { backgroundColor: plannedDifficultyColor }
                      : null,
                  ]}
                />
                <Text style={styles.plannedMetaText}>
                  {plannedDifficultyText}
                </Text>
              </View>
            ) : null}
          </View>
          {plannedLastServed ? (
            <Text style={styles.plannedLastServed}>{plannedLastServed}</Text>
          ) : null}
          <Text style={styles.plannedTitle}>
            {plannedMeal?.title ?? "Meal planned"}
          </Text>
          {sides.length ? (
            <View style={styles.plannedSideList}>
              {sides.map((side, index) => (
                <View style={styles.plannedSideChip} key={`${side}-${index}`}>
                  <Text style={styles.plannedSideText}>w/ {side}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    );
  } else {
    content = (
      <SuggestionsTab
        meal={meal}
        bannerMessage={showBanner ? bannerMessage : null}
        bannerOpacity={bannerOpacity}
        ratingLabel={ratingLabel}
        costLabel={costLabel}
        mealDifficulty={mealDifficulty}
        lastServedLabel={lastServedLabel}
        sides={sides}
        sideInput={sideInput}
        isSideDeleteMode={isSideDeleteMode}
        onChangeSideInput={(value) => {
          setSideInput(value);
          if (value.trim()) {
            setBannerMessage(null);
          }
        }}
        onFocusSideInput={() => {
          if (bannerMessage) {
            setBannerMessage(null);
          }
        }}
        onSubmitSide={handleSubmitSide}
        onToggleSideDeleteMode={toggleSideDeleteMode}
        onRemoveSide={onRemoveSide}
        onAdd={onAdd}
        onShuffle={onShuffle}
        mealTitleRef={mealTitleRef}
      />
    );
  }

  return (
    <View style={styles.container}>
      <PinBoard
        value={pins}
        onChange={onPinsChange}
        dayKey={dayKey}
        onRequestInventory={handleToggleInventory}
        pulseChipTrigger={inventoryPulseTrigger}
        isInventoryOpen={isInventoryVisible}
      />
      {content}
    </View>
  );
}

const difficultyToThemeColor = (difficulty: DifficultyKey) => {
  switch (difficulty) {
    case "easy":
      return "success" as const;
    case "hard":
      return "danger" as const;
    default:
      return "warning" as const;
  }
};

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    container: {
      gap: theme.space.lg,
    },
    plannedCardWrapper: {
      width: "100%",
      position: "relative",
    },
    plannedCard: {
      borderRadius: theme.radius.xl,
      backgroundColor: theme.color.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.color.cardOutline,
      padding: theme.space.lg,
      alignItems: "center",
      gap: theme.space.sm,
    },
    plannedBadge: {
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.xs / 1.5,
      borderRadius: theme.radius.full,
      backgroundColor: "#C37D1D",
    },
    plannedBadgeText: {
      color: "#FFE6C7",
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.bold,
      letterSpacing: 1,
    },
    plannedEmoji: {
      fontSize: 72,
    },
    plannedMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.md,
    },
    plannedMetaText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    plannedMetaAccent: {
      color: theme.color.accent,
    },
    plannedDifficultyMeta: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.space.xs / 2,
    },
    plannedDifficultyDot: {
      width: 8,
      height: 8,
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.warning,
    },
    plannedLastServed: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
    },
    plannedTitle: {
      color: theme.color.ink,
      fontSize: theme.type.size.h2,
      fontWeight: theme.type.weight.bold,
      textAlign: "center",
    },
    plannedSideList: {
      gap: theme.space.xs,
      alignItems: "center",
    },
    plannedSideChip: {
      borderRadius: theme.radius.full,
      backgroundColor: theme.color.surfaceAlt,
      paddingHorizontal: theme.space.md,
      paddingVertical: theme.space.xs,
    },
    plannedSideText: {
      color: theme.color.ink,
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.medium,
    },
    plannedSwapButton: {
      position: "absolute",
      top: theme.space.sm,
      right: theme.space.sm,
      padding: theme.space.sm,
      borderRadius: theme.radius.full,
      backgroundColor: "rgba(0,0,0,0.25)",
    },
    plannedSwapButtonPressed: {
      opacity: 0.8,
    },
    inventoryWrapper: {
      gap: theme.space.md,
    },
  });
