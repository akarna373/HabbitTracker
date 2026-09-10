import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";

interface ColorFadeIconProps {
  name: keyof typeof Ionicons.glyphMap;
  colors: string[];
  size?: number;
}

// Cross-fades an icon through a list of colours, looping indefinitely.
export function ColorFadeIcon({ name, colors, size = 16 }: ColorFadeIconProps) {
  const opacities = useRef(colors.map((_, i) => new Animated.Value(i === 0 ? 1 : 0))).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    if (reduceMotion || colors.length < 2) return;
    let cancelled = false;

    const step = (index: number) => {
      if (cancelled) return;
      const next = (index + 1) % colors.length;
      Animated.parallel([
        Animated.timing(opacities[index], {
          toValue: 0,
          duration: 900,
          delay: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacities[next], {
          toValue: 1,
          duration: 900,
          delay: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => step(next));
    };

    step(0);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduceMotion]);

  return (
    <View style={{ width: size, height: size }}>
      {colors.map((c, i) => (
        <Animated.View key={c} style={{ position: "absolute", opacity: opacities[i] }}>
          <Ionicons name={name} size={size} color={c} />
        </Animated.View>
      ))}
    </View>
  );
}
