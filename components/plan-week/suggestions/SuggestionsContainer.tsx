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
  sides: string[];
  onAddSide: (value: string) => void;
  onRemoveSide: (index: number) => void;
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
  sides,
  onAddSide,
  onRemoveSide,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
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
    if (!sides.length) {
      return;
    }
    setSideDeleteMode((prev) => !prev);
  }, [sides.length]);

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
      setInventoryVisible(false);
    }
  }, [hasPlannedMeal]);

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

  const showBanner = !isInventoryVisible;

  let content: ReactNode = null;
  if (isInventoryVisible) {
    content = (
      <View style={styles.inventoryWrapper}>
        <PinInventory value={pins} onAdd={handleAddInventoryPin} />
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
    inventoryWrapper: {
      gap: theme.space.md,
    },
  });
