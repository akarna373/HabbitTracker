import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { LayoutChangeEvent, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ColorWheelPicker } from "../../../components/ColorWheelPicker";
import { RainbowSwatch } from "../../../components/RainbowSwatch";
import { ScreenHeader } from "../../../components/ScreenHeader";
import { selectLogForDate, useStore } from "../../../lib/store";
import { todayISO } from "../../../lib/dates";
import { colors, radii, spacing, typography } from "../../../lib/theme";

// A curated set of realistic pill colors - theme pink stays the default so
// the packet still matches the rest of the app unless the user picks
// something else. White leads (the most common real tablet color), with
// the full color-wheel entry right after it.
const PILL_COLORS = [
  { name: "White", value: "#F2F0F5" },
  { name: "Pink", value: colors.accentPink },
  { name: "Red", value: colors.accentRed },
  { name: "Yellow", value: colors.goalYellow },
  { name: "Green", value: colors.goalGreen },
  { name: "Blue", value: "#4F9DFF" },
  { name: "Purple", value: "#B565F5" },
];

// Real blister strips aren't one fixed shape - explicit, named entries for
// the common real-world packet sizes (columns x rows noted per entry),
// rather than trusting the general fallback below to keep guessing them
// right as more sizes come up.
const KNOWN_PACKET_COLUMNS: Record<number, number> = {
  5: 5, // 5x1
  10: 5, // 5x2
  15: 5, // 5x3
  28: 7, // 7x4 - standard contraceptive-pill pack
  30: 3, // 3x10
};

function columnsForPacketSize(size: number): number {
  if (KNOWN_PACKET_COLUMNS[size]) return KNOWN_PACKET_COLUMNS[size];
  if (size <= 20) return Math.min(size, 5);
  return 3;
}

const GAP = spacing.sm;
const MAX_PILL_SIZE = 44;

