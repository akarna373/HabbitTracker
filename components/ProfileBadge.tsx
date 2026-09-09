import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getProfile } from "../lib/profile";
import { colors, spacing, typography } from "../lib/theme";

export function ProfileBadge() {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    getProfile().then((profile) => setUsername(profile?.username ?? null));
  }, []);

  if (!username) return null;

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={16} color={colors.textSecondary} />
      </View>
      <Text style={styles.username}>@{username}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  username: { ...typography.caption, fontWeight: "600" },
});
