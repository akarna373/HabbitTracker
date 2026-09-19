import { useMemo, useState } from "react";
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { generateBubbles, type Bubble } from "../lib/bubbleLayout";

// The texture behind the Habits and Upcoming Tasks tiles: a black-grey base with a
// few glossy glass bubbles on it. Both tiles use this one component, so they share
// the same texture and depth.
//
// Every bubble stands alone and there are only a few - see lib/bubbleLayout.ts for
// the placement rules. `variant` gives each tile its own arrangement. Pure vector
// drawing: sharp at any density and no image weight.

const TINTS = { pink: "#ff8fb8", violet: "#b39bff", aqua: "#7fdcff" } as const;
type Tint = keyof typeof TINTS;

let instanceCounter = 0;

function BubbleShape({ bubble, id }: { bubble: Bubble; id: string }) {
  const { x, y, r, tint, medium } = bubble;
  const hx = x - r * 0.36;
  const hy = y - r * 0.4;

  // A small reflected crescent low on the right side, like light passing through.
  const arcR = r * 0.76;
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const arc =
    `M${x + arcR * Math.cos(rad(20))} ${y + arcR * Math.sin(rad(20))} ` +
    `A${arcR} ${arcR} 0 0 1 ${x + arcR * Math.cos(rad(70))} ${y + arcR * Math.sin(rad(70))}`;

  return (
    <G>
      <Circle cx={x} cy={y} r={r} fill={`url(#${id}-body-${tint})`} />
      <Circle cx={x} cy={y} r={r} fill="none" stroke="#ffffff" strokeOpacity={0.3} strokeWidth={1} />
      <Ellipse cx={hx} cy={hy} rx={r * 0.26} ry={r * 0.13} fill="#ffffff" opacity={0.62} transform={`rotate(-35 ${hx} ${hy})`} />
      {medium ? <Path d={arc} fill="none" stroke="#ffffff" strokeOpacity={0.22} strokeWidth={Math.max(1, r * 0.06)} strokeLinecap="round" /> : null}
    </G>
  );
}

// The strip on the right where bubbles may go - the rest is kept clear for text.
// Give the width in dp, or as a fraction of the tile; the wider of the two wins.
export interface BubbleZone {
  dp?: number;
  fraction?: number;
}

interface BubbleBackgroundProps {
  variant?: 0 | 1;
  zone?: BubbleZone;
  // Keep bubbles clear of the floating + button that sits over the tile's right end.
  avoidFab?: boolean;
  // Corner radius of the tile this fills, so the artwork clips to it exactly.
  radius: number;
}

export function BubbleBackground({ variant = 0, radius, zone, avoidFab = false }: BubbleBackgroundProps) {
  // Gradient ids are global to the app on some platforms, so each instance gets its own.
  const [id] = useState(() => `bb${++instanceCounter}`);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const onLayout = (event: LayoutChangeEvent) => {
    // Rounded so tiny layout jitter doesn't rebuild the bubbles.
    const w = Math.round(event.nativeEvent.layout.width / 8) * 8;
    const h = Math.round(event.nativeEvent.layout.height / 8) * 8;
    setSize((previous) => (previous && previous.w === w && previous.h === h ? previous : { w, h }));
  };

  const zoneDp = zone?.dp ?? 0;
  const zoneFraction = zone?.fraction ?? 0;
  const bubbles = useMemo(() => {
    if (!size || size.w <= 0 || size.h <= 0) return [];
    const zoneWidth = Math.max(zoneDp, size.w * zoneFraction);
    // The + button spans FAB_SIZE at the tile's right edge, 60-130 dp above the tile's
    // bottom edge (its bottom offset plus a little slack for the gap under the tile).
    const keepOut = avoidFab ? [{ x: size.w - 64, y: size.h - 130, w: 64, h: 70 }] : [];
    return generateBubbles(size.w, size.h, 2024 + variant * 7919, size.w - zoneWidth, keepOut);
  }, [size, variant, zoneDp, zoneFraction, avoidFab]);

  return (
    <View
      style={[styles.layer, { borderRadius: radius }]}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      onLayout={onLayout}
    >
      {size && size.w > 0 && size.h > 0 ? (
        <Svg width="100%" height="100%" viewBox={`0 0 ${size.w} ${size.h}`}>
          <Defs>
            <LinearGradient id={`${id}-base`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#1b1b20" />
              <Stop offset="0.55" stopColor="#25262c" />
              <Stop offset="1" stopColor="#17171b" />
            </LinearGradient>
            <RadialGradient id={`${id}-sheen`} cx="0.15" cy="0" r="0.8">
              <Stop offset="0" stopColor="#ffffff" stopOpacity="0.06" />
              <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
            </RadialGradient>
            {(Object.keys(TINTS) as Tint[]).map((tint) => (
              <RadialGradient key={tint} id={`${id}-body-${tint}`} cx="0.35" cy="0.3" r="0.8">
                <Stop offset="0" stopColor="#ffffff" stopOpacity="0.2" />
                <Stop offset="0.55" stopColor={TINTS[tint]} stopOpacity="0.06" />
                <Stop offset="1" stopColor={TINTS[tint]} stopOpacity="0.26" />
              </RadialGradient>
            ))}
          </Defs>
          <Rect width={size.w} height={size.h} fill={`url(#${id}-base)`} />
          <Rect width={size.w} height={size.h} fill={`url(#${id}-sheen)`} />
          {bubbles.map((bubble, i) => (
            <BubbleShape key={i} bubble={bubble} id={id} />
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden", backgroundColor: "#1b1b20" },
});
