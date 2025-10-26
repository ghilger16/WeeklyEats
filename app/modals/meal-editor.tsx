import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { darkTheme } from "../../styles/theme";

export default function MealEditorModal() {
  const { mealId } = useLocalSearchParams<{ mealId?: string }>();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {mealId ? "Edit Meal (Placeholder)" : "Add Meal (Placeholder)"}
        </Text>
        <Text style={styles.subtitle}>
          Full editor coming soon. Tap outside or swipe down to close.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const theme = darkTheme;

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.color.bg,
    padding: theme.space.xl,
    gap: theme.space.lg,
  },
  header: {
    gap: theme.space.sm,
  },
  title: {
    color: theme.color.ink,
    fontSize: theme.type.size.h2,
    fontWeight: theme.type.weight.bold,
  },
  subtitle: {
    color: theme.color.subtleInk,
    fontSize: theme.type.size.base,
  },
});
