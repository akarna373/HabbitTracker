import { LinearGradient } from "expo-linear-gradient";
import { Image, StyleSheet, Text, View } from "react-native";
import type { ShareCardData } from "../lib/shareCard";
import { summaryColors as palette } from "../lib/summaryTheme";
import { brandFont, colors } from "../lib/theme";
import { SummaryBackground } from "./SummaryBackground";

// The picture that gets shared or saved. Portrait 4:5 (fits feeds and chats), on the same scene as the
// dashboard, with the Habbit name and mark on it. Only the numbers in `data` are drawn: this component
// cannot show a name, a habit or a place because it is never given one.
export const SHARE_CARD_ASPECT = 1.25; // height / width

// Everything is laid out for this width and scaled, so the preview and the saved picture look the same.
const DESIGN_WIDTH = 360;
const appIcon = require("../assets/icon.png");

export function ShareCard({ data, width }: { data: ShareCardData; width: number }) {
  const s = width / DESIGN_WIDTH;
  const height = width * SHARE_CARD_ASPECT;

  return (
    <View style={{ width, height, borderRadius: 26 * s, overflow: "hidden", backgroundColor: "#141026" }}>
      <SummaryBackground />
      {/* Darker top and bottom keep the text readable on any scene. */}
      <LinearGradient
        colors={["rgba(10,8,14,0.42)", "rgba(10,8,14,0.12)", "rgba(10,8,14,0.82)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={{ flex: 1, padding: 26 * s }}>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image source={appIcon} style={{ width: 38 * s, height: 38 * s, borderRadius: 10 * s }} />
            <Text style={[styles.wordmark, { fontSize: 30 * s, marginLeft: 10 * s }]}>Habbit</Text>
          </View>
          {data.monthLabel ? (
            <Text style={[styles.month, { fontSize: 14 * s }]} numberOfLines={1}>
              {data.monthLabel}
            </Text>
          ) : null}
        </View>

        <View style={styles.middle}>
          <Text style={[styles.heroLabel, { fontSize: 14 * s, letterSpacing: 1.2 * s }]}>{data.heroLabel.toUpperCase()}</Text>
          <Text
            style={[styles.heroValue, { fontSize: 66 * s, lineHeight: 78 * s }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.5}
          >
            {data.heroValue}
          </Text>

          {data.goal ? (
            <View style={{ marginTop: 14 * s }}>
              <View style={[styles.track, { height: 10 * s, borderRadius: 5 * s }]}>
                <View
                  style={{
                    width: `${Math.max(data.goal.percent, 2)}%`,
                    height: "100%",
                    borderRadius: 5 * s,
                    backgroundColor: palette.saved,
                  }}
                />
              </View>
              <Text style={[styles.goalCaption, { fontSize: 13 * s, marginTop: 8 * s }]}>{data.goal.caption}</Text>
            </View>
          ) : null}
        </View>

        {data.stats.length > 0 ? (
          <View style={[styles.stats, { paddingTop: 16 * s, marginBottom: 16 * s }]}>
            {data.stats.map((stat) => (
              <View key={stat.label} style={styles.stat}>
                <Text style={[styles.statValue, { fontSize: 24 * s }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
                  {stat.value}
                </Text>
                <Text style={[styles.statLabel, { fontSize: 12 * s }]} numberOfLines={1}>
                  {stat.label}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={[styles.footer, { fontSize: 13 * s }]}>Made with Habbit · A little better, daily.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  brand: { flexDirection: "row", alignItems: "center" },
  wordmark: { ...brandFont, ...palette.textShadow },
  month: { color: palette.textDim, fontWeight: "700", flexShrink: 1, marginLeft: 12, ...palette.textShadow },
  middle: { flex: 1, justifyContent: "center" },
  heroLabel: { color: palette.textDim, fontWeight: "700", ...palette.textShadow },
  heroValue: { color: palette.text, fontWeight: "800", ...palette.textShadow },
  track: { backgroundColor: "rgba(255,243,232,0.20)", overflow: "hidden" },
  goalCaption: { color: palette.textDim, fontWeight: "600", ...palette.textShadow },
  stats: { flexDirection: "row", borderTopWidth: 1, borderTopColor: palette.divider },
  stat: { flex: 1, minWidth: 0 },
  statValue: { color: palette.text, fontWeight: "800", ...palette.textShadow },
  statLabel: { color: palette.textDim, fontWeight: "600", marginTop: 2, ...palette.textShadow },
  footer: { color: palette.textDim, fontWeight: "600", textAlign: "center", ...palette.textShadow },
});

// The pink used for the brand accent elsewhere; exported so a caller can match it.
export const SHARE_CARD_ACCENT = colors.accentPink;
