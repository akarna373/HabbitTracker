import { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../lib/theme";

export interface ConfirmButton {
  text: string;
  style?: "cancel" | "destructive" | "default";
  onPress?: () => void;
}

interface ConfirmState {
  title: string;
  message: string;
  buttons: ConfirmButton[];
}

// A drop-in, dark-themed replacement for Alert.alert (same title/message/
// buttons shape) - the OS's native alert is always a bright white/light
// system dialog on Android, which is jarring against this app's dark theme
// at night. Call sites don't hold any component state, so a module-level
// listener (set by the single <ConfirmDialogHost/> mounted at the root)
// lets confirmDialog() be called like a plain function, anywhere.
let listener: ((state: ConfirmState | null) => void) | null = null;

export function confirmDialog(title: string, message: string, buttons: ConfirmButton[] = [{ text: "OK" }]) {
  listener?.({ title, message, buttons });
}

export function ConfirmDialogHost() {
  const [state, setState] = useState<ConfirmState | null>(null);

  useEffect(() => {
    listener = setState;
    return () => {
      listener = null;
    };
  }, []);

  const close = () => setState(null);

  return (
    <Modal transparent visible={!!state} animationType="fade" onRequestClose={close}>
      <Pressable style={styles.overlay} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{state?.title}</Text>
          <Text style={styles.message}>{state?.message}</Text>
          <View style={styles.buttonRow}>
            {state?.buttons.map((b, i) => (
              <Pressable
                key={i}
                style={styles.button}
                onPress={() => {
                  close();
                  b.onPress?.();
                }}
              >
                <Text style={[styles.buttonText, b.style === "destructive" && styles.destructiveText]}>{b.text}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  title: { ...typography.body, fontWeight: "700", marginBottom: spacing.xs },
  message: { ...typography.caption, marginBottom: spacing.lg },
  buttonRow: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.lg },
  button: { paddingVertical: spacing.xs, paddingHorizontal: spacing.xs },
  buttonText: { ...typography.body, color: colors.accentPink, fontWeight: "700" },
  destructiveText: { color: colors.accentRed },
});
