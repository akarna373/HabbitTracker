import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../../components/Card";
import { openOptionSheet } from "../../../components/OptionSheet";
import { PrimaryButton } from "../../../components/PrimaryButton";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { StartDatePickerModal } from "../../../components/StartDatePickerModal";
import { ThemedCalendar } from "../../../components/ThemedCalendar";
import { formatLongDateForCalendar } from "../../../lib/calendarSettings";
import { todayISO } from "../../../lib/dates";
import { DOSAGE_FREQUENCIES } from "../../../lib/medicationParse";
import { getCourseCalendarView } from "../../../lib/medicationSchedule";
import { formatTime12h } from "../../../lib/progress";
import { useStore } from "../../../lib/store";
import { colors, spacing, typography } from "../../../lib/theme";

export default function MedicineCalendarScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useStore((s) => s.habits.find((h) => h.id === id));
  const calendarType = useStore((s) => s.calendarType);
  const updateMedicationSchedule = useStore((s) => s.updateMedicationSchedule);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Locked by default - "Change schedule"/"Change date" only appear once
  // the user deliberately unlocks them, so they can't be bumped by accident
  // while just browsing the calendar.
  const [editUnlocked, setEditUnlocked] = useState(false);

  const courseView = useMemo(() => {
    if (!habit) return null;
    return getCourseCalendarView({
      dosageFrequency: habit.dosageFrequency,
      durationType: habit.durationType,
      startTime: habit.reminderTime ?? "08:00",
      medicationStartDate: habit.medicationStartDate ?? habit.createdAt.slice(0, 10),
    });
  }, [habit]);

  if (!habit || !courseView) return null;

  const { occurrences, isRolling } = courseView;
  const markedDates = Array.from(new Set(occurrences.map((o) => o.date)));
  const endDate = markedDates[markedDates.length - 1];
  const selectedTimes = selectedDate ? occurrences.filter((o) => o.date === selectedDate).map((o) => o.time) : [];

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader
        title={habit.name}
        subtitle={
          isRolling
            ? "Ongoing - showing the next 30 days"
            : `Lasts ${markedDates.length} days - until ${formatLongDateForCalendar(endDate, calendarType)}`
        }
      />
      <ScrollView contentContainerStyle={styles.content}>
        {editUnlocked ? (
          <View style={styles.editRow}>
            <PrimaryButton
              title="Change schedule"
              variant="outline"
              size="small"
              style={styles.editButton}
              onPress={() =>
                openOptionSheet(
                  "Number of dosage",
                  DOSAGE_FREQUENCIES,
                  [],
                  (value) => updateMedicationSchedule(habit.id, { dosageFrequency: value }),
                  () => {}
                )
              }
            />
            <PrimaryButton
              title="Change date"
              variant="outline"
              size="small"
              style={styles.editButton}
              onPress={() => setShowDatePicker(true)}
            />
          </View>
        ) : (
          <PrimaryButton
            title="Modify Schedule"
            variant="outline"
            size="small"
            style={styles.editRow}
            onPress={() => setEditUnlocked(true)}
          />
        )}

        <ThemedCalendar
          calendarType={calendarType}
          markedDates={markedDates}
          initialDate={isRolling ? todayISO() : habit.medicationStartDate ?? habit.createdAt.slice(0, 10)}
          onSelectDate={setSelectedDate}
        />

        {selectedDate ? (
          <Card style={styles.detailCard}>
            <Text style={styles.detailTitle}>{formatLongDateForCalendar(selectedDate, calendarType)}</Text>
            {selectedTimes.length > 0 ? (
              selectedTimes.map((t, i) => (
                <Text key={i} style={styles.detailBody}>
                  {formatTime12h(t)}
                </Text>
              ))
            ) : (
              <Text style={styles.detailBody}>No dose on this day.</Text>
            )}
          </Card>
        ) : null}
      </ScrollView>

      <StartDatePickerModal
        visible={showDatePicker}
        calendarType={calendarType}
        onClose={() => setShowDatePicker(false)}
        onPick={(date) => updateMedicationSchedule(habit.id, { medicationStartDate: date })}
        previewParams={{
          dosageFrequency: habit.dosageFrequency,
          durationType: habit.durationType,
          startTime: habit.reminderTime ?? "08:00",
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  editRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  editButton: { flex: 1 },
  detailCard: { marginTop: spacing.md },
  detailTitle: { ...typography.body, fontWeight: "700", marginBottom: spacing.xs },
  detailBody: { ...typography.body },
});
