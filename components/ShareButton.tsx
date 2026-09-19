import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, StyleSheet } from "react-native";
import { colors } from "../lib/theme";
import { ShareSheet } from "./ShareSheet";

// The share icon in Today's header, next to the menu. One tap opens a preview of the progress card with
// "Share" and "Save to photos". The sheet is only built while it is open, so the header costs nothing
// when it is closed.
export function ShareButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Pressable
        style={styles.trigger}
        onPress={() => setOpen(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Share your progress"
      >
        <Ionicons name="share-social-outline" size={21} color={colors.textPrimary} />
      </Pressable>
      {open ? <ShareSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
});
