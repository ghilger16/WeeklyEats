import { Tabs } from "expo-router";

export default function RootTabs() {
  return (
    <Tabs
      initialRouteName="week-dashboard/index"
      screenOptions={{ headerShown: false }}
    >
      {/* Order is exactly how tabs render, so list them in your desired order */}
      <Tabs.Screen
        name="meals/index"
        options={{ tabBarLabel: "Meals", title: "Meals" }}
      />
      <Tabs.Screen
        name="week-dashboard/index"
        options={{ tabBarLabel: "Week", title: "Week Dashboard" }}
      />
      <Tabs.Screen
        name="more/index"
        options={{ tabBarLabel: "More", title: "More" }}
      />

      {/* Hide the root index so it doesn't appear as a tab */}
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
