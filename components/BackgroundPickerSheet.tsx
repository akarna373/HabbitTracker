import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { ROTATION_DAYS } from "../lib/backgroundRotation";
import { useStore } from "../lib/store";
import { summaryColors } from "../lib/summaryTheme";
import { colors, radii, spacing, typography } from "../lib/theme";
import { PrimaryButton } from "./PrimaryButton";
import { SUMMARY_BACKGROUNDS } from "./summaryBackgrounds/registry";

interface BackgroundPickerSheetProps {
  visible: boolean;
  onClose: () => void;
}

// The easter-egg background chooser (see EasterEggTick). Picking one applies it
// straight away; it then holds for the usual rotation period before the automatic
// rotation carries on.
export function BackgroundPickerSheet({ visible, onClose }: BackgroundPickerSheetProps) {
  const current = useStore((s) => s.summaryBackground.index);
  const choose = useStore((s) => s.chooseSummaryBackground);

  // Square thumbnails sized from the screen width (a percentage width isn't known
  // yet when a grid cell first lays out, which stretched them into tall strips).
  const { width: screenWidth } = useWindowDimensions();
  const cellWidth = Math.floor((screenWidth - spacing.md * 2) / COLUMNS);
  const thumbSize = cellWidth - CELL_PADDING * 2 - 4; // minus the selection border

  const pick = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    choose(index);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close background chooser">
        {/* Swallows taps so touching the sheet itself doesn't close it. */}
        <Pressable style={styles.sheet} onPress={() => {}} accessible={false}>
          <Text style={styles.title}>You found the secret!</Text>
          <Text style={styles.subtitle}>
            Choose any background. It stays for {ROTATION_DAYS} days, then they rotate on their own again.
          </Text>
          <FlatList
            data={SUMMARY_BACKGROUNDS}
            keyExtractor={(entry) => entry.id}
            numColumns={COLUMNS}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            initialNumToRender={12}
            renderItem={({ item, index }) => {
              const selected = index === current;
              return (
                <Pressable
                  onPress={() => pick(index)}
                  style={[styles.cell, { width: cellWidth }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item.name}
                >
                  <View style={[styles.thumbFrame, selected && styles.thumbFrameSelected]}>
                    <Image
                      source={item.source}
                      style={{ width: thumbSize, height: thumbSize }}
                      resizeMode="cover"
                      resizeMethod="resize"
                      fadeDuration={0}
                    />
                    {selected ? (
                      <View style={styles.tickBadge}>
                        <Ionicons name="checkmark" size={14} color="#0B0A0F" />
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.name, selected && styles.nameSelected]} numberOfLines={1}>
                    {item.name}
                  </Text>
                </Pressable>
              );
            }}
          />
          <PrimaryButton title="Close" variant="outline" size="small" onPress={onClose} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const COLUMNS = 3;
const CELL_PADDING = 5;

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  sheet: {
    maxHeight: "82%",
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: radii.card + 8,
    borderTopRightRadius: radii.card + 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  title: { ...typography.screenTitle, marginBottom: 4 },
  subtitle: { ...typography.caption, marginBottom: spacing.md },
  list: { flexGrow: 0 },
  listContent: { paddingBottom: spacing.sm },
  cell: { padding: CELL_PADDING },
  thumbFrame: { borderRadius: 14, overflow: "hidden", borderWidth: 2, borderColor: "transparent", backgroundColor: colors.surface },
  thumbFrameSelected: { borderColor: colors.accentPink },
  tickBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: summaryColors.saved,
  },
  name: { ...typography.caption, marginTop: 4, textAlign: "center", fontSize: 11 },
  nameSelected: { color: colors.textPrimary, fontWeight: "700" },
});
