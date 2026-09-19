import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { isHabitCompleteOn } from "../lib/progress";
import { useStore } from "../lib/store";
import { useMinuteClock } from "../lib/useMinuteClock";
import { summaryColors } from "../lib/summaryTheme";
import { colors, typography } from "../lib/theme";
import { DashboardTile } from "./DashboardTile";

// One compact tile standing in for the old list of habit tiles on Today: title and
// how many are done. The whole tile is the button; it opens the Habits tab.
export function HabitsTile() {
  const habits = useStore((s) => s.habits);
  const logsByHabit = useStore((s) => s.logsByHabit);
  const { today } = useMinuteClock();

  const total = habits.length;
  const done = habits.filter((h) => isHabitCompleteOn(h, logsByHabit[h.id], today)).length;

  const label =
    total === 0
      ? "Habits. No habits yet. Opens your habits."
      : `Habits. ${done} of ${total} done today. Opens your habits.`;

  return (
    <DashboardTile watermark="checkmark-done" onPress={() => router.navigate("/habits")} accessibilityLabel={label}>
      <View style={styles.titleRow}>
        <Ionicons name="checkmark-done-circle-outline" size={20} color={colors.accentPink} />
        <Text style={styles.title}>Habits</Text>
        <Text style={styles.count} numberOfLines={1}>
          {total === 0 ? "none yet" : `${done} of ${total} done`}
        </Text>
      </View>
      {total === 0 ? <Text style={styles.caption}>Tap + to add your first</Text> : null}
    </DashboardTile>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { ...typography.screenTitle, fontSize: 18, ...summaryColors.textShadow },
  count: { ...typography.caption, color: summaryColors.textDim, flexShrink: 1 },
  caption: { ...typography.caption, marginTop: 6, color: summaryColors.textDim },
});
