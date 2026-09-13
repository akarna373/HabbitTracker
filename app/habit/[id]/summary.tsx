import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../../components/Card";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { formatMoney } from "../../../lib/currency";
import { addDays, todayISO } from "../../../lib/dates";
import {
  baselineCost,
  costForAmount,
  estimatedSavingsThisWeek,
  reduceCycleDay,
  reduceDailyTarget,
  REDUCE_CYCLE_DAYS,
  smokeFreeDaysThisWeek,
} from "../../../lib/progress";
import { selectLogForDate, useStore } from "../../../lib/store";
import { colors, spacing, typography } from "../../../lib/theme";

export default function SmokingSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useStore((s) => s.habits.find((h) => h.id === id));
  const logs = useStore((s) => s.logsByHabit[id ?? ""]);

  if (!habit) return null;

  const today = todayISO();
  const yesterday = addDays(today, -1);
  const todayAmount = selectLogForDate(logs, today)?.amount ?? 0;
  const yesterdayLog = selectLogForDate(logs, yesterday);
  const cost = costForAmount(habit, todayAmount);
  const isReduce = habit.goalType === "reduce";
  const day = reduceCycleDay(habit);
  // A "reduce" habit compares against that day's declining target instead
  // of the flat baseline forever - matches app/habit/[id]/index.tsx.
  const compareCost = isReduce ? costForAmount(habit, reduceDailyTarget(habit)) : baselineCost(habit);
  const diffFromBaseline = compareCost - cost;
  const compareLabel = isReduce ? "today's target" : "your daily baseline";
  const smokeFreeDays = smokeFreeDaysThisWeek(habit, logs);
  const savings = estimatedSavingsThisWeek(habit, logs);

  let comparisonText: string;
  if (yesterdayLog === undefined) {
    comparisonText = "No comparison yet - check in again tomorrow.";
  } else if (todayAmount < yesterdayLog.amount) {
    comparisonText = `You smoked ${yesterdayLog.amount - todayAmount} less than yesterday`;
  } else if (todayAmount === yesterdayLog.amount) {
    comparisonText = "Same as yesterday - steady counts too";
  } else {
    comparisonText = `${todayAmount - yesterdayLog.amount} more than yesterday - tomorrow is a fresh start`;
  }

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Your 10 PM summary" subtitle="A factual, supportive reflection." />
      <ScrollView contentContainerStyle={styles.content}>
        <Card highlighted>
          {isReduce ? <Text style={styles.cardCaption}>DAY {day} OF {REDUCE_CYCLE_DAYS}</Text> : null}
          <Text style={styles.cardTitle}>
            Today: {todayAmount} {habit.unit}
          </Text>
          {yesterdayLog !== undefined ? (
            <Text style={styles.cardBody}>Yesterday: {yesterdayLog.amount}</Text>
          ) : null}
          <Text style={styles.cardCaption}>{comparisonText}</Text>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Today's spending</Text>
          <Text style={styles.cardBody}>{formatMoney(cost)} spent</Text>
          <Text style={styles.cardCaption}>
            {diffFromBaseline >= 0
              ? `${formatMoney(diffFromBaseline)} below ${compareLabel}`
              : `${formatMoney(Math.abs(diffFromBaseline))} above ${compareLabel}`}
          </Text>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>This week</Text>
          <Text style={styles.cardBody}>{smokeFreeDays} smoke-free days</Text>
          <Text style={styles.cardCaption}>{formatMoney(savings)} estimated savings</Text>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>Tomorrow's next step</Text>
          <Text style={styles.cardBody}>Delay the first one by 15 minutes</Text>
          <Text style={styles.cardCaption}>Try one urge microtask first</Text>
        </Card>

        <PrimaryButton title="Done" onPress={() => router.back()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  cardTitle: { ...typography.body, fontWeight: "700", marginBottom: 4 },
  cardBody: { ...typography.body },
  cardCaption: { ...typography.caption, marginTop: 2 },
});
