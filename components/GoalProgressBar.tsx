import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { summaryColors } from "../lib/summaryTheme";
import { useReducedMotion } from "../lib/useReducedMotion";

interface GoalProgressBarProps {
  // 0-100; anything outside is clamped.
  percent: number;
  height?: number;
}

// The monthly-goal bar. It starts at the current value (no fill-up on first
// paint) and glides to each new value; with the OS reduce-motion setting on it
// jumps instead.
export function GoalProgressBar({ percent, height = 10 }: GoalProgressBarProps) {
  const reducedMotion = useReducedMotion();
  const clamped = Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 100) : 0;
  const progress = useRef(new Animated.Value(clamped)).current;

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(clamped);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: clamped,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // animates width, a layout property
    });
    animation.start();
    return () => animation.stop();
  }, [clamped, reducedMotion, progress]);

  const width = progress.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"], extrapolate: "clamp" });

  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}
    >
      <Animated.View style={[styles.fill, { width, borderRadius: height / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: "100%", backgroundColor: summaryColors.track, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: summaryColors.saved },
});
