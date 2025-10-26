import { Tabs } from "expo-router";
import { useThemeController } from "../../providers/theme/ThemeController";

export default function TabsLayout() {
  const { theme } = useThemeController();
  return (
    <Tabs
      initialRouteName="meals/index"
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: theme.color.surface,
          borderTopColor: theme.color.cardOutline,
          borderTopWidth: 1,
        },
        tabBarActiveTintColor: theme.color.accent,
        tabBarInactiveTintColor: theme.color.subtleInk,
        tabBarLabelStyle: {
          fontSize: theme.type.size.sm,
          fontWeight: theme.type.weight.medium,
        },
        sceneStyle: {
          backgroundColor: theme.color.bg,
        },
      }}
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
