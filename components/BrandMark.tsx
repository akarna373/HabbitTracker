import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import { colors } from "../lib/theme";

interface BrandMarkProps {
  size?: number;
}

// The habit mark: an unclosed ring that never quite meets itself, always
// turning - the small, repeatable motion the whole app is built around.
export function BrandMark({ size = 96 }: BrandMarkProps) {
  const rotate = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;

    const spin = Animated.loop(
      Animated.timing(rotate, {
        toValue: 1,
        duration: 7000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const breathe = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    spin.start();
    breathe.start();
    return () => {
      spin.stop();
      breathe.stop();
    };
  }, [reduceMotion, rotate, pulse]);

  const spinDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] });

  const borderWidth = Math.round(size * 0.09);

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth,
            opacity: pulseOpacity,
            transform: [{ rotate: spinDeg }, { scale }],
          },
        ]}
      />
      <View style={[styles.dot, { backgroundColor: colors.accentPink }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    borderTopColor: colors.accentPink,
    borderRightColor: colors.accentPink,
    borderBottomColor: colors.accentRed,
    borderLeftColor: "transparent",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
