import { useMemo, useRef, useState } from "react";
import { Animated, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent, type ViewStyle } from "react-native";
import { useFinancialSummary } from "../lib/financialSummarySelectors";
import { buildReflectionCards } from "../lib/reflection";
import { useStore } from "../lib/store";
import { SUMMARY_CARD_RADIUS } from "../lib/summaryTheme";
import { spacing } from "../lib/theme";
import { useMinuteClock } from "../lib/useMinuteClock";
import { useReducedMotion } from "../lib/useReducedMotion";
import { ReflectionCard } from "./ReflectionCard";
import { SummaryBackground } from "./SummaryBackground";
import { SummaryDashboardCard } from "./SummaryDashboardCard";

// A page being swiped away (or in) shrinks and fades a little, so the change reads as
// one movement instead of two flat panels sliding past each other.
const SIDE_SCALE = 0.94;
const SIDE_OPACITY = 0.55;
// How the swipe settles. "normal" glides to the next card; "fast" (the earlier setting)
// stops almost at once on Android and felt abrupt. A number between 0.9 (fast) and
// 0.99 (slow) also works.
const DECELERATION = "normal";
// Page dots: each sits in a slot of this width. The active one is a pill that moves
// like a drop of liquid: its leading edge runs ahead and its trailing edge lags, so it
// stretches between two dots and then pulls back together.
const SLOT = 16;
const DOT = 6;
const PILL_HALF = 3; // at rest the pill is DOT + 2 * PILL_HALF = 12 wide
const STRETCH_POWER = 2.5; // higher = the edges part more in the middle of a move
const STEPS = 10; // samples per page-to-page move (the curve is piecewise linear)
const FRAME_BORDER = 1;

