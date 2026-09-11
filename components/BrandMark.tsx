import LottieView from "lottie-react-native";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { colors } from "../lib/theme";

interface BrandMarkProps {
  size?: number;
}

// The habit mark: an unclosed ring that never quite meets itself, always
// turning - the small, repeatable motion the whole app is built around.
// The centre uses a Noto Emoji "grinning face" Lottie, recolored to the
// theme's pink palette (assets/lottie/happy-face.json, via
// scripts/recolor-happy-face.js) - its own keyframes already blink and bounce.
// It replays every few seconds rather than looping tight, so its ~2.3s
// animation doesn't feel busier than the ring's slow 7s spin / 1.6s breathe.
const FACE_REPLAY_INTERVAL_MS = 4500;

export function BrandMark({ size = 96 }: BrandMarkProps) {
  const rotate = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const lottieRef = useRef<LottieView>(null);
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

  useEffect(() => {
    if (reduceMotion) return;
    lottieRef.current?.play();
    const interval = setInterval(() => {
      lottieRef.current?.reset();
      lottieRef.current?.play();
    }, FACE_REPLAY_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reduceMotion]);

  const spinDeg = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] });
  const pulseOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] });

  const strokeWidth = Math.round(size * 0.09);
  const faceSize = Math.round(size * 0.46);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // 270 degrees drawn, 90 degrees left open - the "never quite meets itself" gap.
  const arcLength = circumference * 0.75;
  const gapLength = circumference * 0.25;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          opacity: pulseOpacity,
          transform: [{ rotate: spinDeg }, { scale }],
        }}
      >
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={colors.accentPink} />
              <Stop offset="100%" stopColor={colors.accentRed} />
            </LinearGradient>
          </Defs>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#ringGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${gapLength}`}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </Animated.View>
      <LottieView
        ref={lottieRef}
        source={require("../assets/lottie/happy-face.json")}
        loop={false}
        style={{ width: faceSize, height: faceSize }}
      />
    </View>
  );
}