export default function MedicinePacketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const habit = useStore((s) => s.habits.find((h) => h.id === id));
  const logs = useStore((s) => s.logsByHabit[id ?? ""]);
  const setPillColorAction = useStore((s) => s.setPillColor);
  const [cardWidth, setCardWidth] = useState(0);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showWheel, setShowWheel] = useState(false);

  if (!habit) return null;

  const pillColor = habit.pillColor ?? colors.accentPink;
  const applyColor = (color: string) => {
    setPillColorAction(habit.id, color);
    setShowColorPicker(false);
  };

  const today = todayISO();
  const log = selectLogForDate(logs, today);
  const amountToday = log?.amount ?? 0;
  const total = habit.totalTabletsBought ?? habit.tabletsPerPacket ?? 0;
  const remaining = habit.stockRemaining ?? 0;
  const taken = Math.max(0, total - remaining);
  const packetSize = habit.tabletsPerPacket && habit.tabletsPerPacket > 0 ? habit.tabletsPerPacket : total || 1;

  // Real strips: what the user bought comes in fixed-size packets (the
  // "tablets per packet" they set up), not one giant undifferentiated grid
  // - 21 tablets at 10/packet is two full strips and one strip with just 1
  // tablet left in it, shown as three separate cards. Popped (taken) slots
  // are used up strip by strip, front to back.
  const packetCount = Math.max(1, Math.ceil(total / packetSize));
  let takenLeftToPlace = taken;
  const packets = Array.from({ length: packetCount }, (_, p) => {
    const sizeThisPacket = Math.min(packetSize, total - p * packetSize);
    const takenThisPacket = Math.min(takenLeftToPlace, sizeThisPacket);
    takenLeftToPlace -= takenThisPacket;
    return Array.from({ length: sizeThisPacket }, (_, i) => i < takenThisPacket);
  });

  // Same column count (from the full packet size, never from how many
  // tablets happen to be left in the last strip) for every packet on this
  // screen, so a strip down to its last tablet still uses the identical
  // slot/pill size as a full one - never oversized, never overflowing.
  const columns = columnsForPacketSize(packetSize);
  const innerWidth = cardWidth > 0 ? cardWidth - spacing.lg * 2 : 0;
  // Floored, not exact division - a fractional slot width (e.g. 60.8px)
  // rounds up on-device often enough that 5 slots' rendered widths sum to
  // slightly more than the container, tipping the 5th onto the next row
  // instead of sitting beside the other 4.
  const slotSize = innerWidth > 0 ? Math.floor(innerWidth / columns) : 0;
  const pillSize = slotSize > 0 ? Math.max(16, Math.min(MAX_PILL_SIZE, slotSize - GAP)) : MAX_PILL_SIZE;

  const onCardLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (Math.abs(w - cardWidth) > 1) setCardWidth(w);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Medicine packet" subtitle="Visual overview of your medicine" />
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable
          onPress={() => {
            setShowWheel(false);
            setShowColorPicker(true);
          }}
          hitSlop={8}
          style={styles.colorLink}
        >
          <View style={[styles.colorLinkSwatch, { backgroundColor: pillColor }]} />
          <Text style={styles.colorLinkText}>Change Pill Color</Text>
        </Pressable>

        {packets.map((slots, p) => (
          <View key={p} style={styles.packet} onLayout={p === 0 ? onCardLayout : undefined}>
            {p === 0 ? (
              <>
                <Text style={styles.medicineName}>{habit.name}</Text>
                <Text style={styles.doseLine}>
                  {habit.doseAmount ?? ""} {habit.doseUnit ?? ""}
                </Text>
              </>
            ) : null}

            <View style={styles.grid}>
              {slots.map((isTaken, i) => (
                <View key={i} style={{ width: slotSize || undefined, height: (slotSize || pillSize) + GAP, alignItems: "center", justifyContent: "center" }}>
                  {isTaken ? (
                    <View
                      style={[
                        styles.pillPopped,
                        { width: pillSize, height: pillSize, borderRadius: pillSize / 2 },
                      ]}
                    >
                      <View
                        style={[
                          styles.pillPoppedHole,
                          { width: pillSize * 0.55, height: pillSize * 0.55, borderRadius: (pillSize * 0.55) / 2 },
                        ]}
                      />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.bubble,
                        { width: pillSize + 6, height: pillSize + 6, borderRadius: (pillSize + 6) / 2 },
                      ]}
                    >
                      <View
                        style={[
                          styles.pillFull,
                          { width: pillSize, height: pillSize, borderRadius: pillSize / 2, backgroundColor: pillColor, shadowColor: pillColor },
                        ]}
                      >
                        <View style={[styles.pillScoreLine, { width: pillSize * 0.6 }]} />
                        <View
                          style={[
                            styles.pillShine,
                            {
                              width: pillSize * 0.28,
                              height: pillSize * 0.16,
                              borderRadius: pillSize * 0.14,
                              top: pillSize * 0.12,
                              left: pillSize * 0.2,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))}

        <Text style={styles.remainingText}>
          {remaining} of {total} left
        </Text>
        <Text style={styles.todayText}>
          {amountToday} of {habit.targetAmount ?? "?"} doses today
        </Text>
      </ScrollView>

      <Modal visible={showColorPicker} transparent animationType="fade" onRequestClose={() => setShowColorPicker(false)}>
        <Pressable style={styles.colorOverlay} onPress={() => setShowColorPicker(false)}>
          <Pressable style={styles.colorCard} onPress={(e) => e.stopPropagation()}>
            {showWheel ? (
              <>
                <Pressable onPress={() => setShowWheel(false)} hitSlop={8} style={styles.wheelBackLink}>
                  <Text style={styles.colorLinkText}>{"‹"} Back to colors</Text>
                </Pressable>
                <ColorWheelPicker onPick={applyColor} />
              </>
            ) : (
              <>
                <Text style={styles.medicineName}>Pill color</Text>
                <View style={styles.colorGrid}>
                  {PILL_COLORS.map((c) => (
                    <Pressable key={c.name} style={styles.colorOption} onPress={() => applyColor(c.value)}>
                      <View
                        style={[
                          styles.colorSwatch,
                          { backgroundColor: c.value },
                          pillColor === c.value && styles.colorSwatchSelected,
                        ]}
                      />
                      <Text style={styles.colorOptionText}>{c.name}</Text>
                    </Pressable>
                  ))}

                  <Pressable style={styles.colorOption} onPress={() => setShowWheel(true)}>
                    <View style={styles.colorSwatch}>
                      <RainbowSwatch size={40} />
                    </View>
                    <Text style={styles.colorOptionText} numberOfLines={1}>
                      Custom
                    </Text>
                  </Pressable>
                </View>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, alignItems: "center" },
  colorLink: { flexDirection: "row", alignItems: "center", alignSelf: "flex-end", marginBottom: spacing.sm, gap: spacing.xs },
  colorLinkSwatch: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  colorLinkText: { ...typography.body, color: colors.accentPink, fontWeight: "700" },
  colorOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  colorCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
  },
  colorGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: spacing.md, gap: spacing.md },
  colorOption: { alignItems: "center", width: 70 },
  colorSwatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: "transparent", overflow: "hidden" },
  wheelBackLink: { alignSelf: "flex-start", marginBottom: spacing.sm },
  colorSwatchSelected: { borderColor: colors.textPrimary },
  colorOptionText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
  packet: {
    width: "100%",
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  medicineName: { ...typography.title, textAlign: "center" },
  doseLine: { ...typography.caption, color: colors.textSecondary, marginTop: 2, marginBottom: spacing.lg },
  // Left-aligned (not centered) - a partial strip's one remaining tablet
  // sits at the very first slot, matching where it'd physically be on a
  // real card, instead of floating centered in the row.
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "flex-start", width: "100%" },
  // The clear plastic blister bubble the tablet sits under - a slightly
  // larger, lighter, translucent dome behind the pill itself so the pink
  // tablet reads as sealed under plastic, not just a flat coloured disc.
  bubble: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  pillFull: {
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 3,
  },
  pillScoreLine: { height: 2, borderRadius: 1, backgroundColor: "rgba(11,10,15,0.35)" },
  // A small light glare near the top-left, like light catching the plastic
  // bubble over the tablet.
  pillShine: {
    position: "absolute",
    backgroundColor: "rgba(255,255,255,0.35)",
    transform: [{ rotate: "-20deg" }],
  },
  // A used slot on a real blister card is punched-through foil, not a pill
  // - a flat metallic hollow with a dark puncture hole in the middle.
  pillPopped: { backgroundColor: "#3A3A40", alignItems: "center", justifyContent: "center" },
  pillPoppedHole: { backgroundColor: colors.background },
  remainingText: { ...typography.body, fontWeight: "700", marginTop: spacing.sm },
  todayText: { ...typography.caption, color: colors.textSecondary, marginTop: spacing.xs },
});
