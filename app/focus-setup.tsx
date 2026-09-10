import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "../components/PrimaryButton";
import { saveFocusAreas } from "../lib/focus";
import { colors, spacing, typography } from "../lib/theme";

const FOCUS_AREAS: { id: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "good", label: "Good habits", icon: "thumbs-up-outline" },
  { id: "bad", label: "Track bad habits", icon: "thumbs-down-outline" },
  { id: "study", label: "Study", icon: "school-outline" },
  { id: "personal_goal", label: "Personal goals", icon: "flag-outline" },
  { id: "achiever", label: "Achiever", icon: "trophy-outline" },
];

export default function FocusSetupScreen() {
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const finish = async () => {
    await saveFocusAreas(selected);
    router.replace("/(tabs)");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>What would you like to focus on?</Text>
        <Text style={styles.subtitle}>Pick as many as you like. You can change this later.</Text>

        <View style={styles.chipRow}>
          {FOCUS_AREAS.map((area) => {
            const active = selected.includes(area.id);
            return (
              <Pressable
                key={area.id}
                onPress={() => toggle(area.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Ionicons
                  name={area.icon}
                  size={16}
                  color={active ? colors.accentPink : colors.textSecondary}
                  style={styles.chipIcon}
                />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{area.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton title="Continue" onPress={finish} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg },
  title: { ...typography.title, marginBottom: spacing.xs },
  subtitle: { ...typography.caption, marginBottom: spacing.lg },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipIcon: { marginRight: spacing.xs },
  chipActive: { borderColor: colors.accentPink, backgroundColor: colors.surface },
  chipText: { ...typography.body },
  chipTextActive: { color: colors.accentPink, fontWeight: "700" },
  footer: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
});
