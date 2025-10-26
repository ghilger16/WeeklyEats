import { MaterialCommunityIcons } from "@expo/vector-icons";
import { memo } from "react";
import { useThemeController } from "../../providers/theme/ThemeController";
import { FlexGrid } from "../../styles/flex-grid";

type Props = {
  value: number;
  size?: number;
};

const RatingStars = memo(function RatingStars({ value, size = 18 }: Props) {
  const { theme } = useThemeController();
  return (
    <FlexGrid
      gutterWidth={theme.space.xs}
      accessibilityRole="image"
      accessible
      pointerEvents="none"
    >
      <FlexGrid.Row alignItems="center" wrap={false}>
        {Array.from({ length: 5 }).map((_, index) => {
          const filled = index < value;
          return (
            <MaterialCommunityIcons
              key={index}
              name={filled ? "star" : "star-outline"}
              size={size}
              color={filled ? theme.color.accent : theme.color.subtleInk}
              accessibilityLabel={filled ? "Filled star" : "Empty star"}
            />
          );
        })}
      </FlexGrid.Row>
    </FlexGrid>
  );
});

export default RatingStars;
