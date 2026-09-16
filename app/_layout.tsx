import { Baloo2_800ExtraBold, useFonts } from "@expo-google-fonts/baloo-2";
import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { colors } from "../lib/theme";
import { useStore } from "../lib/store";
import { hasSeenOnboarding } from "../lib/onboarding";
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
        <ConfirmDialogHost />
        <OptionSheetHost />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
});
