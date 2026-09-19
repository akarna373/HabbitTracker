import { memo, useEffect, useRef, useState } from "react";
import { Animated, AppState, StyleSheet, View } from "react-native";
import { useStore } from "../lib/store";
import { DEFAULT_OVERLAY_ALPHA, overlayColor, SUMMARY_CARD_RADIUS } from "../lib/summaryTheme";
import { useReducedMotion } from "../lib/useReducedMotion";
import { SUMMARY_BACKGROUNDS, type SummaryBackgroundEntry } from "./summaryBackgrounds/registry";

const CROSSFADE_MS = 350;
const CHECK_EVERY_MS = 60_000;

// One full background: the scene plus the dark layer that keeps the text on top
// readable. They fade together, so the look never flickers between the two.
const Layer = memo(function Layer({ index }: { index: number }) {
  const entry: SummaryBackgroundEntry = SUMMARY_BACKGROUNDS[index] ?? SUMMARY_BACKGROUNDS[0];
  const Scene = entry.Scene;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Scene />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor(entry.overlay ?? DEFAULT_OVERLAY_ALPHA) }]} />
    </View>
  );
});

// The artwork behind the Today's Summary card and the Summary screen's header.
// Fills its parent, ignores touches and is hidden from screen readers.
//
// Which scene shows is decided by the rotation in lib/backgroundRotation.ts and
// held in the store. This component only DISPLAYS it: it re-renders when the
// chosen index changes and for nothing else (no money figure, habit or log
// change reaches it), and it never picks anything at random itself.
function SummaryBackgroundImpl() {
  const index = useStore((s) => s.summaryBackground.index);
  const refresh = useStore((s) => s.refreshSummaryBackground);
  const reducedMotion = useReducedMotion();

  const shownIndex = useRef(index);
  const [layers, setLayers] = useState<{ from: number | null; to: number }>({ from: null, to: index });
  const fade = useRef(new Animated.Value(1)).current;

  // A new two-day period can begin while the app stays open (it crosses local
  // midnight), so re-check when it comes to the foreground and once a minute.
  // The check itself is a cheap date comparison that changes nothing unless the
  // period really ended.
  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, CHECK_EVERY_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refresh]);

  // Gentle crossfade to the new scene; an instant swap with reduce-motion on.
  useEffect(() => {
    if (index === shownIndex.current) return;
    const previous = shownIndex.current;
    shownIndex.current = index;

    if (reducedMotion) {
      fade.setValue(1);
      setLayers({ from: null, to: index });
      return;
    }
    fade.setValue(0);
    setLayers({ from: previous, to: index });
    const animation = Animated.timing(fade, { toValue: 1, duration: CROSSFADE_MS, useNativeDriver: true });
    animation.start(({ finished }) => {
      if (finished) setLayers({ from: null, to: index });
    });
    return () => animation.stop();
  }, [index, reducedMotion, fade]);


  return (
    <View style={styles.layer} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {layers.from === null ? null : <Layer index={layers.from} />}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <Layer index={layers.to} />
      </Animated.View>
    </View>
  );
}

export const SummaryBackground = memo(SummaryBackgroundImpl);

// Fills exactly the box the card gives it and clips to the card's corners; it
// takes no part in the card's layout, so no image can change the card's size.
const styles = StyleSheet.create({
  layer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, overflow: "hidden", borderRadius: SUMMARY_CARD_RADIUS },
});
