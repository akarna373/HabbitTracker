import { StyleSheet, View, ViewStyle } from "react-native";
import { colors } from "../lib/theme";

interface ProgressBarProps {
  progress: number; // 0..1
  color?: string;
  style?: ViewStyle;
}

export function ProgressBar({ progress, color = colors.accentPink, style }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, progress));
  return (
    <View style={[styles.track, style]}>
      <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
  },
});
