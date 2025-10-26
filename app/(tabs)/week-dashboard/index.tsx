import { Text, StyleSheet } from "react-native";
import TabParent from "../../../components/tab-parent/TabParent";

export default function WeekDashboardScreen() {
  return (
    <TabParent title="Week Dashboard">
      <Text style={styles.p}>Plan your dinners for the week here.</Text>
    </TabParent>
  );
}

const styles = StyleSheet.create({
  p: { fontSize: 16 },
});
