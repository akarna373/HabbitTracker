import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "../lib/theme";
import type { IconSet } from "../lib/templates";

interface TemplateIconProps {
  set: IconSet;
  name: string;
  size?: number;
}

export function TemplateIcon({ set, name, size = 18 }: TemplateIconProps) {
  if (set === "material") {
    return <MaterialCommunityIcons name={name as never} size={size} color={colors.accentPink} />;
  }
  return <Ionicons name={name as never} size={size} color={colors.accentPink} />;
}
