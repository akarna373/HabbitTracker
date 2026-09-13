import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Linking, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/Card";
import { confirmDialog } from "../../components/ConfirmDialog";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { ensureBackgroundLocationPermission } from "../../lib/location";
import { useStore } from "../../lib/store";
import { colors, spacing, typography } from "../../lib/theme";

// Google Play requires a "prominent disclosure" explaining background
// location use *before* the OS permission prompt - this screen is that
// disclosure, not just a link to the privacy policy.
export default function BackgroundLocationDisclosureScreen() {
  const { habitId } = useLocalSearchParams<{ habitId: string }>();
  const setBackgroundLocationTracking = useStore((s) => s.setBackgroundLocationTracking);
  // "battery" step only shows after permission is actually granted - it's the
  // separate, optional nudge for reliable detection, not part of the disclosure.
  const [step, setStep] = useState<"disclosure" | "battery">("disclosure");

  const allow = async () => {
    const granted = await ensureBackgroundLocationPermission();
    if (!granted) {
      confirmDialog(
        "Background location not granted",
        "You can still turn this on later from this habit's page, once you've allowed \"Allow all the time\" for location in your phone's app settings.",
        [{ text: "OK" }]
      );
      router.back();
      return;
    }
    await setBackgroundLocationTracking(habitId, true);
    setStep("battery");
  };

  if (step === "battery") {
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="One more step" subtitle="For reliable detection" />
        <ScrollView contentContainerStyle={styles.content}>
          <Card highlighted>
            <Text style={styles.bullet}>Some phones pause background apps to save battery, which can delay or block detection.</Text>
            <Text style={styles.bullet}>Open app settings, tap Battery, then choose "Allow background activity".</Text>
          </Card>
          <PrimaryButton title="Open app settings" onPress={() => Linking.openSettings()} />
          <PrimaryButton title="Done" variant="outline" onPress={() => router.back()} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Background location" subtitle="Before you turn this on" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card highlighted>
          <Text style={styles.bullet}>• Warns you when you're at a marked smoking spot, even with the app closed</Text>
          <Text style={styles.bullet}>• Checked only against your own logged spots, on this device - never sent anywhere</Text>
          <Text style={styles.bullet}>• Optional - turn off anytime from this habit's page</Text>
        </Card>

        <PrimaryButton title="Allow background location" onPress={allow} />
        <PrimaryButton title="Not now" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  bullet: { ...typography.body, marginBottom: spacing.sm },
});
