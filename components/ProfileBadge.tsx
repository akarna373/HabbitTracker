import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { getProfile } from "../lib/profile";
import { colors } from "../lib/theme";

// Just the avatar circle, no "@username" text next to it - a long username
// used to crowd the header, and a plain profile picture reads more personal
// anyway (same idea as WhatsApp's header avatar).
export function ProfileBadge() {
  const [hasProfile, setHasProfile] = useState(false);

  useEffect(() => {
    getProfile().then((profile) => setHasProfile(!!profile));
  }, []);

  if (!hasProfile) return null;

  return (
    <View style={styles.avatar}>
      <Ionicons name="person" size={16} color={colors.textSecondary} />
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
});
