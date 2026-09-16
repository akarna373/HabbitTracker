import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/Card";
import { openOptionSheet } from "../../components/OptionSheet";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { addCustomOption, getCustomOptions, removeCustomOption } from "../../lib/customOptions";
import { getCurrencySymbol } from "../../lib/currency";
import { addDays, daysBetween, todayISO } from "../../lib/dates";
import { useDraftStore } from "../../lib/draftStore";
import { DOSAGE_FREQUENCIES } from "../../lib/medicationParse";
import { colors, spacing, typography } from "../../lib/theme";
import type { TrackingMethod } from "../../lib/types";

const DOSE_UNITS = ["mg", "gm", "drops", "teaspoon"];
const DURATIONS = ["Daily", "Week", "Ten days", "Month"];
const CATEGORY_EXAMPLES = ["e.g. Heart", "e.g. Blood Pressure", "e.g. Sugar", "e.g. Anti-infection"];
const MEDICINE_NAME_EXAMPLES = [
  "e.g. Paracetamol",
  "e.g. Metformin",
  "e.g. Amlodipine",
  "e.g. Atorvastatin",
  "e.g. Omeprazole",
  "e.g. Vitamin D3",
];

// A user's own typed "Custom" values (per field) persist across habits, so
// they show up as real, tap-able (and removable) options next time instead
// of forcing a retype.
function useCustomOptions(field: string) {
  const [options, setOptions] = useState<string[]>([]);
  useEffect(() => {
    getCustomOptions(field).then(setOptions);
  }, [field]);
  const add = async (value: string) => setOptions(await addCustomOption(field, value));
  const remove = async (value: string) => setOptions(await removeCustomOption(field, value));
  return { options, add, remove };
}

// Tap-to-select drawer - "Custom" clears the field so the picker row swaps
// for a free-text input.
function openPicker(
  title: string,
  presets: string[],
  customOptions: string[],
  onPick: (value: string) => void,
  onDeleteCustom: (value: string) => void
) {
  openOptionSheet(title, presets, customOptions, onPick, onDeleteCustom);
}

function PickerField({
  fieldKey,
  label,
  value,
  presets,
  onChange,
  customPlaceholder,
  numericSuffix,
}: {
  fieldKey: string;
  label: string;
  value: string | null;
  presets: string[];
  onChange: (value: string) => void;
  customPlaceholder?: string;
  // When set, the custom entry only accepts digits and saves as "{n}
  // {numericSuffix}" (e.g. "4" -> "4 times a day") instead of free text -
  // this is the value the schedule math later parses back out.
  numericSuffix?: string;
}) {
  const custom = useCustomOptions(fieldKey);
  const isCustom = value !== null && !presets.includes(value) && !custom.options.includes(value);
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Card>
        {isCustom ? (
          <TextInput
            style={styles.input}
            keyboardType={numericSuffix ? "numeric" : "default"}
            placeholder={customPlaceholder ?? "Type it in"}
            placeholderTextColor={colors.textMuted}
            value={value ?? ""}
            onChangeText={(t) => onChange(numericSuffix ? t.replace(/[^0-9]/g, "") : t)}
            autoFocus
            onBlur={() => {
              if (!value) return;
              const digits = value.replace(/[^0-9]/g, "");
              if (numericSuffix && !digits) return;
              const finalValue = numericSuffix ? `${digits} ${numericSuffix}` : value.trim();
              if (!numericSuffix && !finalValue) return;
              custom.add(finalValue);
              onChange(finalValue);
            }}
          />
        ) : (
          <Pressable
            style={styles.pickerRow}
            onPress={() => openPicker(label, presets, custom.options, onChange, custom.remove)}
          >
            <Text style={value ? styles.pickerValue : styles.pickerPlaceholder}>{value ?? "Tap to select"}</Text>
            <Text style={styles.pickerChevron}>{"›"}</Text>
          </Pressable>
        )}
      </Card>
    </>
  );
}

// Cycles through example values inside the (otherwise static) RN
// placeholder, so the user sees what kind of word this field wants without
// a label wall of text - hidden the instant there's real text or focus.
function CyclingPlaceholderInput({
  value,
  onChange,
  examples,
}: {
  value: string;
  onChange: (t: string) => void;
  examples: string[];
}) {
  const [exampleIndex, setExampleIndex] = useState(0);
  const [focused, setFocused] = useState(false);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
        setExampleIndex((i) => (i + 1) % examples.length);
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      });
    }, 2200);
    return () => clearInterval(id);
  }, [opacity, examples.length]);

  return (
    <View style={styles.categoryWrap}>
      <TextInput style={styles.input} value={value} onChangeText={onChange} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      {value.length === 0 && !focused ? (
        <Animated.Text style={[styles.categoryPlaceholder, { opacity }]} pointerEvents="none">
          {examples[exampleIndex]}
        </Animated.Text>
      ) : null}
    </View>
  );
}

