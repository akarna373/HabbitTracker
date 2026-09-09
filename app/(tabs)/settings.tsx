import { router } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ListRow } from "../../components/ListRow";
import { resetOnboarding } from "../../lib/onboarding";
import { useStore } from "../../lib/store";
import { colors, spacing, typography } from "../../lib/theme";

export default function SettingsScreen() {
  const habits = useStore((s) => s.habits);
  const deleteHabit = useStore((s) => s.deleteHabit);

  const confirmClearAll = () => {
    if (!habits.length) {
      Alert.alert("Nothing to clear", "You don't have any habits yet.");
      return;
    }
    Alert.alert(
      "Delete all data?",
      "This removes every habit and its history from this device. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete everything",
          style: "destructive",
          onPress: async () => {
            for (const habit of habits) {
              await deleteHabit(habit.id);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Make it feel like you.</Text>

        <ListRow title="Appearance" subtitle="Follow device - dark mode shown" showChevron={false} />
        <ListRow title="Notifications" subtitle="Set per-habit reminders when creating a habit" showChevron={false} />
        <ListRow title="Language" subtitle="System language - multilingual ready" showChevron={false} />
        <ListRow title="Partner sharing" subtitle="Off - coming in a future release" disabled showChevron={false} />
        <ListRow title="Health Connect" subtitle="Not connected - coming in a future release" disabled showChevron={false} />
        <ListRow title="Privacy and data" subtitle="Delete all habits and history from this device" onPress={confirmClearAll} />
        <ListRow
          title="Replay welcome screen"
          subtitle="See the first-launch greeting again"
          onPress={async () => {
            await resetOnboarding();
            router.replace("/welcome");
          }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  title: { ...typography.title, marginTop: spacing.md },
  subtitle: { ...typography.caption, marginBottom: spacing.md },
});
