import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRef } from "react";
import { Animated, Easing, Pressable } from "react-native";
import { useReducedMotion } from "../lib/useReducedMotion";

// The green tick beside "Confirmed savings today" on the Summary screen. It looks
// like a plain icon; tapping it three times in a row (no more than 1.5 s between
// taps) plays a spin-and-pop and then calls onUnlock - the hidden background
// chooser. Deliberately invisible to screen readers: it is a surprise, not a control.
const TAPS_NEEDED = 3;
const MAX_GAP_MS = 1500;

interface EasterEggTickProps {
  onUnlock: () => void;
  color: string;
  size?: number;
}

export function EasterEggTick({ onUnlock, color, size = 22 }: EasterEggTickProps) {
  const reducedMotion = useReducedMotion();
  const spin = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const taps = useRef(0);
  const lastTap = useRef(0);
  const celebrating = useRef(false);

  const onPress = () => {
    if (celebrating.current) return;
    const now = Date.now();
    taps.current = now - lastTap.current > MAX_GAP_MS ? 1 : taps.current + 1;
    lastTap.current = now;

    if (taps.current < TAPS_NEEDED) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      if (!reducedMotion) {
        Animated.sequence([
          Animated.timing(pop, { toValue: 1.18, duration: 90, useNativeDriver: true }),
          Animated.timing(pop, { toValue: 1, duration: 110, useNativeDriver: true }),
        ]).start();
      }
      return;
    }

    // Third tap: unlocked.
    taps.current = 0;
    celebrating.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    const finish = () => {
      spin.setValue(0);
      pop.setValue(1);
      celebrating.current = false;
      onUnlock();
    };

    if (reducedMotion) {
      finish();
      return;
    }
    Animated.parallel([
      Animated.timing(spin, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(pop, { toValue: 1.7, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pop, { toValue: 1, duration: 450, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    ]).start(finish);
  };

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Pressable
      onPress={onPress}
      hitSlop={14}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Animated.View style={{ transform: [{ scale: pop }, { rotate }] }}>
        <Ionicons name="checkmark-circle" size={size} color={color} />
      </Animated.View>
    </Pressable>
  );
}
