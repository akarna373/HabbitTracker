import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/Card";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { ThemedTimePicker } from "../../components/ThemedTimePicker";
import { getAlcoholUnitSuggestions, getCurrencySymbol } from "../../lib/currency";
import { useDraftStore } from "../../lib/draftStore";
import { GOAL_OPTIONS } from "../../lib/goals";
import { formatTime12h } from "../../lib/progress";
import { colors, spacing, typography } from "../../lib/theme";

export default function SmokingSetupScreen() {
  const draft = useDraftStore();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const isAlcohol = draft.templateId === "alcohol";
  const unitSuggestions = isAlcohol ? getAlcoholUnitSuggestions() : [];

  const canContinue =
    draft.baselineQuantity !== null &&
    draft.baselineQuantity >= 0 &&
    draft.pricePerItem !== null &&
    draft.pricePerItem >= 0 &&
    draft.goalType !== null &&
    (draft.goalType !== "reduce" || (draft.reduceDays !== null && draft.reduceDays >= 2));

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={draft.name || "Quit habit setup"} subtitle="Quit habit setup" />
      <ScrollView contentContainerStyle={styles.content}>
        {isAlcohol ? (
          <>
            <Text style={styles.label}>UNIT</Text>
            <View style={styles.unitChipRow}>
              {unitSuggestions.map((u) => (
                <Text
                  key={u}
                  style={[styles.unitChip, draft.unit === u && styles.unitChipSelected]}
                  onPress={() => draft.set({ unit: u })}
                >
                  {u}
                </Text>
              ))}
            </View>
            <Card>
              <TextInput
                style={styles.input}
                placeholder="Or type your own unit"
                placeholderTextColor={colors.textMuted}
                value={draft.unit ?? ""}
                onChangeText={(t) => draft.set({ unit: t })}
              />
            </Card>
          </>
        ) : null}

        <Text style={styles.label}>BASELINE QUANTITY ({draft.unit ?? "units"} per day)</Text>
        <Card>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder={`e.g. ${draft.suggestedBaselineQuantity ?? 5}`}
            placeholderTextColor={colors.textMuted}
            value={draft.baselineQuantity !== null ? String(draft.baselineQuantity) : ""}
            onChangeText={(t) => {
              const digits = t.replace(/[^0-9]/g, "");
              draft.set({ baselineQuantity: digits ? Number(digits) : null });
            }}
          />
        </Card>

        <Text style={styles.label}>PRICE PER {(draft.unit || "ITEM").toUpperCase()} ({getCurrencySymbol()})</Text>
        <Card>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder={`e.g. ${draft.suggestedPricePerItem ?? 20}`}
            placeholderTextColor={colors.textMuted}
            value={draft.pricePerItem !== null ? String(draft.pricePerItem) : ""}
            onChangeText={(t) => {
              const cleaned = t.replace(/[^0-9.]/g, "");
              draft.set({ pricePerItem: cleaned ? Number(cleaned) : null });
            }}
          />
        </Card>

        <Text style={styles.label}>GOAL</Text>
        {GOAL_OPTIONS.map((g) => (
          <Card key={g.id} onPress={() => draft.set({ goalType: g.id })} highlighted={draft.goalType === g.id}>
            <Text style={styles.goalText}>{g.label}</Text>
            {g.id === "reduce" && draft.goalType === "reduce" ? (
              <View style={styles.reduceDaysRow}>
                <Text style={styles.reduceDaysLabel}>Over how many days?</Text>
                <TextInput
                  style={styles.reduceDaysInput}
                  keyboardType="numeric"
                  placeholder="e.g. 14"
                  placeholderTextColor={colors.textMuted}
                  value={draft.reduceDays !== null ? String(draft.reduceDays) : ""}
                  onChangeText={(t) => {
                    const digits = t.replace(/[^0-9]/g, "");
                    draft.set({ reduceDays: digits ? Number(digits) : null });
                  }}
                />
              </View>
            ) : null}
          </Card>
        ))}

        <Text style={styles.label}>NIGHT SUMMARY TIME</Text>
        <Card onPress={() => setShowTimePicker(true)}>
          <Text style={styles.input}>{formatTime12h(draft.summaryTime ?? "22:00")}</Text>
        </Card>
        <ThemedTimePicker
          visible={showTimePicker}
          value={draft.summaryTime ?? "22:00"}
          title="Night summary time"
          onCancel={() => setShowTimePicker(false)}
          onConfirm={(time) => {
            setShowTimePicker(false);
            draft.set({ summaryTime: time });
          }}
        />

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
  reduceDaysRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reduceDaysLabel: { ...typography.caption, marginBottom: spacing.xs },
  reduceDaysInput: { ...typography.body, paddingVertical: 4 },
  unitChipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginBottom: spacing.sm },
  unitChip: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    color: colors.textSecondary,
  },
  unitChipSelected: {
    borderColor: colors.accentPink,
    color: colors.accentPink,
    fontWeight: "700",
  },
});