export default function BasicsScreen() {
  const draft = useDraftStore();
  const isMedication = draft.templateId === "medication";
  const isAmount = draft.trackingMethod === "amount" && !isMedication;
  const isExam = draft.templateId === "exam_countdown";
  const isCheckup = draft.templateId === "doctor_checkup";
  const isAttendance = draft.templateId === "attendance";

  const canContinue =
    draft.name.trim().length > 0 &&
    (!isAmount || ((draft.targetAmount ?? 0) > 0 && !!draft.unit)) &&
    (!draft.hasCost || isMedication || (draft.pricePerItem !== null && draft.pricePerItem >= 0)) &&
    (!isExam || !!draft.examDate) &&
    (!isCheckup || (draft.checkupIntervalDays !== null && draft.checkupIntervalDays > 0)) &&
    (!isAttendance || (draft.attendanceTarget !== null && draft.attendanceTarget > 0)) &&
    (!isMedication ||
      ((draft.doseAmount ?? 0) > 0 &&
        !!draft.doseUnit &&
        !!draft.dosageFrequency &&
        !!draft.durationType));

  const setMethod = (method: TrackingMethod) => draft.set({ trackingMethod: method });

  const doseUnitCustom = useCustomOptions("medication.doseUnit");
  const isDoseUnitCustom = draft.doseUnit !== null && !DOSE_UNITS.includes(draft.doseUnit) && !doseUnitCustom.options.includes(draft.doseUnit);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Make it achievable" subtitle="New habit - Step 1 of 3" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{isMedication ? "MEDICINE NAME" : "HABIT NAME"}</Text>
        <Card>
          {isMedication ? (
            <CyclingPlaceholderInput
              value={draft.name}
              onChange={(t) => draft.set({ name: t })}
              examples={MEDICINE_NAME_EXAMPLES}
            />
          ) : (
            <TextInput
              style={styles.input}
              placeholder="e.g. Read every day"
              placeholderTextColor={colors.textMuted}
              value={draft.name}
              onChangeText={(t) => draft.set({ name: t })}
            />
          )}
        </Card>

        {!isMedication ? (
          <>
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
          </>
        ) : null}

        {isAmount ? (
          <>
            <Text style={styles.label}>DAILY TARGET</Text>
            <Card>
              <View style={styles.targetRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  keyboardType="numeric"
                  placeholder={`e.g. ${draft.suggestedTargetAmount ?? 10}`}
                  placeholderTextColor={colors.textMuted}
                  value={draft.targetAmount !== null ? String(draft.targetAmount) : ""}
                  onChangeText={(t) => {
                    const digits = t.replace(/[^0-9]/g, "");
                    draft.set({ targetAmount: digits ? Number(digits) : null });
                  }}
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

        {isMedication ? (
          <>
            <View style={styles.doseLabelRow}>
              <Text style={[styles.label, styles.doseLabelCol]}>DOSE</Text>
              <Text style={[styles.label, styles.doseLabelCol]}>UNIT</Text>
            </View>
            <Card>
              <View style={styles.targetRow}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    placeholder="e.g. 500"
                    placeholderTextColor={colors.textMuted}
                    value={draft.doseAmount !== null ? String(draft.doseAmount) : ""}
                    onChangeText={(t) => {
                      const digits = t.replace(/[^0-9.]/g, "");
                      draft.set({ doseAmount: digits ? Number(digits) : null });
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  {isDoseUnitCustom ? (
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. sachets"
                      placeholderTextColor={colors.textMuted}
                      value={draft.doseUnit ?? ""}
                      onChangeText={(t) => draft.set({ doseUnit: t })}
                      autoFocus
                      onBlur={() => {
                        if (draft.doseUnit && draft.doseUnit.trim()) {
                          doseUnitCustom.add(draft.doseUnit.trim());
                          draft.set({ doseUnit: draft.doseUnit.trim() });
                        }
                      }}
                    />
                  ) : (
                    <Pressable
                      style={styles.pickerRow}
                      onPress={() =>
                        openPicker(
                          "Dose unit",
                          DOSE_UNITS,
                          doseUnitCustom.options,
                          (v) => draft.set({ doseUnit: v }),
                          doseUnitCustom.remove
                        )
                      }
                    >
                      <Text style={draft.doseUnit ? styles.pickerValue : styles.pickerPlaceholder}>
                        {draft.doseUnit || "Tap to select"}
                      </Text>
                      <Text style={styles.pickerChevron}>{"›"}</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </Card>

            <PickerField
              fieldKey="medication.dosageFrequency"
              label="NUMBER OF DOSAGE"
              value={draft.dosageFrequency}
              presets={DOSAGE_FREQUENCIES}
              onChange={(v) => draft.set({ dosageFrequency: v })}
              customPlaceholder="e.g. 4"
              numericSuffix="times a day"
            />

            <PickerField
              fieldKey="medication.durationType"
              label="DURATION"
              value={draft.durationType}
              presets={DURATIONS}
              onChange={(v) => draft.set({ durationType: v })}
              customPlaceholder="e.g. 45"
              numericSuffix="days"
            />

            <Text style={styles.label}>CATEGORY (OPTIONAL)</Text>
            <Card>
              <CyclingPlaceholderInput
                value={draft.medicineCategory ?? ""}
                onChange={(t) => draft.set({ medicineCategory: t })}
                examples={CATEGORY_EXAMPLES}
              />
            </Card>

            <Text style={styles.label}>TABLETS PER PACKET (OPTIONAL)</Text>
            <Card>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="e.g. 10"
                placeholderTextColor={colors.textMuted}
                value={draft.tabletsPerPacket !== null ? String(draft.tabletsPerPacket) : ""}
                onChangeText={(t) => {
                  const digits = t.replace(/[^0-9]/g, "");
                  draft.set({ tabletsPerPacket: digits ? Number(digits) : null });
                }}
              />
            </Card>
          </>
        ) : null}

        {draft.hasCost ? (
          <>
            <Text style={styles.label}>
              {isMedication && draft.tabletsPerPacket
                ? `PRICE OF PACKET (${draft.tabletsPerPacket} TABLETS) (${getCurrencySymbol()})`
                : `PRICE PER ${(draft.unit || "dose").toUpperCase()} (${getCurrencySymbol()})`}
            </Text>
            <Card>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder={`e.g. ${draft.suggestedPricePerItem ?? 20}`}
                placeholderTextColor={colors.textMuted}
                value={draft.pricePerItem !== null ? String(draft.pricePerItem) : ""}
                onChangeText={(t) => {
                  const cleaned = t.replace(/[^0-9.]/g, "");
                  draft.set({ pricePerItem: cleaned ? Number(cleaned) : null });
                }}
              />
            </Card>
          </>
        ) : null}

        {isExam ? (
          <>
            <Text style={styles.label}>DAYS UNTIL YOUR EXAM</Text>
            <Card>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="e.g. 30"
                placeholderTextColor={colors.textMuted}
                value={draft.examDate ? String(daysBetween(todayISO(), draft.examDate)) : ""}
                onChangeText={(t) => {
                  const digits = t.replace(/[^0-9]/g, "");
                  draft.set({ examDate: digits ? addDays(todayISO(), Number(digits)) : null });
                }}
              />
            </Card>
          </>
        ) : null}

        {isCheckup ? (
          <>
            <Text style={styles.label}>REMIND ME EVERY N DAYS</Text>
            <Card>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="e.g. 90"
                placeholderTextColor={colors.textMuted}
                value={draft.checkupIntervalDays !== null ? String(draft.checkupIntervalDays) : ""}
                onChangeText={(t) => {
                  const digits = t.replace(/[^0-9]/g, "");
                  draft.set({ checkupIntervalDays: digits ? Number(digits) : null });
                }}
              />
            </Card>
          </>
        ) : null}

        {isAttendance ? (
          <>
            <Text style={styles.label}>ATTENDANCE TARGET (%)</Text>
            <Card>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                placeholder="e.g. 75"
                placeholderTextColor={colors.textMuted}
                value={draft.attendanceTarget !== null ? String(draft.attendanceTarget) : ""}
                onChangeText={(t) => {
                  const digits = t.replace(/[^0-9]/g, "");
                  draft.set({ attendanceTarget: digits ? Number(digits) : null });
                }}
              />
            </Card>
          </>
        ) : null}

        {!isMedication ? (
          <>
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
          </>
        ) : null}

        <View style={{ height: spacing.md }} />
        <PrimaryButton title="Continue" disabled={!canContinue} onPress={() => router.push("/habit/schedule")} />
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
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
  pickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pickerValue: { ...typography.body, color: colors.textPrimary },
  pickerPlaceholder: { ...typography.body, color: colors.textMuted },
  pickerChevron: { ...typography.body, color: colors.textMuted },
  doseLabelRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.xs },
  doseLabelCol: { flex: 1, marginTop: 0, marginBottom: 0 },
  categoryWrap: { position: "relative", justifyContent: "center" },
  categoryPlaceholder: {
    ...typography.body,
    color: colors.textMuted,
    position: "absolute",
    left: 0,
    right: 0,
    paddingVertical: 4,
  },
});
