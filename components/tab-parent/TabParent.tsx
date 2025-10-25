import { ReactNode } from "react";
import { SafeAreaView, View, Text, StyleSheet } from "react-native";

type Props = {
  title: string;
  children: ReactNode;
};

/**
 * TabParent
 * A simple wrapper that provides:
 * - Safe area background
 * - A large title header (like your reference screenshots)
 * - Padded content area
 */
export default function TabParent({ title, children }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#111111",
  },
  content: {
    flex: 1,
    padding: 20,
  },
});
