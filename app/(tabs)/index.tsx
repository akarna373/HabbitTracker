import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HabitsTile } from "../../components/HabitsTile";
import { HeaderMenu } from "../../components/HeaderMenu";
import { ProfileBadge } from "../../components/ProfileBadge";
import { SpeedDialFab } from "../../components/SpeedDialFab";
import { SummaryDashboardCard } from "../../components/SummaryDashboardCard";
import { UpcomingTasksTile } from "../../components/UpcomingTasksTile";
import { formatLongDateForCalendar } from "../../lib/calendarSettings";
import { useStore } from "../../lib/store";
import { useMinuteClock } from "../../lib/useMinuteClock";
import { brandFont, colors, spacing, typography } from "../../lib/theme";

// Today is a fixed screen - it never scrolls. The summary card and the two compact
// tiles below it (Habits, Upcoming Tasks) each take their natural height; each tile
// opens its own screen. The + button floats at the bottom-right corner.
export default function TodayScreen() {
  const { today } = useMinuteClock();
  // Nepal (device region NP, or chosen in Settings) gets the Bikram Sambat date in
  // Nepali; everywhere else the English date.
  const calendarType = useStore((s) => s.calendarType);

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
        <Text style={styles.date}>{formatLongDateForCalendar(today, calendarType)}</Text>

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
  // Both tiles live here, 10 dp apart.
  tiles: { flex: 1, gap: 10, paddingBottom: spacing.sm },
});
