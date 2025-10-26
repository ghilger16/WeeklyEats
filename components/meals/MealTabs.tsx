import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { darkTheme } from "../../styles/theme";

export type MealTabKey = "meals" | "favorites";

const tabs: Array<{ key: MealTabKey; label: string }> = [
  { key: "meals", label: "Meals" },
  { key: "favorites", label: "Favorites" },
];

type TabLayout = {
  x: number;
  width: number;
};

type Props = {
  activeTab: MealTabKey;
  onChange: (tab: MealTabKey) => void;
};

const theme = darkTheme;

const MealTabs = ({ activeTab, onChange }: Props) => {
  const [layouts, setLayouts] = useState<Record<MealTabKey, TabLayout>>({
    meals: { x: 0, width: 0 },
    favorites: { x: 0, width: 0 },
  });
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;

  const animateIndicator = useCallback(
    (layout: TabLayout) => {
      Animated.parallel([
        Animated.timing(indicatorX, {
          toValue: layout.x,
          duration: theme.motion.duration.normal,
          easing: Easing.bezier(0, 0, 0.2, 1),
          useNativeDriver: false,
        }),
        Animated.timing(indicatorWidth, {
          toValue: layout.width,
          duration: theme.motion.duration.normal,
          easing: Easing.bezier(0, 0, 0.2, 1),
          useNativeDriver: false,
        }),
      ]).start();
    },
    [indicatorWidth, indicatorX]
  );

  useEffect(() => {
    const layout = layouts[activeTab];
    if (layout) {
      animateIndicator(layout);
    }
  }, [activeTab, animateIndicator, layouts]);

  const onTabLayout = useCallback(
    (tab: MealTabKey) =>
      (event: Parameters<NonNullable<View["props"]["onLayout"]>>[0]) => {
        const { x, width } = event.nativeEvent.layout;
        setLayouts((prev) => {
          const current = prev[tab];
          if (current && current.x === x && current.width === width) {
            return prev;
          }
          const next = { ...prev, [tab]: { x, width } };
          return next;
        });
      },
    []
  );

  const indicatorStyle = useMemo(
    () => [
      styles.indicator,
      {
        left: indicatorX,
        width: indicatorWidth,
      },
    ],
    [indicatorWidth, indicatorX]
  );

  return (
    <View style={styles.container}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.key}
          onPress={() => onChange(tab.key)}
          onLayout={onTabLayout(tab.key)}
          hitSlop={theme.space.sm}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === tab.key }}
          style={({ pressed }) => [
            styles.tabButton,
            pressed && styles.tabButtonPressed,
          ]}
        >
          <Text
            style={[
              styles.tabLabel,
              activeTab === tab.key && styles.tabLabelActive,
            ]}
          >
            {tab.label}
          </Text>
        </Pressable>
      ))}
      <Animated.View style={indicatorStyle} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    position: "relative",
  },
  tabButton: {
    paddingBottom: theme.space.sm,
    marginRight: theme.space.lg,
  },
  tabButtonPressed: {
    opacity: 0.8,
  },
  tabLabel: {
    fontSize: theme.type.size.base,
    color: theme.color.subtleInk,
    fontWeight: theme.type.weight.medium,
  },
  tabLabelActive: {
    color: theme.color.ink,
  },
  indicator: {
    position: "absolute",
    height: theme.component.tabs.underlineHeight,
    backgroundColor: theme.color.accent,
    bottom: 0,
    borderRadius: theme.radius.full,
  },
});

export default MealTabs;
