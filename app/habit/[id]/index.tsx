import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../../components/Card";
import { confirmDialog } from "../../../components/ConfirmDialog";
import { Counter } from "../../../components/Counter";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { ProgressBar } from "../../../components/ProgressBar";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { ThemedSwitch } from "../../../components/ThemedSwitch";
import { formatMoney } from "../../../lib/currency";
import { todayISO } from "../../../lib/dates";
import { ensureLocationPermission, findHotspots, getCurrentLocation, nearestHotspot } from "../../../lib/location";
import { scheduleImmediateNotification } from "../../../lib/notifications";
import { baselineCost, computeStreak, costForAmount, reduceCycleDay, reduceDailyTarget, REDUCE_CYCLE_DAYS } from "../../../lib/progress";
import { selectLogForDate, useStore } from "../../../lib/store";
import { colors, spacing, typography } from "../../../lib/theme";
import type { Microtask } from "../../../lib/types";

// A literal [] fallback in the selector below would be a new array every
// render, which breaks zustand's snapshot caching and spams a "getSnapshot
// should be cached" error - reuse one stable empty array instead.
const EMPTY_MICROTASKS: Microtask[] = [];

export default function HabitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useStore((s) => s.habits.find((h) => h.id === id));
  const microtasks = useStore((s) => s.microtasksByHabit[id ?? ""] ?? EMPTY_MICROTASKS);
  const logs = useStore((s) => s.logsByHabit[id ?? ""]);
  const incrementAmount = useStore((s) => s.incrementAmount);
  const toggleMicrotask = useStore((s) => s.toggleMicrotask);
  const deleteMicrotask = useStore((s) => s.deleteMicrotask);
  const saveReflection = useStore((s) => s.saveReflection);
  const deleteHabit = useStore((s) => s.deleteHabit);
  const setLocationTracking = useStore((s) => s.setLocationTracking);
  const smokeLocations = useStore((s) => s.smokeLocationsByHabit[id ?? ""]);

  const today = todayISO();
  const log = selectLogForDate(logs, today);
  const [reflection, setReflection] = useState(log?.reflection ?? "");
  // Mirrors habit.locationTrackingEnabled but flips the instant the user
  // taps, instead of waiting on the permission prompt + DB write - without
  // this the Switch (fully controlled by the store) stalls visibly before
  // moving.
  const [trackingUiValue, setTrackingUiValue] = useState(habit?.locationTrackingEnabled ?? false);

  useEffect(() => {
    setReflection(log?.reflection ?? "");
  }, [log?.reflection]);

  useEffect(() => {
    if (!habit) {
      router.back();
    }
  }, [habit]);

  useEffect(() => {
    setTrackingUiValue(habit?.locationTrackingEnabled ?? false);
  }, [habit?.locationTrackingEnabled]);

  useEffect(() => {
    if (!habit?.locationTrackingEnabled) return;
    let cancelled = false;
    (async () => {
      const current = await getCurrentLocation();
      if (!current || cancelled) return;
      const hotspots = findHotspots(smokeLocations ?? []);
      if (nearestHotspot(current, hotspots) !== null) {
        // A passive in-screen card read as encouragement to just go smoke
        // somewhere else - a real push notification is the actual deterrent,
        // since it can reach the user the moment they're at the spot, not
        // only if they happen to have this screen open already.
        scheduleImmediateNotification(
          "You're at your smoking location",
          "Please move away from this spot - it's better for your health and your finances."
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [habit?.locationTrackingEnabled, smokeLocations]);

  if (!habit) return null;

  const amount = log?.amount ?? 0;
  const streak = computeStreak(habit, logs);

  const toggleLocationTracking = async (value: boolean) => {
    setTrackingUiValue(value);
    if (value) {
      const granted = await ensureLocationPermission();
      if (!granted) {
        setTrackingUiValue(false);
        confirmDialog(
          "Location permission needed",
          "To warn you at places you usually smoke, allow this app to access your location.",
          [{ text: "OK" }]
        );
        return;
      }
    }
    await setLocationTracking(habit.id, value);
  };

  const confirmDelete = () => {
    confirmDialog("Delete habit?", `This removes "${habit.name}" and its history.`, [
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

  const confirmDeleteMicrotask = (microtaskId: string, text: string) => {
    confirmDialog("Delete microtask?", `Remove "${text}" from this habit's steps.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMicrotask(habit.id, microtaskId) },
    ]);
  };

  if (habit.kind === "quit" && habit.hasCost) {
    const cost = costForAmount(habit, amount);
    const isReduce = habit.goalType === "reduce";
    const day = reduceCycleDay(habit);
    // A "reduce" habit compares against that day's declining target instead
    // of the flat baseline forever - every other goal type keeps the
    // original flat-baseline comparison.
    const compareCost = isReduce ? costForAmount(habit, reduceDailyTarget(habit)) : baselineCost(habit);
    const diff = compareCost - cost;
    const compareLabel = isReduce ? "today's target" : "baseline";

    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title={habit.name} subtitle="Today's honest check-in" />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{isReduce ? `DAY ${day} OF ${REDUCE_CYCLE_DAYS}` : "QUIT A HABIT"}</Text>
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
              {amount} x {formatMoney(habit.pricePerItem ?? 0)} = {formatMoney(cost)}
            </Text>
            <Text style={styles.cardCaption}>
              {diff >= 0 ? `${formatMoney(diff)} less than ${compareLabel}` : `${formatMoney(Math.abs(diff))} more than ${compareLabel}`}
            </Text>
          </Card>

          <PrimaryButton title="Motivate me" onPress={() => router.push(`/habit/${habit.id}/motivate`)} />

          <Card>
            <View style={styles.row}>
              <View style={styles.rowTextCol}>
                <Text style={styles.cardTitle}>Track smoking locations</Text>
                <Text style={styles.cardCaption}>Get warned when you're at a place you usually smoke</Text>
                <Text style={styles.cardCaption}>Log as you smoke, not in bulk later - bulk logs record the wrong spot</Text>
              </View>
              <ThemedSwitch value={trackingUiValue} onValueChange={toggleLocationTracking} />
            </View>
          </Card>

          <PrimaryButton
            title={amount === 0 ? "I stayed smoke-free today" : `You logged ${amount} ${habit.unit ?? ""} today`}
            variant="outline"
            disabled={amount !== 0}
            onPress={() => incrementAmount(habit.id, today, 0)}
          />

          <PrimaryButton title="Today's summary" variant="outline" onPress={() => router.push(`/habit/${habit.id}/summary`)} />
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
                  onLongPress={() => confirmDeleteMicrotask(m.id, m.text)}
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
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowTextCol: { flex: 1, paddingRight: spacing.sm },
  input: { ...typography.body, paddingVertical: 4 },
});
