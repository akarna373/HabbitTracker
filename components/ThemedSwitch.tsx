import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { colors } from "../lib/theme";

interface Props {
  value: boolean;
  onValueChange: (value: boolean) => void;
}

const WIDTH = 50;
const HEIGHT = 30;
const THUMB_SIZE = 24;
const PADDING = 3;

// The native Switch snaps its thumb instantly on Android instead of sliding -
// this is a fully custom, animated stand-in with the same value/onValueChange
// shape, so it can drop in anywhere a Switch is used.
export function ThemedSwitch({ value, onValueChange }: Props) {
  const progress = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, { toValue: value ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [value, progress]);

  const trackColor = progress.interpolate({ inputRange: [0, 1], outputRange: [colors.border, colors.accentPink] });
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, WIDTH - THUMB_SIZE - PADDING * 2] });

  return (
    <Pressable onPress={() => onValueChange(!value)} hitSlop={8}>
      <Animated.View style={[styles.track, { backgroundColor: trackColor }]}>
        <Animated.View style={[styles.thumb, { transform: [{ translateX }] }]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: WIDTH,
    height: HEIGHT,
    borderRadius: HEIGHT / 2,
    padding: PADDING,
    justifyContent: "center",
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.textPrimary,
  },
});
