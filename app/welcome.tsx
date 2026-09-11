import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandMark } from "../components/BrandMark";
import { GoogleGIcon } from "../components/GoogleGIcon";
import { PrimaryButton } from "../components/PrimaryButton";
import { SocialButton } from "../components/SocialButton";
import { colors, spacing, typography } from "../lib/theme";

export default function WelcomeScreen() {
  // Onboarding is only marked "seen" once profile-setup finishes, so killing
  // the app mid-flow re-shows Welcome instead of stranding a user with no profile.
  const continueAsGuest = () => {
    router.replace("/profile-setup");
  };

  // TODO: wire up real Google auth later. Until then this is a dev shortcut
  // that skips the finished profile-setup screen and jumps straight to
  // focus-setup, the screen currently being worked on - swap for the real
  // sign-in call when ready.
  const continueWithGoogle = () => {
    router.push("/focus-setup");
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
        <SocialButton title="Continue with Google" icon={<GoogleGIcon />} onPress={continueWithGoogle} />
        <PrimaryButton title="Continue as guest" variant="outline" onPress={continueAsGuest} />
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
