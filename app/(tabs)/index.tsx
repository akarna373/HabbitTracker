import { router } from "expo-router";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/Card";
import { HeaderMenu } from "../../components/HeaderMenu";
import { ProfileBadge } from "../../components/ProfileBadge";
import { ProgressBar } from "../../components/ProgressBar";
import { SpeedDialFab } from "../../components/SpeedDialFab";
import { SwipeableHabitTile } from "../../components/SwipeableHabitTile";
import { formatLongDate, todayISO } from "../../lib/dates";
import { getTodayDoseTimes } from "../../lib/medicationSchedule";
import { formatTime12h, isHabitCompleteOn } from "../../lib/progress";
import { useStore } from "../../lib/store";
import { brandFont, colors, spacing, typography } from "../../lib/theme";
import type { DailyLog, Habit } from "../../lib/types";

export default function TodayScreen() {
  const habits = useStore((s) => s.habits);
  const logsByHabit = useStore((s) => s.logsByHabit);
  const today = todayISO();

  const completedCount = habits.filter((h) => isHabitCompleteOn(h, logsByHabit[h.id], today)).length;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={habits}
        keyExtractor={(h) => h.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.brandRow}>
              <Text style={styles.brandText}>Habbit</Text>
              <View style={styles.brandActions}>
                <ProfileBadge />
                <HeaderMenu />
              </View>
            </View>

            <Text style={styles.title}>A little better, daily.</Text>
            <Text style={styles.date}>{formatLongDate(today)}</Text>

            <Card highlighted>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryTitle}>Today's habits</Text>
                <Text style={styles.summaryCount}>
                  {completedCount} of {habits.length}
                </Text>
              </View>
              <View style={{ marginVertical: spacing.sm }}>
                <ProgressBar progress={habits.length ? completedCount / habits.length : 0} />
              </View>
              <Text style={styles.summaryCaption}>Small steps count. Keep showing up.</Text>
            </Card>
          </View>
        }
        renderItem={({ item }) => <TodayHabitTile habit={item} logs={logsByHabit[item.id]} today={today} />}
        ListEmptyComponent={
          <Card>
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptyBody}>Tap + to add your first small change.</Text>
          </Card>
        }
      />

      <SpeedDialFab />
    </SafeAreaView>
  );
}

function TodayHabitTile({ habit, logs, today }: { habit: Habit; logs: DailyLog[] | undefined; today: string }) {
  const log = logs?.find((l) => l.date === today);
  const done = isHabitCompleteOn(habit, logs, today);

  let subtitle = "";
  if (habit.kind === "quit") {
    subtitle = log ? `${log.amount} ${habit.unit ?? ""} logged today` : "Check in this evening";
  } else if (habit.trackingMethod === "amount") {
    subtitle = `${log?.amount ?? 0} / ${habit.targetAmount ?? "?"} ${habit.unit ?? ""}`;
  } else {
    subtitle = done ? "Checked in" : "Not checked in yet";
  }

  // dosageFrequency is only ever set for a medication habit - its reminder
  // line shows the next unlogged dose time today instead of the fixed
  // reminderTime every other habit uses, since a medication can have
  // several dose times a day, not just one.
  const reminderText = habit.dosageFrequency
    ? getMedicationReminderText(habit, log)
    : habit.reminderEnabled && habit.reminderTime
    ? `Reminder ${formatTime12h(habit.reminderTime)}`
    : null;

  return (
    <SwipeableHabitTile
      habit={habit}
      done={done}
      subtitle={subtitle}
      reminderText={reminderText}
      onPress={() => router.push(`/habit/${habit.id}`)}
    />
  );
}

// Assumes doses are taken in schedule order, since only a daily total is
// logged, not which specific time slot - the same assumption the calendar
// screen's per-time tick marks make (see medicine-calendar.tsx).
function getMedicationReminderText(habit: Habit, log: DailyLog | undefined): string | null {
  const times = getTodayDoseTimes({
    dosageFrequency: habit.dosageFrequency,
    durationType: habit.durationType,
    startTime: habit.reminderTime ?? "08:00",
  });
  if (times.length === 0) return null;
  const doneCount = log?.amount ?? 0;
  const nextTime = times[doneCount];
  return nextTime ? `Next med at ${formatTime12h(nextTime)}` : "All doses taken today";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  brandText: { ...brandFont, fontSize: 34 },
  brandActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { ...typography.title, fontSize: 20 },
  date: { ...typography.caption, marginBottom: spacing.md },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryTitle: { ...typography.body, fontWeight: "700" },
  summaryCount: { ...typography.body, color: colors.accentPink, fontWeight: "700" },
  summaryCaption: { ...typography.caption },
  emptyTitle: { ...typography.body, fontWeight: "700", marginBottom: 4 },
  emptyBody: { ...typography.caption },
});
