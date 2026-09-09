import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { markOnboardingSeen } from "../lib/onboarding";
import { generateGuestName, normalizeUsername, saveProfile, type Gender } from "../lib/profile";
import { colors, spacing, typography } from "../lib/theme";

const GENDERS: { id: Gender; label: string }[] = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "non_binary", label: "Non-binary" },
  { id: "unspecified", label: "Prefer not to say" },
];

export default function ProfileSetupScreen() {
  const [username, setUsername] = useState(generateGuestName());
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);

  const cleanUsername = normalizeUsername(username);
  const canContinue = cleanUsername.length > 0;

  const finish = async () => {
    await saveProfile({
      username: cleanUsername,
      age: age ? Number(age) : null,
      gender,
    });
    await markOnboardingSeen();
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Tell us a little about you</Text>
        <Text style={styles.subtitle}>Choose a username to get started. Age and gender are optional.</Text>

        <Text style={styles.label}>USERNAME</Text>
        <Card>
          <View style={styles.usernameRow}>
            <Text style={styles.atSign}>@</Text>
            <TextInput
              style={[styles.input, styles.usernameInput]}
              placeholder="username"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
            />
          </View>
        </Card>

        <Text style={styles.label}>AGE (OPTIONAL)</Text>
        <Card>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="e.g. 28"
            placeholderTextColor={colors.textMuted}
            value={age}
            onChangeText={setAge}
          />
        </Card>

        <Text style={styles.label}>GENDER (OPTIONAL)</Text>
        <View style={styles.chipRow}>
          {GENDERS.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => setGender(gender === g.id ? null : g.id)}
              style={[styles.chip, gender === g.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, gender === g.id && styles.chipTextActive]}>{g.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title="Continue" disabled={!canContinue} onPress={finish} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  title: { ...typography.title, marginBottom: spacing.xs },
  subtitle: { ...typography.caption, marginBottom: spacing.lg },
  label: { ...typography.label, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: { ...typography.body, paddingVertical: 4 },
  usernameRow: { flexDirection: "row", alignItems: "center" },
  atSign: { ...typography.body, color: colors.textMuted, marginRight: 2 },
  usernameInput: { flex: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipActive: { borderColor: colors.accentPink, backgroundColor: colors.surface },
  chipText: { ...typography.caption },
  chipTextActive: { color: colors.accentPink, fontWeight: "700" },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
