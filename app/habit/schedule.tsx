import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/Card";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useDraftStore } from "../../lib/draftStore";
import { colors, spacing, typography } from "../../lib/theme";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [0, 1, 2, 3, 4];

export default function ScheduleScreen() {
  const draft = useDraftStore();

  const toggleDay = (day: number) => {
    const has = draft.repeatDays.includes(day);
    const next = has ? draft.repeatDays.filter((d) => d !== day) : [...draft.repeatDays, day];
    draft.set({ repeatDays: next, frequencyType: "custom" });
  };

  const applyPreset = (preset: "daily" | "weekdays") => {
    draft.set({
      frequencyType: preset,
      repeatDays: preset === "daily" ? ALL_DAYS : WEEKDAYS,
    });
  };

  const canContinue = draft.repeatDays.length > 0;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Find your rhythm" subtitle="New habit - Step 2 of 3" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>REPEAT ON</Text>
        <View style={styles.dayRow}>
          {DAY_LABELS.map((label, index) => {
            const active = draft.repeatDays.includes(index);
            return (
              <Pressable
                key={index}
                onPress={() => toggleDay(index)}
                style={[styles.dayCircle, active && styles.dayCircleActive]}
              >
                <Text style={[styles.dayText, active && styles.dayTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.presetRow}>
          <Pressable style={styles.presetChip} onPress={() => applyPreset("daily")}>
            <Text style={styles.presetText}>Every day</Text>
          </Pressable>
          <Pressable style={styles.presetChip} onPress={() => applyPreset("weekdays")}>
            <Text style={styles.presetText}>Weekdays</Text>
          </Pressable>
        </View>

        <Text style={styles.label}>REMINDER</Text>
        <Card
          onPress={() => draft.set({ reminderEnabled: !draft.reminderEnabled })}
          highlighted={draft.reminderEnabled}
        >
          <Text style={styles.reminderTitle}>Reminder</Text>
          <Text style={styles.reminderCaption}>
            {draft.reminderEnabled ? "On - gentle notification" : "Off"}
          </Text>
          <Text style={styles.reminderCaption}>Can be changed or disabled anytime</Text>
        </Card>

        {draft.reminderEnabled ? (
          <>
            <Text style={styles.label}>REMINDER TIME (24h, HH:mm)</Text>
            <Card>
              <TextInput
                style={styles.input}
                placeholder="20:30"
                placeholderTextColor={colors.textMuted}
                value={draft.reminderTime ?? ""}
                onChangeText={(t) => draft.set({ reminderTime: t })}
              />
            </Card>
          </>
        ) : null}

        <View style={{ height: spacing.md }} />
        <PrimaryButton title="Continue" disabled={!canContinue} onPress={() => router.push("/habit/microtasks")} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  label: { ...typography.label, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: { ...typography.body, paddingVertical: 4 },
  dayRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: spacing.sm },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircleActive: { backgroundColor: colors.accentPink, borderColor: colors.accentPink },
  dayText: { ...typography.caption, fontWeight: "700" },
  dayTextActive: { color: colors.background },
  presetRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  presetChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  presetText: { ...typography.caption },
  reminderTitle: { ...typography.body, fontWeight: "700" },
  reminderCaption: { ...typography.caption, marginTop: 2 },
});
