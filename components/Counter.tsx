import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing } from "../lib/theme";

interface CounterProps {
  value: number;
  unit: string;
  onDecrement: () => void;
  onIncrement: () => void;
  minusDisabled?: boolean;
}

export function Counter({ value, unit, onDecrement, onIncrement, minusDisabled }: CounterProps) {
  return (
    <View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.unit}>{unit}</Text>
      <View style={styles.buttonRow}>
        <Pressable
          onPress={onDecrement}
          disabled={minusDisabled}
          style={[styles.circleButton, minusDisabled && styles.disabled]}
        >
          <Text style={styles.circleText}>−</Text>
        </Pressable>
        <Pressable onPress={onIncrement} style={styles.circleButton}>
          <Text style={styles.circleText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  value: { fontSize: 56, fontWeight: "700", color: colors.textPrimary, textAlign: "center" },
  unit: { fontSize: 14, color: colors.textSecondary, textAlign: "center", marginBottom: spacing.md },
  buttonRow: { flexDirection: "row", justifyContent: "center", gap: spacing.lg, marginBottom: spacing.md },
  circleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.accentPink,
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.4 },
  circleText: { fontSize: 20, color: colors.accentPink, fontWeight: "700" },
});
