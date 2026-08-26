import { Animated, StyleSheet } from "react-native";

const SPARKLES = [
  { x: -72, y: -34, color: "#FF4D8D" },
  { x: -48, y: -66, color: "#FEC107" },
  { x: -18, y: -76, color: "#FF8AB5" },
  { x: 26, y: -70, color: "#FEC107" },
  { x: 65, y: -42, color: "#FF4D8D" },
  { x: 72, y: 2, color: "#FEC107" },
  { x: -70, y: 8, color: "#FF8AB5" },
  { x: 42, y: 22, color: "#FF4D8D" },
] as const;

type BurstSparklesProps = {
  progress: Animated.Value;
  visible: boolean;
  originYOffset?: number;
  particleCount?: number;
  distanceScale?: number;
  particleSize?: number;
};

export default function BurstSparkles({
  progress,
  visible,
  originYOffset = 35,
  particleCount = SPARKLES.length,
  distanceScale = 1,
  particleSize = 8,
}: BurstSparklesProps) {
  if (!visible) return null;

  return (
    <>
      {SPARKLES.slice(0, particleCount).map((sparkle, index) => (
        <Animated.View
          key={`burst-sparkle-${index}`}
          pointerEvents="none"
          style={[
            styles.sparkle,
            {
              width: particleSize,
              height: particleSize,
              marginLeft: -particleSize / 2,
              marginTop: -particleSize / 2,
              borderRadius: particleSize / 2,
              backgroundColor: sparkle.color,
              opacity: progress.interpolate({
                inputRange: [0, 0.2, 1],
                outputRange: [0, 1, 0],
              }),
              transform: [
                {
                  translateX: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, sparkle.x * distanceScale],
                  }),
                },
                {
                  translateY: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: [
                      originYOffset,
                      sparkle.y * distanceScale + originYOffset,
                    ],
                  }),
                },
                {
                  scale: progress.interpolate({
                    inputRange: [0, 0.3, 1],
                    outputRange: [0.4, 1, 0.3],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  sparkle: {
    position: "absolute",
    left: "50%",
    top: "50%",
  },
});
