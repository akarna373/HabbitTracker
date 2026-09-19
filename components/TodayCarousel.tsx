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
// Page dots: each sits in a slot of this width; a single indicator glides across them.
const SLOT = 16;
const INDICATOR_WIDTH = 12;
const INDICATOR_STRETCH = 1.5; // how much the indicator stretches half-way between two dots
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
  const showMoney = summary.hasSufficientData;
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

  // Indicator: slides one slot per page and stretches in the middle of each move.
  const indicator = useMemo(() => {
    const last = Math.max(pageCount - 1, 1);
    const translateX = scrollX.interpolate({
      inputRange: [0, pageWidth * last],
      outputRange: [0, SLOT * last],
      extrapolate: "clamp",
    });
    const stops: number[] = [];
    const stretch: number[] = [];
    for (let i = 0; i <= last * 2; i++) {
      stops.push((pageWidth * i) / 2);
      stretch.push(i % 2 === 0 ? 1 : INDICATOR_STRETCH);
    }
    const scaleX = scrollX.interpolate({ inputRange: stops, outputRange: stretch, extrapolate: "clamp" });
    return { translateX, scaleX };
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
        decelerationRate="fast"
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
            <Animated.View
              style={[styles.indicator, { transform: [{ translateX: indicator.translateX }, { scaleX: indicator.scaleX }] }]}
            />
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
  dotRow: { flexDirection: "row", height: 6, alignItems: "center" },
  slot: { width: SLOT, height: 6, alignItems: "center", justifyContent: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.35)" },
  indicator: {
    position: "absolute",
    left: (SLOT - INDICATOR_WIDTH) / 2,
    top: 0,
    width: INDICATOR_WIDTH,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
});
