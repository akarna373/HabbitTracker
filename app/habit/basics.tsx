import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/Card";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { useDraftStore } from "../../lib/draftStore";
import { colors, spacing, typography } from "../../lib/theme";
import type { TrackingMethod } from "../../lib/types";

export default function BasicsScreen() {
  const draft = useDraftStore();
  const isAmount = draft.trackingMethod === "amount";

  const canContinue = draft.name.trim().length > 0 && (!isAmount || ((draft.targetAmount ?? 0) > 0 && !!draft.unit));

  const setMethod = (method: TrackingMethod) => draft.set({ trackingMethod: method });

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Make it achievable" subtitle="New habit - Step 1 of 3" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>HABIT NAME</Text>
        <Card>
          <TextInput
            style={styles.input}
            placeholder="e.g. Read every day"
            placeholderTextColor={colors.textMuted}
            value={draft.name}
            onChangeText={(t) => draft.set({ name: t })}
          />
        </Card>

        <Text style={styles.label}>HOW WILL YOU TRACK IT?</Text>
        <View style={styles.segmentRow}>
          <Pressable
            style={[styles.segment, isAmount && styles.segmentActive]}
            onPress={() => setMethod("amount")}
          >
            <Text style={[styles.segmentText, isAmount && styles.segmentTextActive]}>Count or amount</Text>
          </Pressable>
          <Pressable
            style={[styles.segment, !isAmount && styles.segmentActive]}
            onPress={() => setMethod("checkin")}
          >
            <Text style={[styles.segmentText, !isAmount && styles.segmentTextActive]}>Simple check-in</Text>
          </Pressable>
        </View>

        {isAmount ? (
          <>
            <Text style={styles.label}>DAILY TARGET</Text>
            <Card>
              <View style={styles.targetRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  keyboardType="numeric"
                  placeholder="10"
                  placeholderTextColor={colors.textMuted}
                  value={draft.targetAmount !== null ? String(draft.targetAmount) : ""}
                  onChangeText={(t) => draft.set({ targetAmount: t ? Number(t) : null })}
                />
                <TextInput
                  style={[styles.input, { flex: 1, textAlign: "right" }]}
                  placeholder="minutes"
                  placeholderTextColor={colors.textMuted}
                  value={draft.unit ?? ""}
                  onChangeText={(t) => draft.set({ unit: t })}
                />
              </View>
            </Card>
          </>
        ) : null}

        <Text style={styles.label}>YOUR REASON (OPTIONAL)</Text>
        <Card>
          <TextInput
            style={styles.input}
            placeholder="Prepare calmly for my goals"
            placeholderTextColor={colors.textMuted}
            value={draft.reason ?? ""}
            onChangeText={(t) => draft.set({ reason: t })}
          />
        </Card>

        <View style={{ height: spacing.md }} />
        <PrimaryButton title="Continue" disabled={!canContinue} onPress={() => router.push("/habit/schedule")} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  label: { ...typography.label, marginTop: spacing.sm, marginBottom: spacing.xs },
  input: { ...typography.body, paddingVertical: 4 },
  targetRow: { flexDirection: "row", gap: spacing.sm },
  segmentRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.sm },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  segmentActive: { borderColor: colors.accentPink, backgroundColor: colors.surface },
  segmentText: { ...typography.caption },
  segmentTextActive: { color: colors.accentPink, fontWeight: "700" },
});
