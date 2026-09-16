import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/Card";
import { confirmDialog } from "../../components/ConfirmDialog";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useStore } from "../../lib/store";
import { colors, spacing, typography } from "../../lib/theme";

export default function SyllabusPlanScreen() {
  const { habitId } = useLocalSearchParams<{ habitId: string }>();
  const habit = useStore((s) => s.habits.find((h) => h.id === habitId));
  const addMicrotasks = useStore((s) => s.addMicrotasks);
  const [subject, setSubject] = useState(habit?.name ?? "");
  const [days, setDays] = useState("14");
  const [pasted, setPasted] = useState("");

  const prompt = `I'm studying "${subject || "my subject"}". Break the syllabus into a day-by-day checklist covering ${days || "?"} days. Reply as a plain numbered list, one topic per line, no extra text.`;

  const copyPrompt = async () => {
    await Clipboard.setStringAsync(prompt);
  };

  const saveAsChecklist = () => {
    if (!habitId) return;
    const lines = pasted
      .split("\n")
      .map((line) => line.replace(/^\s*\d+[.)]\s*/, "").trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    addMicrotasks(habitId, lines);
    confirmDialog("Checklist saved", `Added ${lines.length} steps to this habit's microtasks.`, [
      { text: "OK", onPress: () => router.back() },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Plan with AI" subtitle="Turn your syllabus into a checklist" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>SUBJECT</Text>
        <Card>
          <TextInput
            style={styles.input}
            placeholder="e.g. Organic Chemistry"
            placeholderTextColor={colors.textMuted}
            value={subject}
            onChangeText={setSubject}
          />
        </Card>

        <Text style={styles.label}>HOW MANY DAYS?</Text>
        <Card>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            placeholder="e.g. 14"
            placeholderTextColor={colors.textMuted}
            value={days}
            onChangeText={(t) => setDays(t.replace(/[^0-9]/g, ""))}
          />
        </Card>

        <Text style={styles.label}>PROMPT</Text>
        <Card>
          <Text style={styles.cardBody}>{prompt}</Text>
        </Card>
        <PrimaryButton title="Copy prompt" variant="outline" onPress={copyPrompt} style={styles.spaced} />
        <Text style={styles.caption}>Paste it into any AI chat app you already use, then paste the reply back below.</Text>

        <Text style={styles.label}>PASTE THE REPLY HERE</Text>
        <Card>
          <TextInput
            style={[styles.input, styles.multiline]}
            placeholder={"1. Topic one\n2. Topic two\n..."}
            placeholderTextColor={colors.textMuted}
            value={pasted}
            onChangeText={setPasted}
            multiline
          />
        </Card>
        <PrimaryButton title="Save as checklist" disabled={pasted.trim().length === 0} onPress={saveAsChecklist} style={styles.spaced} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  label: { ...typography.label, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: { ...typography.body, paddingVertical: 4 },
  cardBody: { ...typography.body },
  caption: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  multiline: { minHeight: 120, textAlignVertical: "top" },
  spaced: { marginTop: spacing.md },
});
