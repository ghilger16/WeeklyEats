import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, ViewStyle } from "react-native";

export type PlanDayOptionsEntranceArgs = {
  optionsCount: number;
  baseDelayMs?: number;
  staggerMs?: number;
  durationMs?: number;
};

type AnimatedOptionStyle = Animated.WithAnimatedValue<ViewStyle>;

type UsePlanDayOptionsEntranceResult = {
  animatedStyles: AnimatedOptionStyle[];
  isAnimating: boolean;
  animateIn: () => void;
};

const DEFAULT_BASE_DELAY = 150;
const DEFAULT_STAGGER = 80;
const DEFAULT_DURATION = 240;

const createAnimatedValueArray = (length: number, prev: Animated.Value[]) => {
  return Array.from({ length }, (_, index) => prev[index] ?? new Animated.Value(0));
};

const usePlanDayOptionsEntrance = (
  optionsCount: number,
  baseDelayMs = DEFAULT_BASE_DELAY,
  staggerMs = DEFAULT_STAGGER,
  durationMs = DEFAULT_DURATION
): UsePlanDayOptionsEntranceResult => {
  const valuesRef = useRef<Animated.Value[]>([]);
  const [isAnimating, setAnimating] = useState(false);

  if (valuesRef.current.length !== optionsCount) {
    valuesRef.current = createAnimatedValueArray(optionsCount, valuesRef.current);
  }

  const animateIn = useCallback(() => {
    const animatedValues = valuesRef.current;
    if (!animatedValues.length) {
      return;
    }
    setAnimating(true);
    const animations = animatedValues.map((value, index) =>
      Animated.timing(value, {
        toValue: 1,
        duration: durationMs,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        delay: baseDelayMs + index * staggerMs,
        useNativeDriver: true,
      })
    );
    Animated.parallel(animations, { stopTogether: true }).start(() => {
      setAnimating(false);
    });
  }, [baseDelayMs, durationMs, staggerMs]);

  useEffect(() => {
    animateIn();
  }, [animateIn]);

  const animatedStyles = useMemo<AnimatedOptionStyle[]>(
    () =>
      valuesRef.current.map((value) => ({
        opacity: value,
        transform: [
          {
            translateY: value.interpolate({
              inputRange: [0, 1],
              outputRange: [24, 0],
            }),
          },
        ],
      })),
    [optionsCount]
  );

  return {
    animatedStyles,
    isAnimating,
    animateIn,
  };
};

export default usePlanDayOptionsEntrance;
