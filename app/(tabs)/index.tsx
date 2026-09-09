import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/Card";
import { ProfileBadge } from "../../components/ProfileBadge";
import { ProgressBar } from "../../components/ProgressBar";
import { formatLongDate, todayISO } from "../../lib/dates";
import { formatTime12h, isHabitCompleteOn } from "../../lib/progress";
import { useStore } from "../../lib/store";
import { colors, spacing, typography } from "../../lib/theme";
import type { Habit } from "../../lib/types";

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
            <View style={styles.headerRow}>
              <View style={styles.headerTextCol}>
                <Text style={styles.title}>A little better, daily.</Text>
                <Text style={styles.date}>{formatLongDate(today)}</Text>
              </View>
              <ProfileBadge />
            </View>

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
        renderItem={({ item }) => <HabitCard habit={item} />}
        ListEmptyComponent={
          <Card>
            <Text style={styles.emptyTitle}>No habits yet</Text>
            <Text style={styles.emptyBody}>Tap + to add your first small change.</Text>
          </Card>
        }
      />

      <Pressable style={styles.fab} onPress={() => router.push("/add-activity")}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function HabitCard({ habit }: { habit: Habit }) {
  const logsByHabit = useStore((s) => s.logsByHabit);
  const logs = logsByHabit[habit.id];
  const today = todayISO();
  const log = logs?.find((l) => l.date === today);
  const done = isHabitCompleteOn(habit, logs, today);

  let subtitle = "";
  if (habit.kind === "quit") {
    subtitle = log
      ? `${log.amount} ${habit.unit ?? ""} logged today`
      : "Check in this evening";
  } else if (habit.trackingMethod === "amount") {
    subtitle = `${log?.amount ?? 0} / ${habit.targetAmount ?? "?"} ${habit.unit ?? ""}`;
  } else {
    subtitle = done ? "Checked in" : "Not checked in yet";
  }

  return (
    <Card onPress={() => router.push(`/habit/${habit.id}`)} highlighted={done}>
      <Text style={styles.habitName}>{habit.name}</Text>
      <Text style={styles.habitSubtitle}>{subtitle}</Text>
      {habit.reminderEnabled && habit.reminderTime ? (
        <Text style={styles.habitReminder}>Reminder {formatTime12h(habit.reminderTime)}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: spacing.md,
  },
  headerTextCol: { flexShrink: 1, paddingRight: spacing.sm },
  title: { ...typography.title },
  date: { ...typography.caption, marginBottom: spacing.md },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryTitle: { ...typography.body, fontWeight: "700" },
  summaryCount: { ...typography.body, color: colors.accentPink, fontWeight: "700" },
  summaryCaption: { ...typography.caption },
  habitName: { ...typography.body, fontWeight: "700", marginBottom: 2 },
  habitSubtitle: { ...typography.caption },
  habitReminder: { ...typography.caption, color: colors.softAccent, marginTop: 2 },
  emptyTitle: { ...typography.body, fontWeight: "700", marginBottom: 4 },
  emptyBody: { ...typography.caption },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentPink,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accentPink,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 6,
  },
  fabText: { fontSize: 28, color: colors.background, fontWeight: "700", marginTop: -2 },
});
