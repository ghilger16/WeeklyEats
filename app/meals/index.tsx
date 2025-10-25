import { Text, StyleSheet } from "react-native";
import TabParent from "../../components/tab-parent/TabParent";

export default function MealsScreen() {
  return (
    <TabParent title="Meals">
      <Text style={styles.p}>Your saved meals will appear here.</Text>
    </TabParent>
  );
}

const styles = StyleSheet.create({
  p: { fontSize: 16 },
});
