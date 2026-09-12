import * as Haptics from "expo-haptics";
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { PanGestureHandler, State, type PanGestureHandlerGestureEvent, type PanGestureHandlerStateChangeEvent } from "react-native-gesture-handler";
import { colors } from "../lib/theme";

export const WHEEL_ITEM_HEIGHT = 40;
const VISIBLE_ROWS = 5; // odd, so there's a true center row
const SIDE_ROWS = Math.floor(VISIBLE_ROWS / 2);
// How many extra rows render past the visible window on each side, so a
// normal single-flick drag never runs out of rendered rows before the
// gesture ends and the anchor re-centers on the new value.
const BUFFER_ROWS = 12;
const DEFAULT_SENSITIVITY = 1.8;
// How much a release's velocity (px/s) shifts the landing spot further than
// where the finger actually let go, like a real flick.
const FLING_SECONDS = 0.15;
// A short list (AM/PM) shouldn't multi-cycle on a single drag - a moderate
// swipe should flip it once, not spin through it repeatedly (with only 2
// labels, spinning several steps looks identical to spinning one, which
// read as an endless, pointless loop).
const SHORT_LIST_MAX = 4;

interface Props {
  data: string[];
  selectedIndex: number;
  onChange: (index: number) => void;
  // Lower for short lists (e.g. AM/PM) - the same amplification that makes a
  // 60-item minute wheel feel responsive makes a 2-item wheel feel twitchy.
  sensitivity?: number;
  // When set, tapping the center value opens a numeric keyboard instead of
  // requiring the wheel to be dragged/tapped-stepped - data[i] is assumed to
  // be String(min + i), so a typed number maps straight back to an index.
  numericEntry?: { min: number; max: number };
}

function tick() {
  try {
    Haptics.selectionAsync();
  } catch {
    // Device/emulator without haptic support - ignore.
  }
}

function wrap(i: number, length: number) {
  return ((i % length) + length) % length;
}

