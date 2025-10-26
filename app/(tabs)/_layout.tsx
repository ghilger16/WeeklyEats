import { Tabs } from "expo-router";

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="meals/index"
      screenOptions={{ headerShown: false }}
    >
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
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
