import { useEffect, useState } from "react";
import { Modal, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PrimaryButton } from "./PrimaryButton";
import { ScreenHeader } from "./ScreenHeader";
import { ThemedCalendar } from "./ThemedCalendar";
import type { CalendarType } from "../lib/calendarSettings";
import { computeDoseOccurrences } from "../lib/medicationSchedule";
import { colors, spacing } from "../lib/theme";

interface Props {
  visible: boolean;
  calendarType: CalendarType;
  onClose: () => void;
  onPick: (date: string) => void;
  previewParams: {
    dosageFrequency: string | null;
    durationType: string | null;
    startTime: string;
  };
}

// Opens blank every time (reset on open, not pre-showing a prior pick) -
// tapping a date commits immediately via onPick and live-previews the
// course it would produce from that date, same interaction whether this is
// picking a start date for a brand new habit or changing one mid-course.
export function StartDatePickerModal({ visible, calendarType, onClose, onPick, previewParams }: Props) {
  const [pickedDate, setPickedDate] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setPickedDate(null);
  }, [visible]);

  const markedDates = pickedDate
    ? Array.from(
        new Set(
          (
            computeDoseOccurrences({
              dosageFrequency: previewParams.dosageFrequency,
              durationType: previewParams.durationType,
              startTime: previewParams.startTime,
              startDate: pickedDate,
            }) ?? []
          ).map((o) => o.date)
        )
      )
    : [];

  const handleSelect = (date: string) => {
    setPickedDate(date);
    onPick(date);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScreenHeader title="Pick a start date" subtitle="Tap a date - the course fills in from there" />
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedCalendar calendarType={calendarType} markedDates={markedDates} onSelectDate={handleSelect} />
          <PrimaryButton title="Done" style={styles.doneButton} onPress={onClose} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  doneButton: { marginTop: spacing.lg },
});
