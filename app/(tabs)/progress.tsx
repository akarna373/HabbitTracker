import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/Card";
import { formatMoney } from "../../lib/currency";
import { weekdayLetter } from "../../lib/dates";
import {
  computeStreak,
  estimatedSavingsThisWeek,
  smokeFreeDaysThisWeek,
  totalAmountThisWeek,
  weeklyCompletion,
} from "../../lib/progress";
import { useStore } from "../../lib/store";
import { formatFreeDays } from "../../lib/templates";
import { colors, spacing, typography } from "../../lib/theme";
import type { Habit } from "../../lib/types";

export default function ProgressScreen() {
  const habits = useStore((s) => s.habits);
  const logsByHabit = useStore((s) => s.logsByHabit);

  const thisWeek = weeklyCompletion(habits, logsByHabit, 0);
  const lastWeek = weeklyCompletion(habits, logsByHabit, 1);
  const thisPct = thisWeek.total ? Math.round((thisWeek.completed / thisWeek.total) * 100) : 0;
  const lastPct = lastWeek.total ? Math.round((lastWeek.completed / lastWeek.total) * 100) : 0;
  const trend = thisPct - lastPct;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={habits}
        keyExtractor={(h) => h.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>See your small wins</Text>
            <Text style={styles.subtitle}>This week</Text>

            <Card highlighted>
              <Text style={styles.cardTitle}>Weekly completion</Text>
              <Text style={styles.cardBody}>
                {thisWeek.completed} of {thisWeek.total} check-ins
              </Text>
              <Text style={styles.cardCaption}>
                {thisPct}% {trend >= 0 ? `- up ${trend}% from last week` : `- down ${Math.abs(trend)}% from last week`}
              </Text>
            </Card>

            <Text style={styles.sectionLabel}>LAST 7 DAYS</Text>
            <View style={styles.barsRow}>
              {thisWeek.perDay.map((day) => (
                <View key={day.date} style={styles.barCol}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: 8 + (day.total ? (day.completed / day.total) * 48 : 0),
                        backgroundColor: day.date === thisWeek.perDay[6].date ? colors.accentPink : colors.border,
                      },
                    ]}
                  />
                  <Text style={styles.barLabel}>{weekdayLetter(day.date)}</Text>
                </View>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => <HabitProgressCard habit={item} />}
        ListEmptyComponent={
          <Card>
            <Text style={styles.cardBody}>No habits yet. Create one to see progress here.</Text>
          </Card>
        }
      />
    </SafeAreaView>
  );
}

function HabitProgressCard({ habit }: { habit: Habit }) {
  const logsByHabit = useStore((s) => s.logsByHabit);
  const logs = logsByHabit[habit.id];

  if (habit.kind === "quit" && habit.hasCost) {
    const smokeFreeDays = smokeFreeDaysThisWeek(habit, logs);
    const savings = estimatedSavingsThisWeek(habit, logs);
    return (
      <Card>
        <Text style={styles.habitName}>{habit.name}</Text>
        <Text style={styles.cardBody}>{formatFreeDays(smokeFreeDays, habit.templateId)}</Text>
        <Text style={styles.cardCaption}>{formatMoney(savings)} estimated savings</Text>
      </Card>
    );
  }

  const totalAmount = totalAmountThisWeek(logs);
  const streak = computeStreak(habit, logs);
  return (
    <Card>
      <Text style={styles.habitName}>{habit.name}</Text>
      <Text style={styles.cardBody}>
        {totalAmount} {habit.unit ?? ""} completed
      </Text>
      <Text style={styles.cardCaption}>Longest streak: {streak} days</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  title: { ...typography.title, marginTop: spacing.md },
  subtitle: { ...typography.caption, marginBottom: spacing.md },
  cardTitle: { ...typography.body, fontWeight: "700", marginBottom: 4 },
  cardBody: { ...typography.body },
  cardCaption: { ...typography.caption, marginTop: 2 },
  sectionLabel: { ...typography.label, marginTop: spacing.md, marginBottom: spacing.sm },
  barsRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginBottom: spacing.md },
  barCol: { alignItems: "center", width: 28 },
  bar: { width: 12, borderRadius: 6 },
  barLabel: { ...typography.caption, marginTop: 4 },
  habitName: { ...typography.body, fontWeight: "700", marginBottom: 2 },
});
