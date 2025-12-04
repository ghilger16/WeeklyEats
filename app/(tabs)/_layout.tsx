import { Tabs } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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
        options={{
          tabBarLabel: "Meals",
          title: "Meals",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="silverware-variant"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="week-dashboard/index"
        options={{
          tabBarLabel: "Week",
          title: "Week Dashboard",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="calendar-month-outline"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="more/index"
        options={{
          tabBarLabel: "More",
          title: "More",
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons
              name="dots-horizontal"
              size={size}
              color={color}
            />
          ),
        }}
      />
      <Tabs.Screen name="index" options={{ href: null }} />
    </Tabs>
  );
}
