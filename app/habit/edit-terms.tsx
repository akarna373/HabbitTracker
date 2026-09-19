import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/Card";
import { confirmDialog } from "../../components/ConfirmDialog";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { formatLongDateForCalendar } from "../../lib/calendarSettings";
import { formatMoney } from "../../lib/currency";
import { quantityText, singularUnit, unitFor } from "../../lib/quitBaseline";
import { costMinor, fromMinor, hasRecoverableBaseline, needsBaseline, toMinor } from "../../lib/savingsLedger";
import type { TermsChangeScope } from "../../lib/savingsLedgerDb";
import { useStore } from "../../lib/store";
import { colors, spacing, typography } from "../../lib/theme";
import { sortedHistory } from "../../lib/termsHistory";
import { parseBaselineInput, parsePriceInput, termsDiffer, toEditableText } from "../../lib/termsInput";

// Change a cost-tracked quit habit's baseline (what you used per day before starting) and the
// price of one unit. Also where a habit that never had a baseline gets one. A change is added to
// the habit's history and counts from today on: every earlier day keeps the values it had, in the
// dashboard and everywhere else. The one exception is "Correct all days", for a mistake at setup.
export default function EditTermsScreen() {
  const { habitId } = useLocalSearchParams<{ habitId: string }>();
  const habit = useStore((s) => s.habits.find((h) => h.id === habitId));
  const updateHabitTerms = useStore((s) => s.updateHabitTerms);
  const calendarType = useStore((s) => s.calendarType);

  const [baselineText, setBaselineText] = useState(habit && hasRecoverableBaseline(habit) ? toEditableText(habit.baselineQuantity) : "");
  const [priceText, setPriceText] = useState(toEditableText(habit?.pricePerItem));
  const [scope, setScope] = useState<TermsChangeScope>("from_today");
  const [saving, setSaving] = useState(false);

  const usable = habit !== undefined && habit.kind === "quit" && habit.hasCost;
  useEffect(() => {
    if (!usable) router.back();
  }, [usable]);
  if (!habit || !usable) return null;

  const missing = needsBaseline(habit);
  const baseline = parseBaselineInput(baselineText);
  const price = parsePriceInput(priceText);
  const valid = baseline !== null && price !== null;
  const canSave = valid && termsDiffer(habit, baseline, price) && !saving;
  // With no baseline there are no counted days to protect, so the choice does not apply.
  const effectiveScope: TermsChangeScope = missing ? "all_days" : scope;

  const dailyCost = valid ? fromMinor(costMinor(baseline, toMinor(price))) : null;
  const unitOne = singularUnit(habit.unit ?? "unit") || "unit";
  // Newest first.
  const history = habit.termsHistory ? sortedHistory(habit.termsHistory).reverse() : [];

  const commit = async () => {
    if (baseline === null || price === null) return;
    setSaving(true);
    const saved = await updateHabitTerms(habit.id, { baselineQuantity: baseline, pricePerItem: price }, effectiveScope);
    setSaving(false);
    if (saved) router.back();
    else confirmDialog("Could not save", "Nothing was changed. Please try again.");
  };

  const onSave = () => {
    if (!canSave) return;
    if (effectiveScope === "all_days" && !missing) {
      confirmDialog(
        "Replace the history and recalculate?",
        `This replaces every earlier baseline and price for ${habit.name} with these values and recalculates all of its past days. It cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Recalculate", onPress: commit },
        ]
      );
      return;
    }
    void commit();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={habit.name} subtitle={missing ? "Set your baseline" : "Baseline and price"} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.label}>{`Baseline - ${unitFor(habit.unit, 2)} per day, before you started`}</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="e.g. 5"
            placeholderTextColor={colors.textMuted}
            value={baselineText}
            onChangeText={(t) => setBaselineText(t.replace(/[^0-9.,]/g, ""))}
          />
          <View style={styles.divider} />
          <Text style={styles.label}>{`Price of one ${unitOne}`}</Text>
          <TextInput
            style={styles.input}
            keyboardType="decimal-pad"
            placeholder="e.g. 25"
            placeholderTextColor={colors.textMuted}
            value={priceText}
            onChangeText={(t) => setPriceText(t.replace(/[^0-9.,]/g, ""))}
          />
          <Text style={styles.preview}>
            {dailyCost !== null && baseline !== null && price !== null
              ? `Baseline cost per day: ${quantityText(baseline, habit.unit)} × ${formatMoney(price)} = ${formatMoney(dailyCost)}`
              : "Enter a baseline above 0 and a price (0 or more), up to two decimals."}
          </Text>
        </Card>

        {habit.goalType === "reduce" ? (
          <Text style={styles.note}>
            This habit reduces step by step from your baseline, so a new baseline changes its daily targets from today
            on. Past days keep theirs.
          </Text>
        ) : null}

        {history.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>BASELINE AND PRICE HISTORY</Text>
            <Card>
              {history.map((entry, index) => (
                <View key={entry.effectiveFrom} style={[styles.historyRow, index > 0 && styles.historyDivider]}>
                  <Text style={styles.historyValue}>
                    {entry.baselineQuantity && entry.baselineQuantity > 0
                      ? `${quantityText(entry.baselineQuantity, habit.unit)}/day \u00d7 ${formatMoney(entry.pricePerItem ?? 0)}`
                      : `No baseline, ${formatMoney(entry.pricePerItem ?? 0)} each`}
                  </Text>
                  <Text style={styles.historyDate}>
                    {index === history.length - 1
                      ? "Since you started"
                      : `From ${formatLongDateForCalendar(entry.effectiveFrom, calendarType)}`}
                  </Text>
                </View>
              ))}
            </Card>
          </>
        ) : null}

        {missing ? (
          <Text style={styles.note}>
            This habit was created before its starting amount was saved. Once you set it, your logged days are counted
            against it.
          </Text>
        ) : (
          <>
            <Text style={styles.sectionLabel}>WHICH DAYS DOES THIS CHANGE?</Text>
            <Card onPress={() => setScope("from_today")} highlighted={scope === "from_today"}>
              <Text style={styles.optionTitle}>From today on</Text>
              <Text style={styles.optionCaption}>
                Use this when the price or your baseline really changed. It counts from today on. Every earlier day keeps
                the values it had, everywhere in the app.
              </Text>
            </Card>
            <Card onPress={() => setScope("all_days")} highlighted={scope === "all_days"}>
              <Text style={styles.optionTitle}>Correct all days</Text>
              <Text style={styles.optionCaption}>
                Use this only if the numbers were a mistake from the start. It replaces the history and recalculates every
                logged day.
              </Text>
            </Card>
          </>
        )}

        <View style={{ height: spacing.md }} />
        <PrimaryButton title={missing ? "Save baseline" : "Save changes"} disabled={!canSave} loading={saving} onPress={onSave} />
        <PrimaryButton title="Cancel" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  label: { ...typography.caption, marginBottom: spacing.xs },
  input: { ...typography.body, paddingVertical: 4 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  preview: { ...typography.caption, marginTop: spacing.md, color: colors.textPrimary },
  note: { ...typography.caption, marginTop: spacing.sm, lineHeight: 19 },
  sectionLabel: { ...typography.label, marginTop: spacing.lg, marginBottom: spacing.sm },
  optionTitle: { ...typography.body, fontWeight: "700" },
  optionCaption: { ...typography.caption, marginTop: 4, lineHeight: 19 },
  historyRow: { paddingVertical: 2 },
  historyDivider: { marginTop: spacing.sm, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  historyValue: { ...typography.body, fontWeight: "600" },
  historyDate: { ...typography.caption, marginTop: 2 },
});
