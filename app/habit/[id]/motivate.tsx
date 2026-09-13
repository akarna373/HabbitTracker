import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../../components/Card";
import { confirmDialog } from "../../../components/ConfirmDialog";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { formatMoney } from "../../../lib/currency";
import { todayISO } from "../../../lib/dates";
import { pickMotivationMessage } from "../../../lib/motivation";
import {
  baselineCost,
  costForAmount,
  estimatedSavingsThisWeek,
  reduceDailyTarget,
  smokeFreeDaysThisWeek,
} from "../../../lib/progress";
import { selectLogForDate, useStore } from "../../../lib/store";
import { colors, spacing, typography } from "../../../lib/theme";

export default function MotivateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useStore((s) => s.habits.find((h) => h.id === id));
  const microtasks = useStore((s) => s.microtasksByHabit[id ?? ""]);
  const logs = useStore((s) => s.logsByHabit[id ?? ""]);
  const deleteMicrotask = useStore((s) => s.deleteMicrotask);
  const [message] = useState(() => pickMotivationMessage());

  if (!habit) return null;

  const today = todayISO();
  const amount = selectLogForDate(logs, today)?.amount ?? 0;
  const cost = costForAmount(habit, amount);
  const isReduce = habit.goalType === "reduce";
  const compareCost = isReduce ? costForAmount(habit, reduceDailyTarget(habit)) : baselineCost(habit);
  const diff = compareCost - cost;
  const compareLabel = isReduce ? "today's target" : "baseline";
  const smokeFreeDays = smokeFreeDaysThisWeek(habit, logs);
  const savings = estimatedSavingsThisWeek(habit, logs);

  const confirmDeleteMicrotask = (microtaskId: string, text: string) => {
    confirmDialog("Delete step?", `Remove "${text}" from this habit's steps.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMicrotask(habit.id, microtaskId) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Motivate me" subtitle="Before you light up, read this." />
      <ScrollView contentContainerStyle={styles.content}>
        <Card highlighted>
          <Text style={styles.message}>{message}</Text>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Today so far</Text>
          <Text style={styles.cardBody}>
            {amount} {habit.unit ?? ""} - {formatMoney(cost)} spent
          </Text>
          <Text style={styles.cardCaption}>
            {diff >= 0 ? `${formatMoney(diff)} less than ${compareLabel}` : `${formatMoney(Math.abs(diff))} more than ${compareLabel}`}
          </Text>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>This week</Text>
          <Text style={styles.cardBody}>{smokeFreeDays} smoke-free days</Text>
          <Text style={styles.cardCaption}>{formatMoney(savings)} estimated savings</Text>
        </Card>

        {microtasks && microtasks.length > 0 ? (
          <Card>
            <Text style={styles.cardTitle}>Try this instead</Text>
            {microtasks.map((m) => (
              <Text key={m.id} style={styles.cardBody} onLongPress={() => confirmDeleteMicrotask(m.id, m.text)}>
                {m.text}
              </Text>
            ))}
          </Card>
        ) : null}

        <PrimaryButton title="I'm okay for now" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  message: { ...typography.body, fontWeight: "700" },
  cardTitle: { ...typography.body, fontWeight: "700", marginBottom: 4 },
  cardBody: { ...typography.body },
  cardCaption: { ...typography.caption, marginTop: 2 },
});
