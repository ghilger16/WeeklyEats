import { Text, StyleSheet } from "react-native";
import TabParent from "../../components/tab-parent/TabParent";

export default function MoreScreen() {
  return (
    <TabParent title="More">
      <Text style={styles.p}>Settings and other options.</Text>
    </TabParent>
  );
}

const styles = StyleSheet.create({
  p: { fontSize: 16 },
});
