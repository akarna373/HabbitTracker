import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackgroundPickerSheet } from "../components/BackgroundPickerSheet";
import { Card } from "../components/Card";
import { EasterEggTick } from "../components/EasterEggTick";
import { GoalProgressBar } from "../components/GoalProgressBar";
import { SummaryBackground } from "../components/SummaryBackground";
import { PrimaryButton } from "../components/PrimaryButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { formatLongDateForCalendar } from "../lib/calendarSettings";
import { formatMoneyCompact } from "../lib/currency";
import { computeGoalProgress, type HabitFinancialBreakdown } from "../lib/financialSummary";
import { useFinancialSummary } from "../lib/financialSummarySelectors";
import { useStore } from "../lib/store";
import { SUMMARY_CARD_RADIUS, summaryColors } from "../lib/summaryTheme";
import { colors, radii, spacing, typography } from "../lib/theme";

const EMPTY_MESSAGE = "Add cost details to a habit to discover how much you are saving.";

export default function TodaySummaryScreen() {
  const summary = useFinancialSummary();
  const calendarType = useStore((s) => s.calendarType);
  const monthlyGoal = useStore((s) => s.financialSettings.monthlyGoal);
  const goal = summary.hasSufficientData ? computeGoalProgress(summary.savedThisMonth, monthlyGoal) : null;

  const openGoalEditor = () => router.push("/summary-goal");

  // Easter egg: tapping the green tick three times opens the background chooser.
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Today’s Summary" subtitle="Your savings and spending, from the days you've logged." />
      <ScrollView contentContainerStyle={styles.content}>
        {summary.hasSufficientData ? (
          <>
            <View style={styles.hero}>
              <SummaryBackground />
              <View style={styles.heroContent}>
                <Text style={styles.heroLabel}>Potential savings remaining today</Text>
                <Text style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {formatMoneyCompact(summary.potentialSavingsRemainingToday)}
                </Text>
                <Text style={styles.heroCaption}>
                  What is still there to save today, measured against your original baseline. It goes down as you log, and
                  becomes a real saving when the day ends.
                </Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>TODAY</Text>
            <Card>
              <StatRow
                icon="checkmark-circle"
                iconElement={<EasterEggTick color={summaryColors.saved} onUnlock={() => setPickerOpen(true)} />}
                iconColor={summaryColors.saved}
                label="Saved today (so far)"
                caption={
                  summary.savedToday > 0
                    ? "Provisional - final when the day ends"
                    : "Log today to see it; final when the day ends"
                }
                value={formatMoneyCompact(summary.savedToday)}
                valueColor={summaryColors.saved}
              />
              <View style={styles.rowDivider} />
              <StatRow
                icon="cash-outline"
                iconColor={summaryColors.spent}
                label="Today’s spending"
                caption="What today's logs cost"
                value={formatMoneyCompact(summary.spentToday)}
                valueColor={summaryColors.spent}
              />
            </Card>

            <Text style={styles.sectionLabel}>THIS MONTH</Text>
            <Text style={styles.monthRange}>
              {formatLongDateForCalendar(summary.monthStart, calendarType)} - {formatLongDateForCalendar(summary.monthEnd, calendarType)}
            </Text>
            <Card>
              <View style={styles.monthRow}>
                <View style={styles.monthCol}>
                  <View style={styles.monthLabelRow}>
                    <Ionicons name="trending-up" size={16} color={summaryColors.saved} />
                    <Text style={styles.monthLabel}>Saved this month</Text>
                  </View>
                  <Text style={[styles.monthValue, { color: summaryColors.saved }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    {formatMoneyCompact(summary.savedThisMonth)}
                  </Text>
                </View>
                <View style={styles.monthCol}>
                  <View style={styles.monthLabelRow}>
                    <Ionicons name="cash-outline" size={16} color={summaryColors.spent} />
                    <Text style={styles.monthLabel}>Spent this month</Text>
                  </View>
                  <Text style={[styles.monthValue, { color: summaryColors.spent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                    {formatMoneyCompact(summary.spentThisMonth)}
                  </Text>
                </View>
              </View>
            </Card>

            <Text style={styles.sectionLabel}>MONTHLY GOAL</Text>
            <Card highlighted={goal?.completed}>
              {goal ? (
                <>
                  <View style={styles.goalHeader}>
                    {goal.completed ? (
                      <View style={styles.goalTitleGroup}>
                        <Ionicons name="checkmark-circle" size={18} color={summaryColors.saved} />
                        <Text style={[styles.goalTitle, { color: summaryColors.saved }]}>Goal reached</Text>
                      </View>
                    ) : (
                      <View style={styles.goalTitleGroup}>
                        <Ionicons name="flag-outline" size={17} color={colors.textSecondary} />
                        <Text style={styles.goalTitle}>Your goal</Text>
                      </View>
                    )}
                    <Text style={styles.goalPercent}>{goal.displayPercent}%</Text>
                  </View>
                  <Text style={styles.goalAmounts}>
                    {formatMoneyCompact(goal.saved)} / {formatMoneyCompact(goal.goal)}
                  </Text>
                  <GoalProgressBar percent={goal.percent} height={12} />
                  <Text style={styles.goalCaption}>
                    {goal.completed
                      ? goal.exceededBy > 0
                        ? `You've saved ${formatMoneyCompact(goal.exceededBy)} beyond your goal this month.`
                        : "You've saved your goal amount this month."
                      : `${formatMoneyCompact(goal.remaining)} more in savings to reach it.`}
                  </Text>
                  <PrimaryButton title="Edit goal" variant="outline" size="small" onPress={openGoalEditor} />
                </>
              ) : (
                <>
                  <Text style={styles.goalTitle}>No monthly goal yet</Text>
                  <Text style={styles.goalCaption}>Pick an amount to aim for and watch your savings fill it.</Text>
                  <PrimaryButton title="Set a monthly goal" onPress={openGoalEditor} style={styles.goalButton} />
                </>
              )}
            </Card>

            <Text style={styles.sectionLabel}>BY HABIT</Text>
            {summary.habits.map((habit) => (
              <HabitBreakdownCard key={habit.habitId} habit={habit} />
            ))}
          </>
        ) : (
          <Card>
            <View style={styles.emptyRow}>
              <Ionicons name="wallet-outline" size={22} color={colors.accentPink} />
              <Text style={styles.emptyTitle}>Nothing to add up yet</Text>
            </View>
            <Text style={styles.cardCaption}>{EMPTY_MESSAGE}</Text>
          </Card>
        )}

        <Text style={styles.sectionLabel}>HOW THIS IS COUNTED</Text>
        <Card>
          <Text style={styles.explainTitle}>A saving is earned when its day ends</Text>
          <Text style={styles.explainBody}>
            Each day is compared with the baseline you set up: baseline quantity x price, minus what you logged x price.
            Today's figure is provisional; once the date changes it is final and joins this month's total.
          </Text>
          <Text style={styles.explainBody}>
            A day with no log is unknown - it adds nothing to savings or spending. Logging 0 marks a clean day and earns
            the full baseline cost. Spending above your baseline is always counted, but it never takes away savings from
            other days.
          </Text>
        </Card>
      </ScrollView>
      <BackgroundPickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} />
    </SafeAreaView>
  );
}

function StatRow(props: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  iconElement?: ReactNode; // replaces the plain icon
  iconColor: string;
  label: string;
  caption: string;
  value: string;
  valueColor: string;
}) {
  return (
    <View style={styles.statRow}>
      {props.iconElement ?? <Ionicons name={props.icon} size={22} color={props.iconColor} />}
      <View style={styles.statText}>
        <Text style={styles.statLabel}>{props.label}</Text>
        <Text style={styles.cardCaption}>{props.caption}</Text>
      </View>
      <Text style={[styles.statValue, { color: props.valueColor }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {props.value}
      </Text>
    </View>
  );
}

function HabitBreakdownCard({ habit }: { habit: HabitFinancialBreakdown }) {
  const days = habit.loggedDaysThisMonth;
  let status: { text: string; color: string } | null = null;
  if (habit.scheduledToday) {
    status = habit.hasLogToday
      ? { text: "Logged today", color: summaryColors.saved }
      : { text: "Not logged yet today", color: colors.textSecondary };
  }

  return (
    <Card>
      <View style={styles.habitHeader}>
        <Text style={styles.habitName} numberOfLines={1}>
          {habit.archived ? `${habit.name} (archived)` : habit.name}
        </Text>
        {status ? <Text style={[styles.habitStatus, { color: status.color }]}>{status.text}</Text> : null}
      </View>
      <DetailRow label="Normal daily cost" value={formatMoneyCompact(habit.normalDailyCost)} />
      <DetailRow label="Logged spending this month" value={formatMoneyCompact(habit.spentThisMonth)} color={summaryColors.spent} />
      <DetailRow label="Saved this month (finished days)" value={formatMoneyCompact(habit.savedThisMonth)} color={summaryColors.saved} />
      <DetailRow label="Days logged" value={`${days} ${days === 1 ? "day" : "days"}`} />
    </Card>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, color ? { color } : null]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  hero: { borderRadius: SUMMARY_CARD_RADIUS, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,79,139,0.45)", backgroundColor: "#141026" },
  heroContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.lg },
  heroLabel: { color: summaryColors.textDim, fontSize: 13, fontWeight: "600", letterSpacing: 0.3, ...summaryColors.textShadow },
  heroValue: { color: summaryColors.text, fontSize: 44, fontWeight: "800", marginTop: 2, ...summaryColors.textShadow },
  heroCaption: { color: summaryColors.textDim, fontSize: 13, lineHeight: 19, marginTop: spacing.sm, ...summaryColors.textShadow },
  sectionLabel: { ...typography.label, marginTop: spacing.lg, marginBottom: spacing.sm },
  monthRange: { ...typography.caption, marginTop: -spacing.xs, marginBottom: spacing.sm },
  statRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  statText: { flex: 1, minWidth: 0 },
  statLabel: { ...typography.body, fontWeight: "700" },
  statValue: { fontSize: 20, fontWeight: "800", maxWidth: "38%" },
  rowDivider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },
  cardCaption: { ...typography.caption, marginTop: 2 },
  monthRow: { flexDirection: "row", gap: spacing.md },
  monthCol: { flex: 1, minWidth: 0 },
  monthLabelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  monthLabel: { ...typography.caption, fontWeight: "600", flexShrink: 1 },
  monthValue: { fontSize: 26, fontWeight: "800" },
  goalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  goalTitleGroup: { flexDirection: "row", alignItems: "center", gap: 6 },
  goalTitle: { ...typography.body, fontWeight: "700" },
  goalPercent: { ...typography.body, fontWeight: "800", color: summaryColors.saved },
  goalAmounts: { ...typography.body, marginTop: 4, marginBottom: spacing.sm },
  goalCaption: { ...typography.caption, marginTop: spacing.sm },
  goalButton: { marginTop: spacing.md, marginBottom: 0 },
  habitHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm, gap: spacing.sm },
  habitName: { ...typography.body, fontWeight: "700", flexShrink: 1 },
  habitStatus: { fontSize: 12, fontWeight: "700" },
  detailRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 5, gap: spacing.sm },
  detailLabel: { ...typography.caption, flexShrink: 1 },
  detailValue: { ...typography.body, fontWeight: "700", flexShrink: 0 },
  emptyRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.xs },
  emptyTitle: { ...typography.body, fontWeight: "700" },
  explainTitle: { ...typography.body, fontWeight: "700", marginBottom: spacing.xs },
  explainBody: { ...typography.caption, lineHeight: 19, marginTop: spacing.xs },
});
