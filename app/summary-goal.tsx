import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../components/Card";
import { confirmDialog } from "../components/ConfirmDialog";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { currencySymbolFor, withCurrencySymbol } from "../lib/currency";
import { normalizeCurrencyCode, parseMonthlyGoalInput } from "../lib/financialSettings";
import { useStore } from "../lib/store";
import { colors, spacing, typography } from "../lib/theme";

// One-tap currency choices; any other three-letter code can still be typed.
const QUICK_CURRENCIES = ["NPR", "INR", "USD", "EUR", "GBP", "JPY"];

// Create, edit or remove the monthly savings goal (and the currency code).

export default function MonthlyGoalScreen() {
  const settings = useStore((s) => s.financialSettings);
  const updateFinancialSettings = useStore((s) => s.updateFinancialSettings);

  const hasGoal = settings.monthlyGoal !== null;
  const [goalText, setGoalText] = useState(hasGoal ? String(settings.monthlyGoal) : "");
  const [currencyText, setCurrencyText] = useState(settings.currencyCode);
  const [saving, setSaving] = useState(false);

  // An empty field means "no goal"; anything else must be a real positive amount.
  const goalIsEmpty = goalText.trim() === "";
  const parsedGoal = goalIsEmpty ? null : parseMonthlyGoalInput(goalText);
  const goalError = !goalIsEmpty && parsedGoal === null ? "Enter an amount above 0, like 5000 or 2500.50." : null;
  const currencyCode = normalizeCurrencyCode(currencyText);
  const currencyError = currencyCode === null ? "Use a three-letter code, like NPR." : null;
  const canSave = !goalError && !currencyError && !saving;

  const save = async () => {
    if (!canSave || currencyCode === null) return;
    setSaving(true);
    try {
      await updateFinancialSettings({ monthlyGoal: parsedGoal, currencyCode });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = () => {
    confirmDialog("Remove monthly goal?", "Your savings stay as they are - only the goal and its progress bar go away.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          await updateFinancialSettings({ monthlyGoal: null });
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={hasGoal ? "Edit monthly goal" : "Set a monthly goal"}
        subtitle="Optional - a target for your confirmed savings each month."
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>MONTHLY SAVINGS GOAL</Text>
        <Card highlighted>
          <TextInput
            style={styles.input}
            value={goalText}
            onChangeText={setGoalText}
            keyboardType="decimal-pad"
            placeholder="e.g. 5000"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Monthly savings goal"
            returnKeyType="done"
          />
        </Card>
        {goalError ? <Text style={styles.error}>{goalError}</Text> : <Text style={styles.hint}>Leave empty for no goal.</Text>}

        <Text style={styles.label}>CURRENCY</Text>
        <Card>
          <TextInput
            style={styles.input}
            value={currencyText}
            onChangeText={(t) => setCurrencyText(t.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase())}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={3}
            placeholder="NPR"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Currency code"
          />
        </Card>
        <View style={styles.chipRow}>
          {QUICK_CURRENCIES.map((code) => {
            const selected = currencyCode === code;
            return (
              <Pressable
                key={code}
                onPress={() => setCurrencyText(code)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Use ${code}`}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {currencySymbolFor(code)} {code}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {currencyError ? (
          <Text style={styles.error}>{currencyError}</Text>
        ) : (
          <Text style={styles.hint}>
            Amounts will look like {withCurrencySymbol(currencySymbolFor(currencyCode ?? settings.currencyCode), "1,250")}
          </Text>
        )}

        <PrimaryButton title={hasGoal ? "Save changes" : "Save goal"} onPress={save} disabled={!canSave} loading={saving} style={styles.saveButton} />
        {hasGoal ? <PrimaryButton title="Remove goal" variant="outline" onPress={confirmRemove} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  label: { ...typography.label, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { ...typography.body, fontSize: 18, paddingVertical: 4 },
  hint: { ...typography.caption, marginBottom: spacing.xs },
  error: { ...typography.caption, color: colors.accentRed, marginBottom: spacing.xs },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xs },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipSelected: { borderColor: colors.accentPink, backgroundColor: "rgba(255,79,139,0.12)" },
  chipText: { ...typography.caption, fontWeight: "700" },
  chipTextSelected: { color: colors.accentPink },
  saveButton: { marginTop: spacing.lg },
});
