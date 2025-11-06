import { useKeyboardHandler } from "react-native-keyboard-controller";
import { useSharedValue, withTiming } from "react-native-reanimated";

export const useGradualAnimation = (paddingBottom: number) => {
  const kbHeightSV = useSharedValue(paddingBottom);

  useKeyboardHandler(
    {
      onMove: (e) => {
        "worklet";
        const h = typeof e.height === "number" ? e.height : 0;
        kbHeightSV.value = Math.max(h, paddingBottom);
      },
      onEnd: (e) => {
        "worklet";
        const h = typeof e.height === "number" ? e.height : 0;
        // smooth settle to the final height
        kbHeightSV.value = withTiming(Math.max(h, paddingBottom), {
          duration: 120,
        });
      },
    },
    []
  );

  return kbHeightSV;
};
