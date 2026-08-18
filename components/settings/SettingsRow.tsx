import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
  type GestureResponderEvent,
} from "react-native";
import { useMemo } from "react";
import { FlexGrid } from "../../styles/flex-grid";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";

type Props = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value?: string;
  subtitle?: string;
  onPress?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
};

const SettingsRow = ({ icon, label, value, subtitle, onPress, style }: Props) => {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const disabled = !onPress;

  return (
    <Pressable
      accessibilityRole={disabled ? "text" : "button"}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={[styles.row, style]}
    >
      <FlexGrid gutterWidth={theme.space.lg} gutterHeight={theme.space.lg}>
        <FlexGrid.Row alignItems="center" wrap={false}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name={icon}
              size={20}
              color={theme.color.ink}
            />
          </View>
          <View style={styles.textGroup}>
            <Text style={styles.label}>{label}</Text>
            {subtitle ? <Text style={styles.description}>{subtitle}</Text> : null}
          </View>
          {value ? (
            <Text style={styles.value} numberOfLines={1}>
              {value}
            </Text>
          ) : null}
          <FlexGrid.Row>
            {onPress ? (
              <MaterialCommunityIcons
                name="chevron-right"
                size={25}
                color={theme.color.subtleInk}
              />
            ) : null}
          </FlexGrid.Row>
        </FlexGrid.Row>
      </FlexGrid>
    </Pressable>
  );
};

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    row: {
      backgroundColor: theme.color.surface,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      borderColor: theme.color.cardOutline,
      paddingHorizontal: theme.space.lg,
      paddingVertical: theme.space.lg,
    },
    iconContainer: {
      width: 40,
      height: 40,
      borderRadius: theme.radius.full,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.color.surfaceAlt,
    },
    textGroup: {
      flex: 1,
      paddingLeft: theme.space.sm,
      gap: theme.space.xs,
    },
    label: {
      color: theme.color.ink,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    description: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.sm,
      marginTop: theme.space.xs,
    },
    value: {
      color: theme.color.subtleInk,
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.medium,
      textAlign: "right",
      flexShrink: 1,
      marginRight: theme.space.sm,
    },
  });

export default SettingsRow;
