import { useMemo } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeController } from "../../providers/theme/ThemeController";
import { WeeklyTheme } from "../../styles/theme";

type Option = {
  id: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  subLabel?: string;
};

type Props = {
  visible: boolean;
  options: Option[];
  onClose: () => void;
};

const OptionChip = ({
  label,
  subLabel,
  selected,
  onPress,
  styles,
}: Option & { styles: ReturnType<typeof createStyles> }) => {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Toggle ${label}`}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.chipSelected : styles.chipUnselected,
        pressed && styles.chipPressed,
      ]}
    >
      <View style={styles.chipContent}>
        <Text
          style={[
            styles.chipLabel,
            selected ? styles.chipLabelSelected : styles.chipLabelUnselected,
          ]}
        >
          {label}
        </Text>
        {subLabel ? (
          <Text
            style={[
              styles.chipSublabel,
              selected ? styles.chipLabelSelected : styles.chipLabelUnselected,
            ]}
          >
            {subLabel}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
};

export default function DisplayOnCardsSheet({
  visible,
  options,
  onClose,
}: Props) {
  const { theme } = useThemeController();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPress} onPress={onClose} />
        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          <Text style={styles.title}>Customize Meal Cards</Text>
          <FlatList
            data={options}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={styles.chipRow}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <OptionChip
                label={item.label}
                subLabel={item.subLabel}
                selected={item.selected}
                onPress={item.onPress}
                styles={styles}
              />
            )}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const createStyles = (theme: WeeklyTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "transparent",
      justifyContent: "flex-end",
    },
    backdropPress: {
      flex: 1,
    },
    sheet: {
      backgroundColor: theme.color.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      paddingHorizontal: theme.space.xl,
      paddingTop: theme.space.xl,
      paddingBottom: theme.space["2xl"],
      gap: theme.space.lg,
    },
    title: {
      textAlign: "center",
      color: theme.color.ink,
      fontSize: theme.type.size.title,
      fontWeight: theme.type.weight.bold,
    },
    listContent: {
      paddingVertical: theme.space.md,
      gap: theme.space.sm,
    },
    chipRow: {
      gap: theme.space.sm,
      justifyContent: "center",
      marginBottom: theme.space.sm,
    },
    chip: {
      flex: 1,
      borderRadius: theme.radius.full,
      paddingVertical: theme.space.sm,
      paddingHorizontal: theme.space.md,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: StyleSheet.hairlineWidth,
    },
    chipContent: {
      alignItems: "center",
      gap: theme.space.xs / 2,
    },
    chipSelected: {
      backgroundColor: theme.color.accent,
      borderColor: theme.color.accent,
    },
    chipUnselected: {
      backgroundColor: theme.color.surfaceAlt,
      borderColor: theme.color.cardOutline,
    },
    chipPressed: {
      opacity: 0.85,
    },
    chipLabel: {
      fontSize: theme.type.size.base,
      fontWeight: theme.type.weight.bold,
    },
    chipSublabel: {
      fontSize: theme.type.size.xs,
      fontWeight: theme.type.weight.medium,
    },
    chipLabelSelected: {
      color: theme.color.ink,
    },
    chipLabelUnselected: {
      color: theme.color.subtleInk,
    },
  });
