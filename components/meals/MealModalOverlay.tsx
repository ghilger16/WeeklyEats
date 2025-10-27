import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import MealCard from "./MealCard";
import {
  Meal,
  MealDraft,
  createEmptyMealDraft,
} from "../../types/meals";

type Props = {
  visible: boolean;
  mode: "create" | "edit";
  meal?: Meal | null;
  onDismiss: () => void;
  onCreateMeal: (draft: MealDraft) => void;
  onUpdateMeal: (meal: Meal) => void;
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function MealModalOverlay({
  visible,
  mode,
  meal,
  onDismiss,
  onCreateMeal,
  onUpdateMeal,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const enterDuration = theme.motion.duration.slow;
  const exitDuration = theme.motion.duration.normal;
  const translateX = useRef(new Animated.Value(SCREEN_WIDTH)).current;
  const [rendered, setRendered] = useState(visible);
  const closingRef = useRef(false);

  const animateTo = useMemo(
    () => (toValue: number, duration: number, easing: (value: number) => number, cb?: () => void) =>
      Animated.timing(translateX, {
        toValue,
        duration,
        easing,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && cb) cb();
      }),
    [translateX]
  );

  const dismiss = useMemo(
    () => () => {
      if (closingRef.current) return;
      closingRef.current = true;
      animateTo(
        SCREEN_WIDTH,
        exitDuration,
        Easing.bezier(0.4, 0, 1, 1),
        () => {
          closingRef.current = false;
          setRendered(false);
          onDismiss();
        }
      );
    },
    [animateTo, exitDuration, onDismiss]
  );

  useEffect(() => {
    if (visible) {
      setRendered(true);
      closingRef.current = false;
      translateX.setValue(SCREEN_WIDTH);
      animateTo(0, enterDuration, Easing.bezier(0, 0, 0.2, 1));
      return;
    }

    if (rendered) {
      closingRef.current = true;
      animateTo(
        SCREEN_WIDTH,
        exitDuration,
        Easing.bezier(0.4, 0, 1, 1),
        () => {
          closingRef.current = false;
          setRendered(false);
        }
      );
    }
  }, [animateTo, enterDuration, exitDuration, rendered, translateX, visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dx > 10 && Math.abs(gesture.dy) < 40,
        onPanResponderMove: (_, gesture) => {
          if (gesture.dx > 0) {
            translateX.setValue(gesture.dx);
          }
        },
        onPanResponderRelease: (_, gesture) => {
          const shouldDismiss =
            gesture.dx > SCREEN_WIDTH * 0.3 || gesture.vx > 0.75;
          if (shouldDismiss) {
            dismiss();
          } else {
            animateTo(0, exitDuration, Easing.bezier(0, 0, 0.2, 1));
          }
        },
        onPanResponderTerminate: () => {
          animateTo(0, exitDuration, Easing.bezier(0, 0, 0.2, 1));
        },
      }),
    [animateTo, dismiss, exitDuration, translateX]
  );

  const initialMeal = useMemo(() => {
    if (mode === "edit" && meal) {
      return { ...meal };
    }

    return createEmptyMealDraft();
  }, [meal, mode]);

  if (!rendered) {
    return null;
  }

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        styles.overlay,
        { transform: [{ translateX }] },
      ]}
      pointerEvents="auto"
      {...panResponder.panHandlers}
    >
      <SafeAreaView
        edges={["top", "bottom", "left", "right"]}
        style={styles.safeArea}
      >
        <MealCard
          mode={mode}
          initialMeal={initialMeal}
          onClose={dismiss}
          onCreateMeal={onCreateMeal}
          onUpdateMeal={onUpdateMeal}
        />
      </SafeAreaView>
    </Animated.View>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    overlay: {
      backgroundColor: theme.color.bg,
      zIndex: 1000,
    },
    safeArea: {
      flex: 1,
      backgroundColor: theme.color.bg,
    },
  });
