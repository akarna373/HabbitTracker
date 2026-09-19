import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { DayState, ReflectionCardData, ReflectionDay, ReflectionKind, ReflectionRing } from "../lib/reflection";
import { summaryColors as palette } from "../lib/summaryTheme";
import { colors, spacing } from "../lib/theme";

type IconName = React.ComponentProps<typeof Ionicons>["name"];

// Each kind of habit has its own accent, so the cards are told apart at a glance
// while sharing one dark look.
const ACCENT: Record<ReflectionKind, string> = {
  overview: colors.accentPink,
  medication: "#6CB6FF",
  fitness: "#53E38C",
  health: "#4DD6C8",
  study: "#B39DFF",
  quit: "#FFB547",
  starter: colors.accentPink,
};

const ICON: Record<ReflectionKind, IconName> = {
  overview: "sparkles-outline",
  medication: "medkit-outline",
  fitness: "walk-outline",
  health: "heart-outline",
  study: "school-outline",
  quit: "shield-checkmark-outline",
  starter: "add-circle-outline",
};

const RING_SIZE = 96;
const RING_STROKE = 10;
const DAY_DOT = 22;

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function spoken(card: ReflectionCardData): string {
  const parts = [card.title, card.message];
  if (card.ring) parts.push(`${card.ring.center} ${card.ring.caption}`);
  for (const stat of card.stats) parts.push(`${stat.label} ${stat.value}`);
  return parts.join(". ");
}

// A reflection on one kind of habit (or on all of them): a progress ring for today,
// three figures, and the last seven days as a strip. Only the content: the frame and
// the rotating scene behind it belong to Today's swiper (TodayCarousel) and stay put
// while this slides. The swiper makes every page as tall as the tallest one; this
// one just fills its page.
export function ReflectionCard({ card }: { card: ReflectionCardData }) {
  const accent = ACCENT[card.kind];

  return (
    <View style={styles.frame} accessible accessibilityLabel={spoken(card)}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.iconCircle, { backgroundColor: hexToRgba(accent, 0.16), borderColor: hexToRgba(accent, 0.4) }]}>
            <Ionicons name={ICON[card.kind]} size={18} color={accent} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={1}>
              {card.title}
            </Text>
            {card.ring ? (
              <Text style={styles.message} numberOfLines={2}>
                {card.message}
              </Text>
            ) : null}
          </View>
          {card.streak > 0 ? (
            <View style={[styles.streakPill, { borderColor: hexToRgba(accent, 0.45) }]}>
              <Ionicons name="flame-outline" size={13} color={accent} />
              <Text style={styles.streakText}>{card.streak}d</Text>
            </View>
          ) : null}
        </View>

        {card.ring ? (
          <View style={styles.body}>
            <Ring ring={card.ring} accent={accent} />
            <View style={styles.stats}>
              {card.stats.map((stat) => (
                <View key={stat.label} style={styles.statRow}>
                  <Text style={styles.statLabel} numberOfLines={1}>
                    {stat.label}
                  </Text>
                  <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {stat.value}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.starterText}>{card.message}</Text>
        )}

        {card.week ? <WeekStrip week={card.week} accent={accent} /> : null}
      </View>
    </View>
  );
}

function Ring({ ring, accent }: { ring: ReflectionRing; accent: string }) {
  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = Math.min(Math.max(ring.fraction, 0), 1);
  const center = RING_SIZE / 2;

  return (
    <View style={styles.ring}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle cx={center} cy={center} r={radius} stroke="rgba(255,255,255,0.10)" strokeWidth={RING_STROKE} fill="none" />
        {fraction > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={accent}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - fraction)}
            rotation={-90}
            origin={`${center}, ${center}`}
            fill="none"
          />
        ) : null}
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <Text style={styles.ringValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {ring.center}
        </Text>
        <Text style={styles.ringCaption} numberOfLines={2}>
          {ring.caption}
        </Text>
      </View>
    </View>
  );
}

function WeekStrip({ week, accent }: { week: ReflectionDay[]; accent: string }) {
  return (
    <View style={styles.strip}>
      {week.map((day) => (
        <View key={day.date} style={styles.dayColumn}>
          <DayDot state={day.state} accent={accent} />
          <Text style={[styles.dayLetter, day.isToday && styles.dayLetterToday]}>{day.letter}</Text>
        </View>
      ))}
    </View>
  );
}

function DayDot({ state, accent }: { state: DayState; accent: string }) {
  if (state === "done") {
    return (
      <View style={[styles.dot, { backgroundColor: accent }]}>
        <Ionicons name="checkmark" size={14} color={colors.background} />
      </View>
    );
  }
  if (state === "partial") {
    return (
      <View style={[styles.dot, { borderWidth: 2, borderColor: accent }]}>
        <View style={[styles.partialFill, { backgroundColor: hexToRgba(accent, 0.55) }]} />
      </View>
    );
  }
  if (state === "pending") {
    return <View style={[styles.dot, { borderWidth: 2, borderColor: accent, backgroundColor: hexToRgba(accent, 0.1) }]} />;
  }
  if (state === "missed") {
    return <View style={[styles.dot, { borderWidth: 1.5, borderColor: "rgba(255,255,255,0.22)" }]} />;
  }
  return (
    <View style={styles.dot}>
      <View style={styles.offDot} />
    </View>
  );
}

const styles = StyleSheet.create({
  // flexGrow, not flex: 1 - that has a zero basis, so the page would collapse and clip.
  frame: { flexGrow: 1 },
  // The bottom padding leaves room for the swiper's page dots.
  content: { paddingHorizontal: spacing.md, paddingTop: 16, paddingBottom: 26 },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: palette.text, fontSize: 16, fontWeight: "700", ...palette.textShadow },
  message: { color: palette.textDim, fontSize: 12.5, lineHeight: 17, marginTop: 1 },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: 13,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  streakText: { color: palette.text, fontSize: 12, fontWeight: "800" },
  body: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginTop: 14 },
  ring: { width: RING_SIZE, height: RING_SIZE },
  ringCenter: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: RING_STROKE + 4 },
  ringValue: { color: palette.text, fontSize: 21, fontWeight: "800", ...palette.textShadow },
  ringCaption: { color: palette.textDim, fontSize: 10, textAlign: "center", lineHeight: 12 },
  // One line per figure (label left, value right), so the three of them are no taller than
  // the ring and the card stays compact.
  stats: { flex: 1, gap: 6, minWidth: 0 },
  statRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  statLabel: { color: palette.textDim, fontSize: 11.5, fontWeight: "600", letterSpacing: 0.2, flexShrink: 1 },
  statValue: { color: palette.text, fontSize: 16, fontWeight: "800", ...palette.textShadow },
  starterText: { color: palette.text, fontSize: 15, lineHeight: 22, marginTop: 14, ...palette.textShadow },
  strip: { flexDirection: "row", justifyContent: "space-between", marginTop: 14, paddingHorizontal: 2 },
  dayColumn: { alignItems: "center", gap: 3 },
  dayLetter: { color: palette.textDim, fontSize: 10.5, fontWeight: "600" },
  dayLetterToday: { color: palette.text, fontWeight: "800" },
  dot: { width: DAY_DOT, height: DAY_DOT, borderRadius: DAY_DOT / 2, alignItems: "center", justifyContent: "center" },
  partialFill: { width: 8, height: 8, borderRadius: 4 },
  offDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.22)" },
});
