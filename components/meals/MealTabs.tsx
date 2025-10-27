import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { FlexGrid } from "../../styles/flex-grid";

export type MealTabKey = "all" | "favorites";

const tabs: Array<{ key: MealTabKey; label: string }> = [
  { key: "all", label: "All" },
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

const MealTabs = ({ activeTab, onChange }: Props) => {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const animationDuration = theme.motion.duration.normal;
  const [layouts, setLayouts] = useState<Record<MealTabKey, TabLayout>>({
    all: { x: 0, width: 0 },
    favorites: { x: 0, width: 0 },
  });
  const indicatorX = useRef(new Animated.Value(0)).current;
  const indicatorWidth = useRef(new Animated.Value(0)).current;

  const animateIndicator = useCallback(
    (layout: TabLayout) => {
      Animated.parallel([
        Animated.timing(indicatorX, {
          toValue: layout.x,
          duration: animationDuration,
          easing: Easing.bezier(0, 0, 0.2, 1),
          useNativeDriver: false,
        }),
        Animated.timing(indicatorWidth, {
          toValue: layout.width,
          duration: animationDuration,
          easing: Easing.bezier(0, 0, 0.2, 1),
          useNativeDriver: false,
        }),
      ]).start();
    },
    [animationDuration, indicatorWidth, indicatorX]
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
    <FlexGrid>
      <FlexGrid.Row>
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
            <Text style={styles.tabLabel}>{tab.label}</Text>
          </Pressable>
        ))}
        <View style={styles.underline} />
        <Animated.View style={indicatorStyle} />
      </FlexGrid.Row>
    </FlexGrid>
  );
};

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    tabButton: {
      paddingBottom: theme.space.lg,
      marginLeft: theme.space.lg,
    },
    tabButtonPressed: {
      opacity: 0.8,
    },
    tabLabel: {
      fontSize: theme.type.size.title,
      color: theme.color.ink,
      fontWeight: theme.type.weight.medium,
    },
    indicator: {
      position: "absolute",
      height: theme.component.tabs.underlineHeight,
      backgroundColor: theme.color.accent,
      bottom: 0,
      borderRadius: theme.radius.full,
      zIndex: 1,
    },
    underline: {
      position: "absolute",
      left: theme.space.lg,
      right: theme.space.lg,
      bottom: 0,
      height: theme.component.tabs.underlineHeight,
      backgroundColor: theme.color.cardOutline,
      borderRadius: theme.radius.full,
      zIndex: 0,
    },
  });

export default MealTabs;