// The swipeable card area at the top of Today. The frame and the rotating scene behind
// it are fixed: only the content (the money card's figures, or a reflection) slides,
// clipped to the frame's rounded corners. It adapts to the person: the money card is
// there only when they have cost-tracked quit habits, and each reflection card only
// when they have habits of that kind. Pages are as tall as the tallest one, so the
// frame never changes size as they swipe.
export function TodayCarousel() {
  const summary = useFinancialSummary();
  const habits = useStore((s) => s.habits);
  const logsByHabit = useStore((s) => s.logsByHabit);
  const { today } = useMinuteClock();
  const reducedMotion = useReducedMotion();

  const cards = useMemo(() => buildReflectionCards({ habits, logsByHabit, today }), [habits, logsByHabit, today]);
  // Also shown when a cost-tracked habit only lacks its baseline, so the card can say so.
  const showMoney = summary.hasSufficientData || summary.habitsNeedingBaseline.length > 0;
  const pageCount = cards.length + (showMoney ? 1 : 0);

  // Each page is exactly as wide as the room inside the frame; measured once laid out.
  const { width: windowWidth } = useWindowDimensions();
  const [pageWidth, setPageWidth] = useState(windowWidth - spacing.lg * 2 - FRAME_BORDER * 2);
  const [page, setPage] = useState(0);
  const activePage = Math.min(page, pageCount - 1);

  // The scroll position drives everything below on the native side, so the page
  // motion and the dot indicator follow the finger frame by frame.
  const scrollX = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () =>
      Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
        listener: (event: { nativeEvent: { contentOffset: { x: number } } }) => {
          const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
          setPage((previous) => (previous === next ? previous : next));
        },
      }),
    [scrollX, pageWidth]
  );

  const onScrollerLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (next > 0 && Math.abs(next - pageWidth) > 0.5) setPageWidth(next);
  };

  // The pill is two round caps joined by a bar, so it stays a clean pill at any length
  // (stretching one shape would squash its rounded ends). Both caps follow the scroll
  // position: the leading one eases out, the trailing one eases in. Everything is a
  // native-driver interpolation of the scroll offset, so it tracks the finger exactly,
  // forwards and backwards.
  const indicator = useMemo(() => {
    const last = pageCount - 1;
    if (last < 1) return null;
    const inputs: number[] = [];
    const trail: number[] = []; // centre of the trailing cap
    const lead: number[] = []; // centre of the leading cap
    for (let i = 0; i < last; i++) {
      const rest = i * SLOT + SLOT / 2;
      for (let k = 0; k < STEPS; k++) {
        const t = k / STEPS;
        inputs.push((i + t) * pageWidth);
        trail.push(rest - PILL_HALF + SLOT * Math.pow(t, STRETCH_POWER));
        lead.push(rest + PILL_HALF + SLOT * (1 - Math.pow(1 - t, STRETCH_POWER)));
      }
    }
    const finalRest = last * SLOT + SLOT / 2;
    inputs.push(last * pageWidth);
    trail.push(finalRest - PILL_HALF);
    lead.push(finalRest + PILL_HALF);

    const follow = (outputRange: number[]) => scrollX.interpolate({ inputRange: inputs, outputRange, extrapolate: "clamp" });
    return {
      trailingCap: follow(trail.map((x) => x - DOT / 2)),
      leadingCap: follow(lead.map((x) => x - DOT / 2)),
      // A 1-dp-wide bar scaled to the gap between the two cap centres.
      barX: follow(trail.map((x, k) => (x + lead[k]) / 2 - 0.5)),
      barScale: follow(trail.map((x, k) => lead[k] - x)),
    };
  }, [scrollX, pageWidth, pageCount]);

  const renderPage = (key: string, index: number, node: React.ReactNode) => {
    const style: Animated.WithAnimatedObject<ViewStyle> = { width: pageWidth };
    if (!reducedMotion) {
      const range = [(index - 1) * pageWidth, index * pageWidth, (index + 1) * pageWidth];
      style.opacity = scrollX.interpolate({ inputRange: range, outputRange: [SIDE_OPACITY, 1, SIDE_OPACITY], extrapolate: "clamp" });
      style.transform = [
        { scale: scrollX.interpolate({ inputRange: range, outputRange: [SIDE_SCALE, 1, SIDE_SCALE], extrapolate: "clamp" }) },
      ];
    }
    return (
      <Animated.View key={key} style={style}>
        {node}
      </Animated.View>
    );
  };

  const offset = showMoney ? 1 : 0;

  return (
    <View style={styles.frame}>
      <SummaryBackground />

      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={pageWidth}
        snapToAlignment="start"
        decelerationRate={DECELERATION}
        disableIntervalMomentum
        overScrollMode="never"
        scrollEventThrottle={16}
        onScroll={onScroll}
        onLayout={onScrollerLayout}
        style={styles.scroller}
      >
        {showMoney ? renderPage("money", 0, <SummaryDashboardCard />) : null}
        {cards.map((card, i) => renderPage(card.id, i + offset, <ReflectionCard card={card} />))}
      </Animated.ScrollView>

      {pageCount > 1 ? (
        <View
          style={styles.dots}
          pointerEvents="none"
          accessible
          accessibilityLabel={`Card ${activePage + 1} of ${pageCount}. Swipe for more.`}
        >
          <View style={[styles.dotRow, { width: pageCount * SLOT }]}>
            {Array.from({ length: pageCount }, (_, i) => (
              <View key={i} style={styles.slot}>
                <View style={styles.dot} />
              </View>
            ))}
            {indicator ? (
              <>
                <Animated.View style={[styles.cap, { transform: [{ translateX: indicator.trailingCap }] }]} />
                <Animated.View style={[styles.cap, { transform: [{ translateX: indicator.leadingCap }] }]} />
                <Animated.View
                  style={[styles.bar, { transform: [{ translateX: indicator.barX }, { scaleX: indicator.barScale }] }]}
                />
              </>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignSelf: "stretch",
    minHeight: 236,
    marginBottom: spacing.md,
    borderRadius: SUMMARY_CARD_RADIUS,
    overflow: "hidden",
    borderWidth: FRAME_BORDER,
    borderColor: "rgba(255,79,139,0.45)",
    backgroundColor: "#141026",
  },
  // Takes any height the frame's minimum adds, so every page fills the frame.
  scroller: { flexGrow: 1 },
  dots: { position: "absolute", left: 0, right: 0, bottom: 8, alignItems: "center" },
  dotRow: { flexDirection: "row", height: DOT, alignItems: "center" },
  slot: { width: SLOT, height: DOT, alignItems: "center", justifyContent: "center" },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: "rgba(255,255,255,0.35)" },
  cap: { position: "absolute", left: 0, top: 0, width: DOT, height: DOT, borderRadius: DOT / 2, backgroundColor: "#FFFFFF" },
  bar: { position: "absolute", left: 0, top: 0, width: 1, height: DOT, backgroundColor: "#FFFFFF" },
});
