import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../../components/Card";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { addDays, todayISO } from "../../../lib/dates";
import { baselineCost, costForAmount, estimatedSavingsThisWeek, smokeFreeDaysThisWeek } from "../../../lib/progress";
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
  const baseline = baselineCost(habit);
  const diffFromBaseline = baseline - cost;
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
          <Text style={styles.cardBody}>Rs {cost.toFixed(0)} spent</Text>
          <Text style={styles.cardCaption}>
            {diffFromBaseline >= 0
              ? `Rs ${diffFromBaseline.toFixed(0)} below your daily baseline`
              : `Rs ${Math.abs(diffFromBaseline).toFixed(0)} above your daily baseline`}
          </Text>
        </Card>

        <Card>
          <Text style={styles.cardTitle}>This week</Text>
          <Text style={styles.cardBody}>{smokeFreeDays} smoke-free days</Text>
          <Text style={styles.cardCaption}>Rs {savings.toFixed(0)} estimated savings</Text>
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
