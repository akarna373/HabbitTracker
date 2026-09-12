import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../components/Card";
import { confirmDialog } from "../components/ConfirmDialog";
import { ScreenHeader } from "../components/ScreenHeader";
import { formatLongDate } from "../lib/dates";
import { useStore } from "../lib/store";
import { colors, spacing, typography } from "../lib/theme";
import type { Habit } from "../lib/types";

export default function ArchivedHabitsScreen() {
  const archivedHabits = useStore((s) => s.archivedHabits);
  const restoreHabit = useStore((s) => s.restoreHabit);
  const deleteHabit = useStore((s) => s.deleteHabit);

  const confirmDelete = (habit: Habit) => {
    confirmDialog("Delete forever?", `This permanently removes "${habit.name}" and its history. This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete forever", style: "destructive", onPress: () => deleteHabit(habit.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Archived habits" subtitle="Restore a habit or remove it for good." />
      <ScrollView contentContainerStyle={styles.content}>
        {archivedHabits.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>Nothing archived</Text>
            <Text style={styles.emptyBody}>Habits you archive from Today show up here.</Text>
          </Card>
        ) : (
          archivedHabits.map((habit) => (
            <Card key={habit.id}>
              <Text style={styles.habitName}>{habit.name}</Text>
              <Text style={styles.habitSubtitle}>
                Archived {habit.archivedAt ? formatLongDate(habit.archivedAt.slice(0, 10)) : ""}
              </Text>
              <View style={styles.actionRow}>
                <Pressable style={styles.restoreButton} onPress={() => restoreHabit(habit.id)}>
                  <Text style={styles.restoreText}>Restore</Text>
                </Pressable>
                <Pressable style={styles.deleteButton} onPress={() => confirmDelete(habit)}>
                  <Text style={styles.deleteText}>Delete forever</Text>
                </Pressable>
              </View>
            </Card>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  emptyTitle: { ...typography.body, fontWeight: "700", marginBottom: 4 },
  emptyBody: { ...typography.caption },
  habitName: { ...typography.body, fontWeight: "700", marginBottom: 2 },
  habitSubtitle: { ...typography.caption },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  restoreButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.accentPink,
    // A literal transparent/absent background can make Android only hit-test
    // painted child content, not the full button - keep a near-invisible
    // real background so the whole button is tappable.
    backgroundColor: "rgba(11,10,15,0.01)",
  },
  restoreText: { ...typography.caption, color: colors.accentPink, fontWeight: "700" },
  deleteButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "rgba(11,10,15,0.01)",
  },
  deleteText: { ...typography.caption, color: colors.accentRed, fontWeight: "700" },
});
