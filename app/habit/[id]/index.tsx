import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../../components/Card";
import { Counter } from "../../../components/Counter";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { ProgressBar } from "../../../components/ProgressBar";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { todayISO } from "../../../lib/dates";
import { baselineCost, computeStreak, costForAmount } from "../../../lib/progress";
import { selectLogForDate, useStore } from "../../../lib/store";
import { colors, spacing, typography } from "../../../lib/theme";

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useStore((s) => s.habits.find((h) => h.id === id));
  const microtasks = useStore((s) => s.microtasksByHabit[id ?? ""] ?? []);
  const logs = useStore((s) => s.logsByHabit[id ?? ""]);
  const incrementAmount = useStore((s) => s.incrementAmount);
  const toggleMicrotask = useStore((s) => s.toggleMicrotask);
  const saveReflection = useStore((s) => s.saveReflection);
  const deleteHabit = useStore((s) => s.deleteHabit);

  const today = todayISO();
  const log = selectLogForDate(logs, today);
  const [reflection, setReflection] = useState(log?.reflection ?? "");

  useEffect(() => {
    setReflection(log?.reflection ?? "");
  }, [log?.reflection]);

  useEffect(() => {
    if (!habit) {
      router.back();
    }
  }, [habit]);

  if (!habit) return null;

  const amount = log?.amount ?? 0;
  const streak = computeStreak(habit, logs);

  const confirmDelete = () => {
    Alert.alert("Delete habit?", `This removes "${habit.name}" and its history.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteHabit(habit.id);
          router.back();
        },
      },
    ]);
  };

  if (habit.kind === "quit" && habit.hasCost) {
    const cost = costForAmount(habit, amount);
    const baseline = baselineCost(habit);
    const diff = baseline - cost;

    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title={habit.name} subtitle="Today's honest check-in" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>QUIT A HABIT</Text>
          </View>

          <Counter
            value={amount}
            unit={`${habit.unit ?? ""} today`}
            onDecrement={() => incrementAmount(habit.id, today, -1)}
            onIncrement={() => incrementAmount(habit.id, today, 1)}
            minusDisabled={amount <= 0}
          />

          <Card highlighted>
            <Text style={styles.cardTitle}>Today's spending</Text>
            <Text style={styles.cardBody}>
              {amount} x Rs {habit.pricePerItem ?? 0} = Rs {cost.toFixed(0)}
            </Text>
            <Text style={styles.cardCaption}>
              {diff >= 0 ? `Rs ${diff.toFixed(0)} less than baseline` : `Rs ${Math.abs(diff).toFixed(0)} more than baseline`}
            </Text>
          </Card>

          {microtasks.length > 0 ? (
            <Card>
              <Text style={styles.cardTitle}>When an urge appears</Text>
              {microtasks.map((m) => (
                <Text key={m.id} style={styles.cardBody}>
                  {m.text}
                </Text>
              ))}
            </Card>
          ) : null}

          <PrimaryButton
            title={amount === 0 ? "I stayed smoke-free today" : `You logged ${amount} ${habit.unit ?? ""} today`}
            variant="outline"
            disabled={amount !== 0}
            onPress={() => incrementAmount(habit.id, today, 0)}
          />

          <PrimaryButton title="View tonight's summary" variant="outline" onPress={() => router.push(`/habit/${habit.id}/summary`)} />
          <PrimaryButton title="Delete habit" variant="outline" onPress={confirmDelete} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title={habit.name} subtitle={habit.kind === "good" ? "Build a good habit" : "Quit a habit"} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tag}>
          <Text style={styles.tagText}>DAY {streak} STREAK</Text>
        </View>

        {habit.trackingMethod === "amount" ? (
          <>
            <Counter
              value={amount}
              unit={`/ ${habit.targetAmount ?? "?"} ${habit.unit ?? ""} today`}
              onDecrement={() => incrementAmount(habit.id, today, -1)}
              onIncrement={() => incrementAmount(habit.id, today, 1)}
              minusDisabled={amount <= 0}
            />
            <ProgressBar progress={habit.targetAmount ? amount / habit.targetAmount : 0} />
          </>
        ) : (
          <PrimaryButton
            title={amount >= 1 ? "Checked in today" : "Mark done for today"}
            onPress={() => incrementAmount(habit.id, today, amount >= 1 ? -1 : 1)}
          />
        )}

        {microtasks.length > 0 ? (
          <Card>
            <Text style={styles.cardTitle}>Microtasks</Text>
            {microtasks.map((m) => {
              const done = log?.microtasksDone.includes(m.id) ?? false;
              return (
                <Text
                  key={m.id}
                  style={styles.microtask}
                  onPress={() => toggleMicrotask(habit.id, today, m.id)}
                >
                  {done ? "[x] " : "[ ] "}
                  {m.text}
                </Text>
              );
            })}
          </Card>
        ) : null}

        <Text style={styles.label}>TODAY'S REFLECTION</Text>
        <Card>
          <TextInput
            style={styles.input}
            placeholder="How did it go today?"
            placeholderTextColor={colors.textMuted}
            value={reflection}
            onChangeText={setReflection}
          />
        </Card>
        <PrimaryButton title="Save reflection" variant="outline" onPress={() => saveReflection(habit.id, today, reflection)} />
        <PrimaryButton title="Delete habit" variant="outline" onPress={confirmDelete} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceRaised,
    borderRadius: 20,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    marginBottom: spacing.md,
  },
  tagText: { ...typography.label },
  cardTitle: { ...typography.body, fontWeight: "700", marginBottom: 4 },
  cardBody: { ...typography.body },
  cardCaption: { ...typography.caption, marginTop: 2 },
  microtask: { ...typography.body, marginBottom: spacing.xs },
  label: { ...typography.label, marginTop: spacing.md, marginBottom: spacing.xs },
  input: { ...typography.body, paddingVertical: 4 },
});
