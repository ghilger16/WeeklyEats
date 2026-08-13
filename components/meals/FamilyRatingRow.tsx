import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFamilyMembers } from "../../hooks/useFamilyMembers";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";
import { FamilyRatingValue, Meal } from "../../types/meals";
import { deriveFamilyInitials } from "../../utils/familyInitials";
import { getNextFamilyRating } from "../../utils/familyRatings";
import { memberColorPalette } from "./FamilyRatingIcons";

type Props = {
  ratings?: Meal["familyRatings"];
  onChange: (memberId: string, rating: FamilyRatingValue) => void;
  compact?: boolean;
};

const ratingMeta: Record<
  FamilyRatingValue,
  { label: string; icon?: string; color: string }
> = {
  0: { label: "Not rated yet", color: "#8E8E93" },
  1: { label: "Not A Fan", icon: "thumb-down", color: "#4D7CFF" },
  2: { label: "Liked It", icon: "emoticon-happy-outline", color: "#FEC107" },
  3: { label: "Loved It", icon: "heart", color: "#FF4D8D" },
};

export default function FamilyRatingRow({ ratings, onChange, compact = false }: Props) {
  const { members } = useFamilyMembers();
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const initials = useMemo(() => deriveFamilyInitials(members), [members]);
  if (!members.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={[styles.scroll, compact && styles.compactScroll]}
      contentContainerStyle={styles.row}
    >
      {members.map((member, index) => {
        const value = ratings?.[member.id] ?? 0;
        const meta = ratingMeta[value];
        return (
          <Pressable
            key={member.id}
            onPress={() => onChange(member.id, getNextFamilyRating(value))}
            accessibilityRole="button"
            accessibilityLabel={`${member.name}, ${meta.label}`}
            style={({ pressed }) => [styles.member, pressed && styles.pressed]}
          >
            <View
              style={[
                styles.avatar,
                {
                  backgroundColor:
                    memberColorPalette[index % memberColorPalette.length],
                },
              ]}
            >
              <Text style={styles.initial}>
                {initials[member.id] ?? member.name[0] ?? "?"}
              </Text>
              {meta.icon ? (
                <View style={styles.ratingBadge}>
                  <MaterialCommunityIcons
                    name={meta.icon as any}
                    size={19}
                    color={meta.color}
                  />
                </View>
              ) : null}
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {member.name}
            </Text>
            <Text
              style={[styles.rating, { color: meta.color }]}
              numberOfLines={1}
            >
              {value > 0 ? meta.label : " "}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    scroll: { width: "100%" },
    compactScroll: { flexGrow: 0, height: 110 },
    row: { flexGrow: 1, justifyContent: "center", gap: 0 },
    member: { width: 62, alignItems: "center", gap: theme.space.xs },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    initial: {
      color: "#FFFFFF",
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.medium,
    },
    ratingBadge: {
      position: "absolute",
      right: -5,
      bottom: -3,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.color.bg,
      alignItems: "center",
      justifyContent: "center",
    },
    name: {
      maxWidth: 62,
      color: theme.color.subtleInk,
      fontSize: theme.type.size.xs,
      textAlign: "center",
    },
    rating: {
      maxWidth: 62,
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.medium,
      textAlign: "center",
    },
    pressed: { opacity: 0.72 },
  });
