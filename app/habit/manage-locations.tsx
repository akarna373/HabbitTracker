import * as Location from "expo-location";
import { useLocalSearchParams } from "expo-router";
import Storage from "expo-sqlite/kv-store";
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Card } from "../../components/Card";
import { confirmDialog } from "../../components/ConfirmDialog";
import { PrimaryButton } from "../../components/PrimaryButton";
import { ScreenHeader } from "../../components/ScreenHeader";
import { formatShortDateTime } from "../../lib/dates";
import { clusterSmokeLocations, type LocationCluster } from "../../lib/location";
import { useStore } from "../../lib/store";
import { colors, radii, spacing, typography } from "../../lib/theme";
import type { SmokeLocation } from "../../lib/types";

function formatAddress(address: Location.LocationGeocodedAddress | null): string | null {
  if (!address) return null;
  const line = [address.streetNumber, address.street].filter(Boolean).join(" ");
  const parts = [line, address.city, address.region].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

// The earliest-logged point in a cluster stays the same across re-clustering
// as more points come in, so it's a stable key to hang a nickname on - the
// cluster's centroid drifts every time a new point is averaged in.
function seedIdOf(cluster: LocationCluster<SmokeLocation>): string {
  return cluster.items.reduce((oldest, item) => (item.loggedAt < oldest.loggedAt ? item : oldest)).id;
}

function lastVisitedOf(cluster: LocationCluster<SmokeLocation>): string {
  return cluster.items.reduce((latest, item) => (item.loggedAt > latest ? item.loggedAt : latest), cluster.items[0].loggedAt);
}

export default function ManageLocationsScreen() {
  const { habitId } = useLocalSearchParams<{ habitId: string }>();
  const smokeLocations = useStore((s) => s.smokeLocationsByHabit[habitId ?? ""]);
  const deleteSmokeLocations = useStore((s) => s.deleteSmokeLocations);
  const [clusters, setClusters] = useState<LocationCluster<SmokeLocation>[]>([]);
  const [addresses, setAddresses] = useState<Record<number, string>>({});
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [renaming, setRenaming] = useState<LocationCluster<SmokeLocation> | null>(null);
  const [renameText, setRenameText] = useState("");

  useEffect(() => {
    setClusters(clusterSmokeLocations(smokeLocations ?? []));
  }, [smokeLocations]);

  useEffect(() => {
    let cancelled = false;
    clusters.forEach(async (cluster, index) => {
      try {
        const [address] = await Location.reverseGeocodeAsync(cluster.centroid);
        const label = formatAddress(address);
        if (!cancelled && label) {
          setAddresses((prev) => ({ ...prev, [index]: label }));
        }
      } catch {
        // offline or geocoding unavailable - falls back to coordinates below
      }
    });
    return () => {
      cancelled = true;
    };
  }, [clusters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        clusters.map(async (cluster) => {
          const seedId = seedIdOf(cluster);
          const label = await Storage.getItem(`location-label:${habitId}:${seedId}`);
          return [seedId, label] as const;
        })
      );
      if (cancelled) return;
      const next: Record<string, string> = {};
      for (const [seedId, label] of entries) {
        if (label) next[seedId] = label;
      }
      setLabels(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [clusters, habitId]);

  const openRename = (cluster: LocationCluster<SmokeLocation>) => {
    const seedId = seedIdOf(cluster);
    setRenameText(labels[seedId] ?? "");
    setRenaming(cluster);
  };

  const saveRename = async () => {
    if (!renaming) return;
    const seedId = seedIdOf(renaming);
    const trimmed = renameText.trim();
    if (trimmed) {
      await Storage.setItem(`location-label:${habitId}:${seedId}`, trimmed);
      setLabels((prev) => ({ ...prev, [seedId]: trimmed }));
    } else {
      await Storage.removeItem(`location-label:${habitId}:${seedId}`);
      setLabels((prev) => {
        const next = { ...prev };
        delete next[seedId];
        return next;
      });
    }
    setRenaming(null);
  };

  const removeCluster = (cluster: LocationCluster<SmokeLocation>) => {
    confirmDialog("Remove this location?", "You won't be warned here anymore.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => deleteSmokeLocations(habitId, cluster.items.map((i) => i.id)),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScreenHeader title="Manage locations" subtitle="See and remove recorded spots" />
      <ScrollView contentContainerStyle={styles.content}>
        {clusters.length === 0 ? (
          <Card>
            <Text style={styles.cardBody}>No locations recorded yet.</Text>
          </Card>
        ) : (
          clusters.map((cluster, index) => {
            const seedId = seedIdOf(cluster);
            return (
              <Pressable key={index} onPress={() => openRename(cluster)}>
                <Card>
                  <Text style={styles.cardTitle}>{labels[seedId] ?? addresses[index] ?? `${cluster.centroid.latitude.toFixed(5)}, ${cluster.centroid.longitude.toFixed(5)}`}</Text>
                  <Text style={styles.cardCaption}>
                    Visits: {cluster.items.length}    Last visited: {formatShortDateTime(lastVisitedOf(cluster))}
                  </Text>
                  <PrimaryButton title="Remove" variant="outline" size="small" onPress={() => removeCluster(cluster)} />
                </Card>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <Modal transparent visible={!!renaming} animationType="fade" onRequestClose={() => setRenaming(null)}>
        <Pressable style={styles.overlay} onPress={() => setRenaming(null)}>
          <Pressable style={styles.renameCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.cardTitle}>Name this spot</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Himalaya Cafe"
              placeholderTextColor={colors.textMuted}
              value={renameText}
              onChangeText={setRenameText}
              autoFocus
            />
            <View style={styles.renameButtons}>
              <PrimaryButton title="Cancel" variant="outline" size="small" onPress={() => setRenaming(null)} />
              <PrimaryButton title="Save" size="small" onPress={saveRename} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
  cardTitle: { ...typography.body, fontWeight: "700", marginBottom: 4 },
  cardBody: { ...typography.body },
  cardCaption: { ...typography.caption, marginBottom: spacing.sm },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  renameCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  input: {
    ...typography.body,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.chip,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    color: colors.textPrimary,
  },
  renameButtons: { flexDirection: "row", justifyContent: "flex-end", gap: spacing.sm },
});
