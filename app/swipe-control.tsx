import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../components/Card";
import { ScreenHeader } from "../components/ScreenHeader";
import { useStore } from "../lib/store";
import { colors, spacing, typography } from "../lib/theme";

export default function SwipeControlScreen() {
  const swipeSettings = useStore((s) => s.swipeSettings);
  const setSwipeSettings = useStore((s) => s.setSwipeSettings);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Swipe Control" subtitle="Choose what swiping a habit tile can do." />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <View style={styles.row}>
            <View style={styles.textCol}>
              <Text style={styles.rowTitle}>Swipe to archive</Text>
              <Text style={styles.rowSubtitle}>Swipe a tile right to reveal Archive</Text>
            </View>
            <Switch
              value={swipeSettings.archiveEnabled}
              onValueChange={(value) => setSwipeSettings({ archiveEnabled: value })}
              trackColor={{ false: colors.border, true: colors.accentPink }}
              thumbColor={colors.textPrimary}
            />
          </View>
        </Card>
        <Card>
          <View style={styles.row}>
            <View style={styles.textCol}>
              <Text style={styles.rowTitle}>Swipe to delete</Text>
              <Text style={styles.rowSubtitle}>Swipe a tile left to reveal Delete</Text>
            </View>
            <Switch
              value={swipeSettings.deleteEnabled}
              onValueChange={(value) => setSwipeSettings({ deleteEnabled: value })}
              trackColor={{ false: colors.border, true: colors.accentPink }}
              thumbColor={colors.textPrimary}
            />
          </View>
        </Card>
        <Text style={styles.footnote}>
          Turning both off doesn't remove either action - delete and archive are still available from a habit's own
          page.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  textCol: { flex: 1, paddingRight: spacing.sm },
  rowTitle: { ...typography.body, fontWeight: "700" },
  rowSubtitle: { ...typography.caption, marginTop: 2 },
  footnote: { ...typography.caption, marginTop: spacing.sm },
});
