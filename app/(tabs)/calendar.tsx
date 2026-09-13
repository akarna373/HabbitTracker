import { ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/Card";
import { ScreenHeader } from "../../components/ScreenHeader";
import { colors, spacing, typography } from "../../lib/theme";

export default function CalendarScreen() {
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Calendar" subtitle="Coming soon" />
      <ScrollView contentContainerStyle={styles.content}>
        <Card>
          <Text style={styles.title}>Under construction</Text>
          <Text style={styles.body}>This tab is reserved for an upcoming calendar feature.</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  title: { ...typography.body, fontWeight: "700", marginBottom: 4 },
  body: { ...typography.caption },
});
