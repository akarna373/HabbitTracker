import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/Card";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { formatTime12h } from "../../lib/progress";
import { useDraftStore } from "../../lib/draftStore";
import { useStore } from "../../lib/store";
import { colors, spacing, typography } from "../../lib/theme";
import { URGE_MICROTASKS } from "../../lib/templates";

function frequencySummary(frequencyType: string, repeatDays: number[]): string {
  if (frequencyType === "daily") return "Every day";
  if (frequencyType === "weekdays") return "Monday to Friday";
  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return repeatDays.map((d) => labels[d]).join(", ");
}

export default function MicrotasksScreen() {
  const draft = useDraftStore();
  const createHabit = useStore((s) => s.createHabit);
  const [tasks, setTasks] = useState<string[]>(draft.microtasks);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (draft.hasCost && tasks.length === 0) {
      setTasks(URGE_MICROTASKS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateTask = (index: number, text: string) => {
    const next = tasks.map((t, i) => (i === index ? text : t));
    setTasks(next);
  };

  const removeTask = (index: number) => {
    setTasks(tasks.filter((_, i) => i !== index));
  };

  const addTask = () => setTasks([...tasks, ""]);

  const handleCreate = async () => {
    setCreating(true);
    draft.set({ microtasks: tasks.filter((t) => t.trim().length > 0) });
    const finalDraft = useDraftStore.getState();
    await createHabit({
      kind: finalDraft.kind!,
      category: finalDraft.category!,
      templateId: finalDraft.templateId!,
      name: finalDraft.name,
      trackingMethod: finalDraft.trackingMethod,
      targetAmount: finalDraft.targetAmount,
      unit: finalDraft.unit,
      reason: finalDraft.reason,
      frequencyType: finalDraft.frequencyType,
      repeatDays: finalDraft.repeatDays,
      reminderEnabled: finalDraft.reminderEnabled,
      reminderTime: finalDraft.reminderEnabled ? finalDraft.reminderTime : null,
      hasCost: finalDraft.hasCost,
      baselineQuantity: finalDraft.baselineQuantity,
      pricePerItem: finalDraft.pricePerItem,
      goalType: finalDraft.goalType,
      summaryTime: finalDraft.hasCost ? finalDraft.summaryTime : null,
      microtasks: tasks.filter((t) => t.trim().length > 0),
    });
    draft.reset();
    router.dismissAll();
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Start small" subtitle="New habit - Step 3 of 3" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>{draft.hasCost ? "WHEN AN URGE APPEARS" : "MICROTASKS"}</Text>
        <Card highlighted>
          {tasks.map((task, index) => (
            <View key={index} style={styles.taskRow}>
              <Text style={styles.taskIndex}>{index + 1}.</Text>
              <TextInput
                style={styles.taskInput}
                value={task}
                onChangeText={(t) => updateTask(index, t)}
                placeholder="Describe the small step"
                placeholderTextColor={colors.textMuted}
              />
              <Pressable onPress={() => removeTask(index)} hitSlop={8}>
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            </View>
          ))}
          <Pressable onPress={addTask} style={styles.addRow}>
            <Text style={styles.addText}>+ Add a step</Text>
          </Pressable>
        </Card>

        <Card>
          <Text style={styles.summaryTitle}>{draft.name}</Text>
          <Text style={styles.summaryBody}>
            {draft.trackingMethod === "amount" && draft.targetAmount
              ? `${draft.targetAmount} ${draft.unit ?? ""} - `
              : ""}
            {frequencySummary(draft.frequencyType, draft.repeatDays)}
          </Text>
          {draft.reminderEnabled && draft.reminderTime ? (
            <Text style={styles.summaryBody}>Reminder at {formatTime12h(draft.reminderTime)}</Text>
          ) : null}
          {draft.hasCost && draft.summaryTime ? (
            <Text style={styles.summaryBody}>Night summary at {formatTime12h(draft.summaryTime)}</Text>
          ) : null}
        </Card>

        <Card>
          <Text style={styles.summaryTitle}>After creation</Text>
          <Text style={styles.summaryBody}>Return to Today</Text>
          <Text style={styles.summaryBody}>Update total habit count immediately</Text>
        </Card>

        <View style={{ height: spacing.md }} />
        <PrimaryButton title="Create habit" loading={creating} onPress={handleCreate} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  label: { ...typography.label, marginTop: spacing.sm, marginBottom: spacing.xs },
  taskRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.xs, gap: spacing.xs },
  taskIndex: { ...typography.caption, width: 18 },
  taskInput: { ...typography.body, flex: 1 },
  removeText: { color: colors.textMuted, fontSize: 16 },
  addRow: { marginTop: spacing.xs },
  addText: { color: colors.accentPink, fontWeight: "600" },
  summaryTitle: { ...typography.body, fontWeight: "700", marginBottom: 2 },
  summaryBody: { ...typography.caption },
});
