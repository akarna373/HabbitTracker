import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandMark } from "../components/BrandMark";
import { PrimaryButton } from "../components/PrimaryButton";
import { markOnboardingSeen } from "../lib/onboarding";
import { colors, spacing, typography } from "../lib/theme";

export default function WelcomeScreen() {
  const getStarted = async () => {
    await markOnboardingSeen();
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <View style={styles.center}>
        <View style={styles.markWrap}>
          <BrandMark size={148} />
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>SMALL STEPS. YOUR PACE.</Text>
        </View>
        <Text style={styles.title}>A little today.{"\n"}A better tomorrow.</Text>
        <Text style={styles.subtitle}>
          Build habits that matter.{"\n"}Let go of the ones that don't.
        </Text>
      </View>

      <View style={styles.footer}>
        <PrimaryButton title="Get started" onPress={getStarted} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, justifyContent: "space-between" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.lg },
  markWrap: {
    marginBottom: spacing.lg,
  },
  badge: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    marginBottom: spacing.md,
  },
  badgeText: { ...typography.label, color: colors.softAccent },
  title: { ...typography.title, textAlign: "center", marginBottom: spacing.md },
  subtitle: { ...typography.body, color: colors.textSecondary, textAlign: "center" },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
