import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text } from "react-native";
import { fireTestNotification, isNotificationTestEnabled } from "../lib/notifications";
import { colors, radii, spacing } from "../lib/theme";
import type { Habit } from "../lib/types";
import { confirmDialog } from "./ConfirmDialog";

const DELAY_SECONDS = 5;

// Developer-only: fires this habit's real notification(s) a few seconds from
// now so the behavior can be checked on a device. Renders nothing unless
// isNotificationTestEnabled() (dev builds, or EXPO_PUBLIC_ENABLE_NOTIFICATION_TEST=1).
export function TestNotificationButton({ habit, todayAmount }: { habit: Habit; todayAmount: number }) {
  if (!isNotificationTestEnabled()) return null;

  const onPress = async () => {
    const result = await fireTestNotification(habit, todayAmount, DELAY_SECONDS);
    if (result.status === "scheduled") {
      confirmDialog(
        "Test scheduled",
        `Fires in ${result.delaySeconds} s: ${result.labels.join(", ")}. Background or swipe away the app now.`
      );
    } else if (result.status === "denied") {
      confirmDialog("Notifications are off", "Allow notifications for Habbit in system settings, then try again.");
    } else if (result.status === "unavailable") {
      confirmDialog("Not available here", "Notifications need a dev or release build - they do not run in Expo Go.");
    } else {
      confirmDialog("Nothing to test", "This habit has no notifications set up.");
    }
  };

  return (
    <Pressable onPress={onPress} hitSlop={12} collapsable={false} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <Ionicons name="notifications-outline" size={16} color={colors.accentPink} />
      <Text style={styles.text}>Test</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.accentPink,
    backgroundColor: "rgba(11,10,15,0.01)",
  },
  pressed: { opacity: 0.85 },
  text: { color: colors.accentPink, fontSize: 13, fontWeight: "700" },
});
