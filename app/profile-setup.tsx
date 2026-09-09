import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../components/Card";
import { PrimaryButton } from "../components/PrimaryButton";
import { generateGuestName, saveProfile, type Gender } from "../lib/profile";
import { colors, spacing, typography } from "../lib/theme";

const GENDERS: { id: Gender; label: string }[] = [
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "non_binary", label: "Non-binary" },
  { id: "unspecified", label: "Prefer not to say" },
];

export default function ProfileSetupScreen() {
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);

  const finish = async (skip: boolean) => {
    await saveProfile({
      name: skip ? generateGuestName() : name.trim() || generateGuestName(),
      age: skip || !age ? null : Number(age),
      gender: skip ? null : gender,
    });
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Tell us a little about you</Text>
        <Text style={styles.subtitle}>Helps personalize your experience. You can skip this.</Text>

        <Text style={styles.label}>NAME</Text>
        <Card>
          <TextInput
            style={styles.input}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            value={name}
            onChangeText={setName}
          />
        </Card>

        <Text style={styles.label}>AGE</Text>
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

        <Text style={styles.label}>GENDER</Text>
        <View style={styles.chipRow}>
          {GENDERS.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => setGender(g.id)}
              style={[styles.chip, gender === g.id && styles.chipActive]}
            >
              <Text style={[styles.chipText, gender === g.id && styles.chipTextActive]}>{g.label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title="Continue" onPress={() => finish(false)} />
        <PrimaryButton title="Skip for now" variant="outline" onPress={() => finish(true)} />
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
