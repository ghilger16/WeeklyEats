import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="modals/meal-editor"
        options={{ presentation: "modal", headerShown: false }}
      />
    </Stack>
  );
}
