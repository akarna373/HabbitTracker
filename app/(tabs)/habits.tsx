import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/Card";
import { ListRow } from "../../components/ListRow";
import { useStore } from "../../lib/store";
import { colors, spacing, typography } from "../../lib/theme";

export default function HabitsScreen() {
  const habits = useStore((s) => s.habits);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <FlatList
        data={habits}
        keyExtractor={(h) => h.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Your habits</Text>
            <Text style={styles.subtitle}>A routine that fits your life.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={`${item.kind === "good" ? "Build" : "Quit"} - ${
              item.hasCost ? "Quantity and cost" : `${item.targetAmount ?? ""} ${item.unit ?? ""}`.trim()
            } - ${frequencyLabel(item.frequencyType)}`}
            onPress={() => router.push(`/habit/${item.id}`)}
          />
        )}
        ListFooterComponent={
          habits.length ? (
            <Card>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total habits</Text>
                <Text style={styles.totalValue}>{habits.length}</Text>
              </View>
            </Card>
          ) : (
            <Card>
              <Text style={styles.emptyTitle}>No habits yet</Text>
              <Text style={styles.emptyBody}>Add one from the Today tab.</Text>
            </Card>
          )
        }
      />
      <Pressable style={styles.fab} onPress={() => router.push("/add-activity")}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </SafeAreaView>
  );
}

function frequencyLabel(freq: string): string {
  if (freq === "daily") return "Every day";
  if (freq === "weekdays") return "Weekdays";
  if (freq === "weekly") return "Weekly";
  return "Custom";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  title: { ...typography.title, marginTop: spacing.md },
  subtitle: { ...typography.caption, marginBottom: spacing.md },
  totalRow: { flexDirection: "row", justifyContent: "space-between" },
  totalLabel: { ...typography.body, fontWeight: "700" },
  totalValue: { ...typography.body, color: colors.accentPink, fontWeight: "700" },
  emptyTitle: { ...typography.body, fontWeight: "700", marginBottom: 4 },
  emptyBody: { ...typography.caption },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentPink,
    alignItems: "center",
    justifyContent: "center",
  },
  fabText: { fontSize: 28, color: colors.background, fontWeight: "700", marginTop: -2 },
});
