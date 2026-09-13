export const colors = {
  background: "#0B0A0F",
  surface: "#17141C",
  surfaceRaised: "#1F1B26",
  border: "#2A2530",
  accentPink: "#FF4F8B",
  accentRed: "#FF5A62",
  softAccent: "#FFB5CC",
  goalYellow: "#FF8F00",
  goalGreen: "#33B679",
  textPrimary: "#FFF7FA",
  textSecondary: "#A8A2B0",
  textMuted: "#6E6878",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radii = {
  card: 16,
  button: 28,
  chip: 20,
};

// The app's signature wordmark font (the "Habbit" logotype) - white on the
// current dark theme; reserved for pink once a light theme exists (see
// project_theme_deferred memory - theming waits until the app is finished).
export const brandFont = {
  fontFamily: "Baloo2_800ExtraBold",
  color: colors.textPrimary,
};

export const typography = {
  title: { fontSize: 28, fontWeight: "700" as const, color: colors.textPrimary },
  screenTitle: { fontSize: 22, fontWeight: "700" as const, color: colors.textPrimary },
  label: { fontSize: 12, fontWeight: "600" as const, color: colors.textSecondary, letterSpacing: 0.5 },
  body: { fontSize: 15, color: colors.textPrimary },
  caption: { fontSize: 13, color: colors.textSecondary },
};
