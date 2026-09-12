import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { colors, radii, spacing, typography } from "../lib/theme";
import { DragWheelColumn } from "./DragWheelColumn";

interface Props {
  visible: boolean;
  value: string; // "HH:mm", 24h
  title?: string;
  onCancel: () => void;
  onConfirm: (time: string) => void;
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));
const PERIODS = ["AM", "PM"];

// Android's native time picker (TimePickerDialog / MaterialTimePicker) is
// rendered by the OS itself - a bright white/light Material dialog that
// can't be restyled through this library's JS props, unlike the app's own
// dark surfaces. Building the picker ourselves (same dark-card pattern as
// ConfirmDialog, and a drum-wheel picker like the stock clock app's timer)
// gives full control instead.
export function ThemedTimePicker({ visible, value, title = "Set time", onCancel, onConfirm }: Props) {
  const [hourIndex, setHourIndex] = useState(9); // "10"
  const [minuteIndex, setMinuteIndex] = useState(0);
  const [periodIndex, setPeriodIndex] = useState(1); // PM

  useEffect(() => {
    if (!visible) return;
    const [h, m] = value.split(":").map(Number);
    setPeriodIndex(h >= 12 ? 1 : 0);
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    setHourIndex(hour12 - 1);
    setMinuteIndex(m);
  }, [visible, value]);

  const confirm = () => {
    const hour12 = hourIndex + 1;
    const isPM = periodIndex === 1;
    const hour24 = isPM ? (hour12 % 12) + 12 : hour12 % 12;
    onConfirm(`${String(hour24).padStart(2, "0")}:${String(minuteIndex).padStart(2, "0")}`);
  };

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      {/* RN's Modal renders into its own native window, outside the root
          GestureHandlerRootView declared in app/_layout.tsx - the hour/
          minute wheels' PanGestureHandler needs its own here to register. */}
      <GestureHandlerRootView style={styles.gestureRoot}>
        <Pressable style={styles.overlay} onPress={onCancel}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.title}>{title}</Text>

            <View style={styles.wheelRow}>
              <DragWheelColumn data={HOURS} selectedIndex={hourIndex} onChange={setHourIndex} numericEntry={{ min: 1, max: 12 }} />
              <Text style={styles.colon}>:</Text>
              <DragWheelColumn data={MINUTES} selectedIndex={minuteIndex} onChange={setMinuteIndex} numericEntry={{ min: 0, max: 59 }} />
              <DragWheelColumn data={PERIODS} selectedIndex={periodIndex} onChange={setPeriodIndex} sensitivity={0.8} />
            </View>

            <View style={styles.buttonRow}>
              <Pressable style={styles.button} onPress={onCancel}>
                <Text style={styles.buttonText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.button} onPress={confirm}>
                <Text style={styles.buttonText}>OK</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
  },
  title: { ...typography.body, fontWeight: "700", marginBottom: spacing.md },
  wheelRow: { flexDirection: "row", alignItems: "center", marginBottom: spacing.lg },
  colon: { ...typography.title, marginHorizontal: -2 },
  buttonRow: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.lg, width: "100%" },
  button: { paddingVertical: spacing.xs, paddingHorizontal: spacing.xs },
  buttonText: { ...typography.body, color: colors.accentPink, fontWeight: "700" },
});
