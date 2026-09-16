import { useRef, useState } from "react";
import { GestureResponderEvent, PanResponder, Pressable, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from "react-native-svg";
import { hsvToHex, shadesOf } from "../lib/color";
import { colors, radii, spacing } from "../lib/theme";

const WHEEL_SIZE = 220;
const WHEEL_RADIUS = WHEEL_SIZE / 2;
const WEDGES = 60; // 6deg steps - SVG has no native conic gradient, so hue is approximated as thin solid wedges

interface Props {
  onPick: (hex: string) => void;
}

function describeWedge(cx: number, cy: number, r: number, startDeg: number, endDeg: number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2} Z`;
}

const WEDGE_PATHS = Array.from({ length: WEDGES }, (_, i) => {
  const start = (i * 360) / WEDGES;
  const end = ((i + 1) * 360) / WEDGES;
  const mid = (start + end) / 2;
  return { path: describeWedge(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_RADIUS, start, end), color: hsvToHex(mid, 1, 1) };
});

// Hue = angle around the wheel, saturation = distance from center (full at
// the rim, white/desaturated in the middle) - a real color wheel, not a
// hex code, since most people can point at a color far more easily than
// they can type one.
export function ColorWheelPicker({ onPick }: Props) {
  const [selected, setSelected] = useState<{ x: number; y: number; hex: string } | null>(null);

  const handleTouch = (locX: number, locY: number) => {
    const dx = locX - WHEEL_RADIUS;
    const dy = locY - WHEEL_RADIUS;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const radius = Math.min(dist, WHEEL_RADIUS);
    const angleRad = Math.atan2(dy, dx);
    const hue = ((angleRad * 180) / Math.PI + 360) % 360;
    const saturation = radius / WHEEL_RADIUS;
    const hex = hsvToHex(hue, saturation, 1);
    const clampedX = WHEEL_RADIUS + Math.cos(angleRad) * radius;
    const clampedY = WHEEL_RADIUS + Math.sin(angleRad) * radius;
    setSelected({ x: clampedX, y: clampedY, hex });
  };

  const respond = (e: GestureResponderEvent) => handleTouch(e.nativeEvent.locationX, e.nativeEvent.locationY);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: respond,
      onPanResponderMove: respond,
    })
  ).current;

  const shades = selected ? shadesOf(selected.hex) : [];

  return (
    <View style={styles.container}>
      <View style={styles.wheelWrap} {...panResponder.panHandlers}>
        <Svg width={WHEEL_SIZE} height={WHEEL_SIZE}>
          <Defs>
            <RadialGradient id="satFade" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity={1} />
              <Stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          {WEDGE_PATHS.map((w, i) => (
            <Path key={i} d={w.path} fill={w.color} />
          ))}
          <Circle cx={WHEEL_RADIUS} cy={WHEEL_RADIUS} r={WHEEL_RADIUS} fill="url(#satFade)" />
        </Svg>
        {selected ? (
          <View
            pointerEvents="none"
            style={[styles.thumb, { left: selected.x - 11, top: selected.y - 11, backgroundColor: selected.hex }]}
          />
        ) : null}
      </View>

      {selected ? (
        <View style={styles.shadeRow}>
          {shades.map((hex, i) => (
            <Pressable key={i} style={[styles.shadeTile, { backgroundColor: hex }]} onPress={() => onPick(hex)} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: "center" },
  wheelWrap: { width: WHEEL_SIZE, height: WHEEL_SIZE },
  thumb: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: colors.textPrimary,
  },
  shadeRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  shadeTile: { width: 48, height: 48, borderRadius: radii.chip, borderWidth: 1, borderColor: colors.border },
});
