import { Baloo2_800ExtraBold, useFonts } from "@expo-google-fonts/baloo-2";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { colors } from "../lib/theme";
import { useStore } from "../lib/store";
import { useMinuteClock } from "../lib/useMinuteClock";
import { hasSeenOnboarding } from "../lib/onboarding";
import { subscribeToNotificationOpens } from "../lib/notifications";
import { ConfirmDialogHost } from "../components/ConfirmDialog";
import { OptionSheetHost } from "../components/OptionSheet";
// Side-effect only: registers the geofencing TaskManager task at module
// scope so Android can invoke it headlessly (app fully closed) - must be
// part of the root bundle graph, not conditionally imported from a screen.
import "../lib/geofencing";

// The native splash's own auto-hide heuristic isn't reliable on every
// device - it can stay up forever even once real content is rendering.
// Taking explicit control instead: hold it here, hide it ourselves once
// every startup gate below has actually passed.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Keeps the daily savings ledger current without an app restart: when the local date
// changes it finalizes the day that just ended, and when the app returns to the
// foreground it re-reads the database first (a notification action may have logged
// something while the app was in the background) and then syncs.
function SavingsSync() {
  const { today } = useMinuteClock();

  useEffect(() => {
    void useStore.getState().syncSavings();
  }, [today]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void useStore.getState().resume();
    });
    return () => subscription.remove();
  }, []);

  return null;
}

export default function RootLayout() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const [error, setError] = useState<string | null>(null);
  const [seenOnboarding, setSeenOnboarding] = useState<boolean | null>(null);
  const [fontsLoaded] = useFonts({ Baloo2_800ExtraBold });
  const appReady = ready && seenOnboarding !== null && fontsLoaded;

  useEffect(() => {
    init().catch((e) => setError(String(e)));
    hasSeenOnboarding().then(setSeenOnboarding);
  }, [init]);

  useEffect(() => {
    if (ready && seenOnboarding === false) {
      router.replace("/welcome");
    }
  }, [ready, seenOnboarding]);

  useEffect(() => {
    if (appReady) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [appReady]);

  // Tapping a habit's notification (or one of its buttons that opens the app)
  // lands on that habit, with Home directly underneath it so Back goes Home
  // and never to whatever screen the app happened to be on.
  useEffect(() => {
    if (!appReady || seenOnboarding === false) return;
    return subscribeToNotificationOpens((habitId) => {
      router.dismissAll();
      router.navigate("/");
      if (useStore.getState().habits.some((h) => h.id === habitId)) {
        router.push(`/habit/${habitId}`);
      }
    });
  }, [appReady, seenOnboarding]);

  if (!appReady) {
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
        <SavingsSync />
        <ConfirmDialogHost />
        <OptionSheetHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
