import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "react-native";
import { colors } from "../lib/theme";
import type { IconSet } from "../lib/templates";

interface TemplateIconProps {
  set: IconSet;
  name: string;
  size?: number;
}

// Custom downloaded template icons live here instead of the vector-icon sets.
// This PNG was pre-recolored (see the session that produced it) so its own
// pixels already match the theme (accentPink throughout) - it renders as-is,
// no `tintColor`. It's a wide source image (~127x85, not square) - sizing it
// into a square box like the vector icons letterboxes it short, so size it
// by its own aspect ratio instead and let it run a bit larger than `size`.
const IMAGE_ICONS: Record<string, { source: ReturnType<typeof require>; aspect: number }> = {
  medication: { source: require("../assets/template-icons/medication.png"), aspect: 127 / 85 },
};

export function TemplateIcon({ set, name, size = 18 }: TemplateIconProps) {
  if (set === "image") {
    const icon = IMAGE_ICONS[name];
    if (!icon) return null;
    const width = size * 1.6;
    return <Image source={icon.source} style={{ width, height: width / icon.aspect }} resizeMode="contain" />;
  }
  if (set === "material") {
    return <MaterialCommunityIcons name={name as never} size={size} color={colors.accentPink} />;
  }
  return <Ionicons name={name as never} size={size} color={colors.accentPink} />;
}
