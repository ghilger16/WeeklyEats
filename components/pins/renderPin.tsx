import { MaterialCommunityIcons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import type { MealSortBadgeType, MealSortDirection } from "./types";
import { WeeklyTheme } from "../../styles/theme";

export type PinIndicatorVariant =
  | "difficulty"
  | "expense"
  | "reuse"
  | "family"
  | "freezer";

type SortPinConfig = {
  context: "sort";
  badgeType?: MealSortBadgeType;
  direction: MealSortDirection;
  size?: "badge" | "menu";
  color: string;
  theme: WeeklyTheme;
};

type PinConfig = {
  context: "pin";
  variant: PinIndicatorVariant;
  theme: WeeklyTheme;
  levels?: Array<"easy" | "medium" | "hard">;
  value?: string;
  showLabel?: boolean;
};

export type RenderPinConfig = SortPinConfig | PinConfig;

export const renderPin = (config: RenderPinConfig) => {
  if (config.context === "sort") {
    return renderSortPin(config);
  }
  return renderBoardPin(config);
};

const renderSortPin = ({
  badgeType,
  direction,
  size = "badge",
  color,
  theme,
}: SortPinConfig) => {
  if (badgeType === "difficulty") {
    const difficultyColors: Record<MealSortDirection, string> = {
      easy: theme.color.success,
      medium: theme.color.warning,
      hard: theme.color.danger,
      asc: theme.color.success,
      desc: theme.color.danger,
      cheap: theme.color.success,
      mediumCost: theme.color.warning,
      expensive: theme.color.danger,
    };
    const dotSize = size === "badge" ? 10 : 12;
    return (
      <View
        style={[
          styles.difficultyDot,
          {
            width: dotSize,
            height: dotSize,
            backgroundColor: difficultyColors[direction] ?? theme.color.success,
          },
        ]}
      />
    );
  }

  if (badgeType === "expense") {
    const costLabels: Record<MealSortDirection, string> = {
      cheap: "$",
      mediumCost: "$$",
      expensive: "$$$",
      asc: "$",
      desc: "$$$",
      easy: "$",
      medium: "$$",
      hard: "$$$",
    };
    const label = costLabels[direction] ?? "$";
    return (
      <Text
        style={[
          styles.expenseBadgeText,
          size === "menu" ? styles.expenseBadgeTextMenu : null,
          { color: theme.color.success },
        ]}
      >
        {label}
      </Text>
    );
  }

  return (
    <MaterialCommunityIcons
      name={direction === "asc" ? "arrow-up" : "arrow-down"}
      size={size === "badge" ? 16 : 18}
      color={color}
    />
  );
};

const renderBoardPin = ({ variant, theme, levels, value }: PinConfig) => {
  switch (variant) {
    case "difficulty": {
      const order = levels ?? ["easy", "medium", "hard"];
      const colorMap = {
        easy: theme.color.success,
        medium: theme.color.warning,
        hard: theme.color.danger,
      } as const;
      return (
        <View style={styles.inventoryIndicatorRow}>
          {order.map((level) => (
            <View
              key={`${variant}-${level}`}
              style={[
                styles.inventoryDot,
                { backgroundColor: colorMap[level] },
              ]}
            />
          ))}
        </View>
      );
    }
    case "expense": {
      const label = value ?? "$$$";
      return (
        <Text
          style={[
            styles.inventoryIndicatorLabel,
            { color: theme.color.success },
          ]}
        >
          {label}
        </Text>
      );
    }
    case "reuse": {
      const label = value ?? "1-4W";
      return (
        <Text
          style={[styles.inventoryIndicatorLabel, { color: theme.color.link }]}
        >
          {label}
        </Text>
      );
    }
    case "family":
      return <Text style={styles.inventoryIndicatorLabel}>⭐</Text>;
    case "freezer":
      return (
        <View style={styles.inventoryIndicatorRow}>
          <MaterialCommunityIcons
            name="snowflake"
            size={16}
            color={theme.color.accent}
          />
        </View>
      );
    default:
      return null;
  }
};

const styles = StyleSheet.create({
  difficultyDot: {
    borderRadius: 999,
  },
  expenseBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  expenseBadgeTextMenu: {
    fontSize: 14,
  },
  inventoryIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  inventoryDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  inventoryIndicatorLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
});
