import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HabitsTile } from "../../components/HabitsTile";
import { HeaderMenu } from "../../components/HeaderMenu";
import { ProfileBadge } from "../../components/ProfileBadge";
import { SpeedDialFab } from "../../components/SpeedDialFab";
import { SummaryDashboardCard } from "../../components/SummaryDashboardCard";
import { UpcomingTasksTile } from "../../components/UpcomingTasksTile";
import { formatLongDate } from "../../lib/dates";
import { useMinuteClock } from "../../lib/useMinuteClock";
import { brandFont, colors, spacing, typography } from "../../lib/theme";

// Today is a fixed screen - it never scrolls. The summary card takes its natural
// height; the two tiles below (Habits, Upcoming Tasks) share whatever is left, the
// second one filling it. The + button floats at the bottom-right corner, as it
// always has; the Upcoming Tasks tile keeps its text clear of it.
export default function TodayScreen() {
  const { today } = useMinuteClock();

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.page}>
        <View style={styles.brandRow}>
          <Text style={styles.brandText}>Habbit</Text>
          <View style={styles.brandActions}>
            <ProfileBadge />
            <HeaderMenu />
          </View>
        </View>

        <Text style={styles.title}>A little better, daily.</Text>
        <Text style={styles.date}>{formatLongDate(today)}</Text>

        <SummaryDashboardCard />

        <View style={styles.tiles}>
          <HabitsTile />
          <UpcomingTasksTile />
        </View>
      </View>

      <SpeedDialFab />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1, paddingHorizontal: spacing.lg },
  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  brandText: { ...brandFont, fontSize: 34 },
  brandActions: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  title: { ...typography.title, fontSize: 20 },
  date: { ...typography.caption, marginBottom: spacing.sm },
  // Both tiles live here, 10 dp apart; the second stretches to the bottom.
  tiles: { flex: 1, gap: 10, paddingBottom: spacing.sm },
});
