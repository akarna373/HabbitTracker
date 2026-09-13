import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../lib/theme";
import { confirmDialog } from "./ConfirmDialog";

const MENU_GAP = 6;

// WhatsApp-style overflow menu, opened from the 3-dot button in the Home
// header. Only the app's current prime features live here for now -
// Settings (already a real tab) and a Partner Sharing stub - more entries
// get added here as those features ship.
export function HeaderMenu() {
  const triggerRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ top: 0, right: 0 });

  const openMenu = () => {
    // Anchor to the button's own measured position instead of a guessed
    // offset, so the dropdown always sits flush below it regardless of
    // header layout - matching how WhatsApp's menu tucks right under its
    // own 3-dot button rather than floating over unrelated content.
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const screenWidth = Dimensions.get("window").width;
      setAnchor({ top: y + height + MENU_GAP, right: screenWidth - (x + width) });
      setOpen(true);
    });
  };

  const goSettings = () => {
    setOpen(false);
    router.push("/settings");
  };

  const partnerSharing = () => {
    setOpen(false);
    confirmDialog("Partner Sharing", "Coming in a later release.", [{ text: "OK" }]);
  };

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable style={styles.trigger} onPress={openMenu} hitSlop={8}>
          <Ionicons name="ellipsis-vertical" size={20} color={colors.textPrimary} />
        </Pressable>
      </View>
      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <View style={[styles.menu, { top: anchor.top, right: anchor.right }]}>
            <Pressable style={styles.item} onPress={goSettings}>
              <Text style={styles.itemText}>Settings</Text>
            </Pressable>
            <Pressable style={styles.item} onPress={partnerSharing}>
              <Text style={styles.itemText}>Partner Sharing</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { padding: spacing.xs },
  overlay: { flex: 1 },
  menu: {
    position: "absolute",
    backgroundColor: colors.surfaceRaised,
    borderRadius: 8,
    paddingVertical: spacing.xs,
    minWidth: 190,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
  },
  item: { paddingVertical: spacing.sm + 2, paddingHorizontal: spacing.md },
  itemText: { ...typography.body },
});
