import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../lib/theme";

interface SheetState {
  title: string;
  presets: string[];
  // User-typed "Custom" values saved from a previous pick - these carry a
  // "x" to remove them from the list; presets don't (they're fixed).
  customOptions: string[];
  onPick: (value: string) => void;
  onDeleteCustom?: (value: string) => void;
}

// A real bottom-sheet drawer (vertical list, one option per row) for "tap to
// select" fields with several options - ConfirmDialog's row of buttons wraps
// and crowds once there are more than 2-3 choices, this scrolls cleanly
// instead. Same module-level-listener pattern as ConfirmDialog, so callers
// can trigger it like a plain function from anywhere.
let listener: ((state: SheetState | null) => void) | null = null;

export function openOptionSheet(
  title: string,
  presets: string[],
  customOptions: string[],
  onPick: (value: string) => void,
  onDeleteCustom?: (value: string) => void
) {
  listener?.({ title, presets, customOptions, onPick, onDeleteCustom });
}

export function OptionSheetHost() {
  const [state, setState] = useState<SheetState | null>(null);

  useEffect(() => {
    listener = setState;
    return () => {
      listener = null;
    };
  }, []);

  const close = () => setState(null);

  const pick = (value: string) => {
    const onPick = state?.onPick;
    close();
    onPick?.(value);
  };

  // Removes a custom entry from the open sheet's own list immediately,
  // instead of closing and reopening it, while still persisting the delete.
  const deleteCustom = (value: string) => {
    state?.onDeleteCustom?.(value);
    setState((s) => (s ? { ...s, customOptions: s.customOptions.filter((v) => v !== value) } : s));
  };

  return (
    <Modal transparent visible={!!state} animationType="slide" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>{state?.title}</Text>
          <View style={styles.list}>
            {state?.presets.map((opt) => (
              <Pressable
                key={opt}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => pick(opt)}
              >
                <Text style={styles.rowText}>{opt}</Text>
              </Pressable>
            ))}
            {state?.customOptions.map((opt) => (
              <View key={opt} style={[styles.row, styles.customRow]}>
                <Pressable style={styles.customRowText} onPress={() => pick(opt)}>
                  <Text style={styles.rowText}>{opt}</Text>
                </Pressable>
                <Pressable onPress={() => deleteCustom(opt)} hitSlop={10} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>{"×"}</Text>
                </Pressable>
              </View>
            ))}
            <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={() => pick("")}>
              <Text style={[styles.rowText, styles.customText]}>Custom</Text>
            </Pressable>
          </View>
          <Pressable style={styles.cancelRow} onPress={close}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: spacing.sm,
  },
  title: { ...typography.body, fontWeight: "700", marginBottom: spacing.xs },
  list: { borderTopWidth: 1, borderTopColor: colors.border },
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.surface },
  rowText: { ...typography.body, color: colors.textPrimary },
  customRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 0 },
  customRowText: { flex: 1, paddingVertical: spacing.md },
  clearButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  clearButtonText: { fontSize: 20, lineHeight: 20, color: colors.textMuted, fontWeight: "700" },
  customText: { color: colors.accentPink, fontWeight: "700" },
  cancelRow: { paddingVertical: spacing.md, alignItems: "center", marginTop: spacing.xs },
  cancelText: { ...typography.body, color: colors.textSecondary, fontWeight: "700" },
});
