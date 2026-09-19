import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useStore } from "../lib/store";
import { summaryColors } from "../lib/summaryTheme";
import { colors, typography } from "../lib/theme";
import { buildUpcomingTasks } from "../lib/upcomingTasks";
import { useMinuteClock } from "../lib/useMinuteClock";
import { DashboardTile } from "./DashboardTile";

// A compact tile on Today, like the Habits one: just the title and how many tasks
// are open. The whole tile is the button; it opens the full list (app/upcoming-tasks.tsx).
export function UpcomingTasksTile() {
  const habits = useStore((s) => s.habits);
  const logsByHabit = useStore((s) => s.logsByHabit);
  const { today, nowMinutes } = useMinuteClock();

  const count = useMemo(
    () => buildUpcomingTasks({ habits, logsByHabit, today, nowMinutes }).length,
    [habits, logsByHabit, today, nowMinutes]
  );

  const label = count === 0 ? "Upcoming Tasks. Nothing left. Opens the list." : `Upcoming Tasks. ${count} to do. Opens the list.`;

  return (
    <DashboardTile watermark="notifications" onPress={() => router.push("/upcoming-tasks")} accessibilityLabel={label}>
      <View style={styles.titleGroup}>
        <Ionicons name="notifications-outline" size={20} color={colors.accentPink} />
        <Text style={styles.title}>Upcoming Tasks</Text>
        {count > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count}</Text>
          </View>
        ) : null}
      </View>
    </DashboardTile>
  );
}

const styles = StyleSheet.create({
  titleGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { ...typography.screenTitle, fontSize: 18, ...summaryColors.textShadow },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: colors.accentPink },
  badgeText: { color: colors.background, fontSize: 12, fontWeight: "800" },
});
