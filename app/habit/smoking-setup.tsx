import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/Card";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useDraftStore } from "../../lib/draftStore";
import { colors, spacing, typography } from "../../lib/theme";
import type { GoalType } from "../../lib/types";

const GOALS: { id: GoalType; label: string }[] = [
  { id: "reduce", label: "Reduce, then reach zero" },
  { id: "reduce_to_zero", label: "Stop immediately" },
  { id: "maintain_zero", label: "Stay at zero" },
];

export default function SmokingSetupScreen() {
  const draft = useDraftStore();

  const canContinue =
    draft.baselineQuantity !== null && draft.baselineQuantity >= 0 && draft.pricePerItem !== null && draft.pricePerItem >= 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={draft.name || "Quit habit setup"} subtitle="Quit habit setup" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>BASELINE QUANTITY ({draft.unit ?? "units"} per day)</Text>
        <Card>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="e.g. 5"
            placeholderTextColor={colors.textMuted}
            value={draft.baselineQuantity !== null ? String(draft.baselineQuantity) : ""}
            onChangeText={(t) => {
              const digits = t.replace(/[^0-9]/g, "");
              draft.set({ baselineQuantity: digits ? Number(digits) : null });
            }}
          />
        </Card>

        <Text style={styles.label}>PRICE PER ITEM (Rs)</Text>
        <Card>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="e.g. 20"
            placeholderTextColor={colors.textMuted}
            value={draft.pricePerItem !== null ? String(draft.pricePerItem) : ""}
            onChangeText={(t) => {
              const cleaned = t.replace(/[^0-9.]/g, "");
              draft.set({ pricePerItem: cleaned ? Number(cleaned) : null });
            }}
          />
        </Card>

        <Text style={styles.label}>GOAL</Text>
        {GOALS.map((g) => (
          <Card key={g.id} onPress={() => draft.set({ goalType: g.id })} highlighted={draft.goalType === g.id}>
            <Text style={styles.goalText}>{g.label}</Text>
          </Card>
        ))}

        <Text style={styles.label}>NIGHT SUMMARY TIME (24h, HH:mm)</Text>
        <Card>
          <TextInput
            style={styles.input}
            placeholder="22:00"
            placeholderTextColor={colors.textMuted}
            value={draft.summaryTime ?? ""}
            onChangeText={(t) => draft.set({ summaryTime: t })}
          />
        </Card>

        <View style={{ height: spacing.md }} />
        <PrimaryButton
          title="Continue"
          disabled={!canContinue}
          onPress={() => {
            draft.set({ frequencyType: "daily", repeatDays: [0, 1, 2, 3, 4, 5, 6], reminderEnabled: false });
            router.push("/habit/microtasks");
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  label: { ...typography.label, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: { ...typography.body, paddingVertical: 4 },
  goalText: { ...typography.body },
});
