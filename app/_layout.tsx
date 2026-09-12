import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { colors } from "../lib/theme";
import { useStore } from "../lib/store";
import { hasSeenOnboarding } from "../lib/onboarding";
import { ConfirmDialogHost } from "../components/ConfirmDialog";

export default function RootLayout() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const [error, setError] = useState<string | null>(null);
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);

  useEffect(() => {
    init().catch((e) => setError(String(e)));
    hasSeenOnboarding().then(setSeenOnboarding);
  }, [init]);

  useEffect(() => {
    if (ready && seenOnboarding === false) {
      router.replace("/welcome");
    }
  }, [ready, seenOnboarding]);

  if (!ready || seenOnboarding === null) {
    return <View style={styles.loading} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="welcome" />
          <Stack.Screen name="profile-setup" />
          <Stack.Screen name="focus-setup" />
        </Stack>
        <ConfirmDialogHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
