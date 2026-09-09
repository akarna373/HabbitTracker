import { router } from "expo-router";
import { useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { markOnboardingSeen } from "../lib/onboarding";
import { normalizeUsername, saveProfile, type Gender } from "../lib/profile";
import { colors, spacing, typography } from "../lib/theme";

const GENDERS: { id: Gender; label: string }[] = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "non_binary", label: "Non-binary" },
  { id: "unspecified", label: "Prefer not to say" },
];

export default function ProfileSetupScreen() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);

  const usernameRef = useRef<TextInput>(null);
  const ageRef = useRef<TextInput>(null);

  const cleanName = name.trim();
  const cleanUsername = normalizeUsername(username);
  const canContinue = cleanName.length > 0 && cleanUsername.length > 0;

  const finish = async () => {
    await saveProfile({
      name: cleanName,
      username: cleanUsername,
      age: age ? Number(age) : null,
      gender,
    });
    await markOnboardingSeen();
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Tell us a little about you</Text>
          <Text style={styles.subtitle}>A few details to get your account started.</Text>

          <Text style={styles.label}>NAME</Text>
          <Card>
            <TextInput
              style={styles.input}
              placeholder="e.g. Alex"
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              returnKeyType="next"
              blurOnSubmit={false}
              onSubmitEditing={() => usernameRef.current?.focus()}
            />
          </Card>

          <Text style={styles.label}>USERNAME</Text>
          <Card>
            <View style={styles.usernameRow}>
              <Text style={styles.atSign}>@</Text>
              <TextInput
                ref={usernameRef}
                style={[styles.input, styles.usernameInput]}
                placeholder="e.g. habitfan92"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                value={username}
                onChangeText={setUsername}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => ageRef.current?.focus()}
              />
            </View>
          </Card>

          <Text style={styles.label}>AGE</Text>
          <Card>
            <TextInput
              ref={ageRef}
              style={styles.input}
              keyboardType="numeric"
              placeholder="e.g. 28"
              placeholderTextColor={colors.textMuted}
              value={age}
              onChangeText={setAge}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </Card>

          <Text style={styles.label}>GENDER</Text>
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
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
