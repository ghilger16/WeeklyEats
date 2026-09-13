import { Redirect } from "expo-router";

// Keep links from previously installed widgets working.
export default function LegacyWeekRedirect() {
  return <Redirect href="/(tabs)/week-dashboard" />;
}
