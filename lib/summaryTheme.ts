// Colours shared by the Today's Summary card and the detailed Summary screen.
// The gradient is TEMPORARY - a plain vector stand-in for the background system
// that will replace it; the rest is meant to stay.
export const SUMMARY_GRADIENT = ["#5A1E44", "#2B1636", "#141026"] as const;

export const summaryColors = {
  saved: "#53E38C",
  spent: "#C9283E",
  text: "#FFF3E8",
  textDim: "rgba(255,243,232,0.72)",
  overlay: "rgba(10,8,14,0.58)",
  divider: "rgba(255,243,232,0.14)",
  track: "rgba(255,243,232,0.16)",
};
