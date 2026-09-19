// Colours shared by the Today's Summary card and the detailed Summary screen
// (the artwork behind them lives in components/summaryBackgrounds).

export const summaryColors = {
  saved: "#53E38C",
  spent: "#C9283E",
  text: "#FFF3E8",
  textDim: "rgba(255,243,232,0.72)",
  divider: "rgba(255,243,232,0.14)",
  // A soft dark halo so text stays crisp over whatever detail the picture has.
  textShadow: { textShadowColor: "rgba(0,0,0,0.55)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  track: "rgba(255,243,232,0.16)",
};

// Corner radius of the Today's Summary card and of everything drawn inside it
// (the background layer clips itself to this too).
export const SUMMARY_CARD_RADIUS = 24;

// The dark layer between a background and the text on it. It is what guarantees
// the text stays readable, so bright scenes need a heavy one; a picture that is
// already dark can use a light one and stay visible. Each background may set its
// own alpha in the registry.
export const DEFAULT_OVERLAY_ALPHA = 0.5;

export function overlayColor(alpha: number): string {
  const safe = Number.isFinite(alpha) ? Math.min(Math.max(alpha, 0), 1) : DEFAULT_OVERLAY_ALPHA;
  return `rgba(10,8,14,${safe})`;
}
