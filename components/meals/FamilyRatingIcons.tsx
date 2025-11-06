import { MaterialCommunityIcons } from "@expo/vector-icons";
import { memo, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFamilyMembers } from "../../hooks/useFamilyMembers";
import { deriveFamilyInitials } from "../../utils/familyInitials";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { FamilyRatingValue } from "../../types/meals";
import { getNextFamilyRating } from "../../utils/familyRatings";

type Props = {
  ratings?: Record<string, FamilyRatingValue>;
  onChange?: (memberId: string, rating: FamilyRatingValue) => void;
  size?: number;
  showNames?: boolean;
  ratedOnly?: boolean;
  singleRow?: boolean;
  gap?: number;
};

const ratingIcons: Record<
  Exclude<FamilyRatingValue, 0>,
  { icon: string; colorKey: keyof WeeklyTheme["color"] }
> = {
  3: { icon: "heart", colorKey: "ink" },
  2: { icon: "emoticon-happy-outline", colorKey: "ink" },
  1: { icon: "thumb-down", colorKey: "ink" },
};

const memberColorPalette = [
  "#0F766E",
  "#1D4ED8",
  "#9333EA",
  "#DC2626",
  "#D97706",
  "#2563EB",
];

const FamilyRatingIcons = memo(function FamilyRatingIcons({
  ratings,
  onChange,
  size = 52,
  showNames = true,
  ratedOnly = false,
  singleRow = false,
  gap,
}: Props) {
  const { members } = useFamilyMembers();
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const initialsMap = useMemo(() => deriveFamilyInitials(members), [members]);
  const hasFamily = members.length > 0;
  const palette = useMemo(() => {
    if (theme.mode === "light") {
      return memberColorPalette.map((color) => color);
    }
    return memberColorPalette;
  }, [theme.mode]);
  const gapValue = gap ?? theme.space.md;

  if (!hasFamily) {
    return null;
  }

  const diameter = size;
  const radiusStyle = {
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
  };
  const isInteractive = typeof onChange === "function";
  const iconSize = Math.max(10, Math.round(diameter * 0.55));

  let renderedCount = 0;
  const nodes = members.map((member, index) => {
    const ratingValue = ratings?.[member.id] ?? 0;
    if (ratedOnly && ratingValue === 0) {
      return null;
    }
    renderedCount += 1;
    const ratingMeta =
      ratingValue === 0
        ? null
        : ratingIcons[ratingValue as Exclude<FamilyRatingValue, 0>];
    const backgroundColor = palette[index % palette.length];
    const initials = initialsMap[member.id] ?? member.name[0] ?? "?";
    const handlePress = () => {
      if (!onChange) {
        return;
      }
      const next = getNextFamilyRating((ratingValue ?? 0) as FamilyRatingValue);
      onChange(member.id, next);
    };

    return (
      <View key={member.id} style={styles.member}>
        <Pressable
          style={[
            styles.avatar,
            radiusStyle,
            { backgroundColor },
            !isInteractive && styles.avatarStatic,
          ]}
          accessibilityRole={isInteractive ? "button" : undefined}
          accessibilityLabel={`${member.name} rating ${
            ratingValue === 0 ? "not set" : "set"
          }`}
          onPress={handlePress}
          disabled={!isInteractive}
        >
          {ratingMeta ? (
            <MaterialCommunityIcons
              name={ratingMeta.icon as any}
              size={iconSize}
              color={theme.color[ratingMeta.colorKey]}
            />
          ) : (
            <Text style={styles.initials}>{initials}</Text>
          )}
        </Pressable>
        {showNames ? (
          <Text style={styles.name} numberOfLines={1}>
            {member.name}
          </Text>
        ) : null}
      </View>
    );
  });

  if (renderedCount === 0) {
    return null;
  }

  return (
    <View
      style={[
        styles.wrapper,
        singleRow && styles.wrapperSingleRow,
        {
          columnGap: gapValue,
          rowGap: singleRow ? 0 : gapValue,
        },
      ]}
    >
      {nodes}
    </View>
  );
});

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    wrapper: {
      flexDirection: "row",
      flexWrap: "wrap",
    },
    wrapperSingleRow: {
      flexWrap: "nowrap",
    },
    member: {
      alignItems: "center",
      minWidth: 20,
    },
    avatar: {
      justifyContent: "center",
      alignItems: "center",
      position: "relative",
    },
    avatarStatic: {
      opacity: 0.9,
    },
    initials: {
      color: "#FFFFFF",
      fontSize: theme.type.size.sm,
      fontWeight: theme.type.weight.bold,
    },
    name: {
      marginTop: theme.space.xs,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
    },
  });

export default FamilyRatingIcons;
