import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { recoverOnStartup } from "./backup";

export default function RecoveryGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setFailed(false);
    recoverOnStartup().then(message => {
      if (!active) return;
      setReady(true);
      if (message) Alert.alert("Data Recovery", message);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [attempt]);
  if (ready) return <>{children}</>;
  return <View style={{ flex: 1, justifyContent: "center", padding: 32, gap: 20, backgroundColor: "#fff" }}>
    {failed ? <>
      <Text style={{ fontSize: 20 }}>Recovery could not finish</Text>
      <Text>Your recovery copy is being kept. Retry, or close and reopen WeeklyEats. Do not delete the app.</Text>
      <Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)}><Text style={{ color: "#185d35", fontSize: 18 }}>Retry Recovery</Text></Pressable>
    </> : <><ActivityIndicator /><Text>Checking saved data…</Text></>}
  </View>;
}