// A drag-to-spin wheel (like a phone's slide-to-unlock dial), built on
// react-native-gesture-handler's PanGestureHandler - the same gesture system
// react-native-gesture-handler's Swipeable (used for the habit-tile swipe
// actions elsewhere in this app) already relies on successfully, unlike a
// plain ScrollView which didn't register drags reliably inside this
// component's Modal. Tapping the row shown above/below center also jumps
// straight to it. A flick lands further than the raw drag distance (using
// release velocity), landing spot is committed synchronously on release -
// a fancier "keeps visibly gliding after release" version introduced a
// stale-async-callback race that could corrupt state on a rapid re-swipe,
// so this stays deliberately simple: no animation outlives the gesture.
export function DragWheelColumn({ data, selectedIndex, onChange, sensitivity = DEFAULT_SENSITIVITY, numericEntry }: Props) {
  const translateY = useRef(new Animated.Value(0)).current;
  const scaledTranslateY = Animated.multiply(translateY, sensitivity);
  const baseIndex = useRef(selectedIndex);
  const lastTickIndex = useRef(selectedIndex);
  const isDragging = useRef(false);
  const maxSteps = data.length <= SHORT_LIST_MAX ? 1 : Infinity;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (isDragging.current) return;
    baseIndex.current = selectedIndex;
    lastTickIndex.current = selectedIndex;
    translateY.setValue(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  useEffect(() => {
    if (!editing) return;
    // A .focus() called the instant the TextInput mounts can select the
    // text without actually opening the soft keyboard on Android (the
    // native view isn't fully attached to the window yet) - a tick later
    // it reliably does both.
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [editing]);

  const stepsFromTranslation = (ty: number) => {
    const raw = Math.round((ty * sensitivity) / WHEEL_ITEM_HEIGHT);
    return Math.sign(raw) * Math.min(Math.abs(raw), maxSteps);
  };
  const indexFromTranslation = (ty: number) => wrap(baseIndex.current - stepsFromTranslation(ty), data.length);

  const onGestureEvent = Animated.event([{ nativeEvent: { translationY: translateY } }], {
    useNativeDriver: false,
    listener: (e: PanGestureHandlerGestureEvent) => {
      isDragging.current = true;
      const idx = indexFromTranslation(e.nativeEvent.translationY);
      if (idx !== lastTickIndex.current) {
        lastTickIndex.current = idx;
        tick();
      }
    },
  });

  const onHandlerStateChange = (e: PanGestureHandlerStateChangeEvent) => {
    if (e.nativeEvent.oldState === State.ACTIVE) {
      const { translationY, velocityY } = e.nativeEvent;
      const projected = translationY + velocityY * FLING_SECONDS;
      const idx = indexFromTranslation(projected);
      isDragging.current = false;
      baseIndex.current = idx;
      Animated.spring(translateY, { toValue: 0, useNativeDriver: false, friction: 9, tension: 90 }).start(() => {
        translateY.setValue(0);
      });
      if (idx !== selectedIndex) onChange(idx);
    }
  };

  const step = (delta: number) => {
    tick();
    onChange(wrap(selectedIndex + delta, data.length));
  };

  const openKeyboardEntry = () => {
    if (!numericEntry) return;
    setDraft(data[selectedIndex] ?? "");
    setEditing(true);
  };

  const commitKeyboardEntry = () => {
    setEditing(false);
    if (!numericEntry) return;
    const n = parseInt(draft, 10);
    if (Number.isNaN(n)) return;
    const clamped = Math.max(numericEntry.min, Math.min(numericEntry.max, n));
    const idx = clamped - numericEntry.min;
    baseIndex.current = idx;
    if (idx !== selectedIndex) onChange(idx);
  };

  // Only wrap the DISPLAY (cyclic repeat) when there's enough data to make
  // that feel intentional - a short list (e.g. AM/PM, 2 items) wrapping this
  // many rows would show "AM PM AM PM AM", which reads as a bug, not a
  // wheel. The underlying value still wraps correctly either way (AM<->PM
  // cycling on drag/tap is correct) - this only affects which rows render.
  const wrapsVisually = data.length > VISIBLE_ROWS;
  const rows: { d: number; idx: number | null }[] = [];
  for (let d = -(SIDE_ROWS + BUFFER_ROWS); d <= SIDE_ROWS + BUFFER_ROWS; d++) {
    const raw = baseIndex.current + d;
    const idx = wrapsVisually ? wrap(raw, data.length) : raw >= 0 && raw < data.length ? raw : null;
    rows.push({ d, idx });
  }

  if (editing) {
    return (
      <View style={styles.wheel}>
        <View style={styles.centerBand}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            keyboardType="number-pad"
            maxLength={2}
            selectTextOnFocus
            value={draft}
            onChangeText={(t) => setDraft(t.replace(/[^0-9]/g, ""))}
            onSubmitEditing={commitKeyboardEntry}
            onBlur={commitKeyboardEntry}
          />
        </View>
      </View>
    );
  }

  return (
    <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
      <Animated.View style={styles.wheel}>
        <View pointerEvents="none" style={styles.centerBand} />
        <Animated.View style={{ marginTop: -BUFFER_ROWS * WHEEL_ITEM_HEIGHT, transform: [{ translateY: scaledTranslateY }] }}>
          {rows.map(({ d, idx }) => {
            const rowCenter = -d * WHEEL_ITEM_HEIGHT;
            const inputRange = [
              rowCenter - 2 * WHEEL_ITEM_HEIGHT,
              rowCenter - WHEEL_ITEM_HEIGHT,
              rowCenter,
              rowCenter + WHEEL_ITEM_HEIGHT,
              rowCenter + 2 * WHEEL_ITEM_HEIGHT,
            ];
            const opacity = scaledTranslateY.interpolate({ inputRange, outputRange: [0.2, 0.45, 1, 0.45, 0.2], extrapolate: "clamp" });
            const fontSize = scaledTranslateY.interpolate({ inputRange, outputRange: [15, 19, 24, 19, 15], extrapolate: "clamp" });
            return (
              <View key={d} style={styles.row}>
                <Animated.Text style={[styles.rowText, { opacity, fontSize }]}>{idx === null ? "" : data[idx]}</Animated.Text>
              </View>
            );
          })}
        </Animated.View>
        <Pressable style={styles.tapUpper} onPress={() => step(-1)} hitSlop={4} />
        {numericEntry ? <Pressable style={styles.tapCenter} onPress={openKeyboardEntry} hitSlop={4} /> : null}
        <Pressable style={styles.tapLower} onPress={() => step(1)} hitSlop={4} />
      </Animated.View>
    </PanGestureHandler>
  );
}

const WHEEL_HEIGHT = WHEEL_ITEM_HEIGHT * VISIBLE_ROWS;

const styles = StyleSheet.create({
  wheel: { width: 72, height: WHEEL_HEIGHT, overflow: "hidden" },
  centerBand: {
    position: "absolute",
    top: WHEEL_ITEM_HEIGHT * SIDE_ROWS,
    left: 0,
    right: 0,
    height: WHEEL_ITEM_HEIGHT,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  row: { height: WHEEL_ITEM_HEIGHT, alignItems: "center", justifyContent: "center" },
  rowText: { fontWeight: "700", color: colors.textPrimary },
  tapUpper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: WHEEL_ITEM_HEIGHT * SIDE_ROWS,
  },
  tapLower: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: WHEEL_ITEM_HEIGHT * SIDE_ROWS,
  },
  tapCenter: {
    position: "absolute",
    top: WHEEL_ITEM_HEIGHT * SIDE_ROWS,
    left: 0,
    right: 0,
    height: WHEEL_ITEM_HEIGHT,
  },
  input: {
    flex: 1,
    fontSize: 24,
    fontWeight: "700",
    color: colors.accentPink,
    textAlign: "center",
    padding: 0,
  },
});
