import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { isHabitCompleteOn } from "../lib/progress";
import { useStore } from "../lib/store";
import { useMinuteClock } from "../lib/useMinuteClock";
import { summaryColors } from "../lib/summaryTheme";
import { colors, typography } from "../lib/theme";
import { BubbleTile } from "./BubbleTile";
import { ProgressBar } from "./ProgressBar";

// One compact tile standing in for the old list of habit tiles on Today. Text and
// the progress bar stay in the left part; the right part is kept clear for the
// bubbles, with the chevron at its far edge. Opens the Habits tab.
// Space kept free on the right for the bubbles (the chevron sits just left of it).
const GUTTER = 76;

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
    <BubbleTile variant={0} onPress={() => router.navigate("/habits")} accessibilityLabel={label} rightGutter={GUTTER} bubbleZone={{ fraction: 0.28 }}>
      <View style={styles.row}>
        <View style={styles.left}>
          <View style={styles.titleRow}>
            <Ionicons name="checkmark-done-circle-outline" size={20} color={colors.accentPink} />
            <Text style={styles.title}>Habits</Text>
            <Text style={styles.count} numberOfLines={1}>
              {total === 0 ? "none yet" : `${done} of ${total} done`}
            </Text>
          </View>
          {total === 0 ? (
            <Text style={styles.caption}>Tap + to add your first</Text>
          ) : (
            <ProgressBar progress={done / total} color={summaryColors.saved} style={styles.bar} />
          )}
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.accentPink} />
      </View>
    </BubbleTile>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  left: { flex: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { ...typography.screenTitle, fontSize: 18, ...summaryColors.textShadow },
  count: { ...typography.caption, color: summaryColors.textDim, flexShrink: 1 },
  bar: { marginTop: 8, height: 6, backgroundColor: "rgba(255,255,255,0.14)" },
  caption: { ...typography.caption, marginTop: 6, color: summaryColors.textDim },
});
