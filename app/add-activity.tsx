import { router } from "expo-router";
import { useEffect } from "react";
import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../components/Card";
import { ListRow } from "../components/ListRow";
import { ScreenHeader } from "../components/ScreenHeader";
import { useDraftStore } from "../lib/draftStore";
import { colors, spacing, typography } from "../lib/theme";

export default function AddActivityScreen() {
  const reset = useDraftStore((s) => s.reset);

  useEffect(() => {
    reset();
  }, [reset]);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Make room for progress" subtitle="What would you like to add?" />
      <ScrollView contentContainerStyle={styles.content}>
        <ListRow
          title="Habit"
          subtitle="Build a routine or leave a habit behind"
          onPress={() => router.push("/habit/categories")}
        />
        <ListRow title="Recurring task" subtitle="Repeat something on a schedule" disabled showChevron={false} />
        <ListRow title="Task" subtitle="One thing to get done" disabled showChevron={false} />

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>Current release</Text>
          <Text style={styles.infoBody}>Habit creation is enabled first.</Text>
          <Text style={styles.infoBody}>Tasks are planned for a later version.</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  infoCard: { marginTop: spacing.md },
  infoTitle: { ...typography.body, fontWeight: "700", marginBottom: 4 },
  infoBody: { ...typography.caption },
});
