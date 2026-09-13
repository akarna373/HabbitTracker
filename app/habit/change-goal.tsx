import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/Card";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { GOAL_OPTIONS } from "../../lib/goals";
import { useStore } from "../../lib/store";
import { colors, spacing, typography } from "../../lib/theme";
import type { GoalType } from "../../lib/types";

export default function ChangeGoalScreen() {
  const { habitId } = useLocalSearchParams<{ habitId: string }>();
  const habit = useStore((s) => s.habits.find((h) => h.id === habitId));
  const setGoalType = useStore((s) => s.setGoalType);
  const [goalType, setGoalTypeLocal] = useState<GoalType | null>(habit?.goalType ?? null);
  const [reduceDays, setReduceDays] = useState<number | null>(habit?.reduceDays ?? null);

  if (!habit) return null;

  const canSave = goalType !== null && (goalType !== "reduce" || (reduceDays !== null && reduceDays >= 2));

  const save = async () => {
    if (!goalType) return;
    await setGoalType(habit.id, goalType, goalType === "reduce" ? reduceDays : null);
    router.back();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={habit.name} subtitle="Change your goal" />
      <ScrollView contentContainerStyle={styles.content}>
        {GOAL_OPTIONS.map((g) => (
          <Card key={g.id} onPress={() => setGoalTypeLocal(g.id)} highlighted={goalType === g.id}>
            <Text style={styles.goalText}>{g.label}</Text>
            {g.id === "reduce" && goalType === "reduce" ? (
              <View style={styles.reduceDaysRow}>
                <Text style={styles.reduceDaysLabel}>Over how many days?</Text>
                <TextInput
                  style={styles.reduceDaysInput}
                  keyboardType="numeric"
                  placeholder="e.g. 14"
                  placeholderTextColor={colors.textMuted}
                  value={reduceDays !== null ? String(reduceDays) : ""}
                  onChangeText={(t) => {
                    const digits = t.replace(/[^0-9]/g, "");
                    setReduceDays(digits ? Number(digits) : null);
                  }}
                />
              </View>
            ) : null}
          </Card>
        ))}

        <View style={{ height: spacing.md }} />
        <PrimaryButton title="Save goal" disabled={!canSave} onPress={save} />
        <PrimaryButton title="Cancel" variant="outline" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  goalText: { ...typography.body },
  reduceDaysRow: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  reduceDaysLabel: { ...typography.caption, marginBottom: spacing.xs },
  reduceDaysInput: { ...typography.body, paddingVertical: 4 },
});
