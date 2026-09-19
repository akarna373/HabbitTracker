// Where the bubbles go on a tile (see components/BubbleBackground). Pure and
// deterministic: the same size and seed always give the same arrangement.
//
// Every bubble stands alone - each is placed only where it keeps a clear gap from
// every bubble already placed, so none ever overlaps, sits inside, or clusters with
// another. There are only a few (the count follows the tile's area, capped), and
// they lean towards the right-hand side so text on the left stays on clean grey.

export type BubbleTint = "pink" | "violet" | "aqua";

export interface Bubble {
  x: number;
  y: number;
  r: number;
  tint: BubbleTint;
  medium: boolean;
}

// Clear space kept between any two bubbles, in dp, on top of their radii.
export const MIN_GAP = 10;
export const EDGE_MARGIN = 6;

// A rectangle (in dp, tile coordinates) no bubble may touch - e.g. where the floating
// + button sits on top of the tile.
export interface KeepOut {
  x: number;
  y: number;
  w: number;
  h: number;
}

function touchesRect(cx: number, cy: number, r: number, rect: KeepOut): boolean {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  return Math.hypot(cx - nearestX, cy - nearestY) < r + MIN_GAP / 2;
}

const TINT_ORDER: readonly BubbleTint[] = ["pink", "aqua", "violet", "pink", "aqua"];

// mulberry32 - a tiny deterministic random source (never Math.random).
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// A few medium bubbles, then a few small ones. A spot that can't be found after many
// tries is skipped, so the result may hold fewer bubbles than planned - never
// touching ones.
// `zoneLeft` keeps every bubble to the right of that x (in dp): the tile's text
// lives on the left, so the bubbles get their own clean area.
export function generateBubbles(
  width: number,
  height: number,
  seed: number,
  zoneLeft = 0,
  keepOut: readonly KeepOut[] = []
): Bubble[] {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [];
  const rand = seeded(seed);
  const area = width * height;
  const plan = [
    { medium: true, count: clamp(Math.round(area / 20000), 1, 3), minR: 15, maxR: 26 },
    { medium: false, count: clamp(Math.round(area / 12000), 2, 5), minR: 6, maxR: 10 },
  ];

  const placed: Bubble[] = [];
  for (const group of plan) {
    for (let n = 0; n < group.count; n++) {
      for (let attempt = 0; attempt < 250; attempt++) {
        const r = group.minR + rand() * (group.maxR - group.minR);
        const minX = Math.max(zoneLeft, 0) + r + EDGE_MARGIN;
        const maxX = width - r - EDGE_MARGIN;
        const xSpan = maxX - minX;
        const ySpan = height - 2 * (r + EDGE_MARGIN);
        if (xSpan < 0 || ySpan < 0) continue;
        // Raising to a power above 1 pulls x towards the right-hand side.
        const x = maxX - Math.pow(rand(), 1.8) * xSpan;
        const y = r + EDGE_MARGIN + rand() * ySpan;
        const clear = placed.every((other) => Math.hypot(other.x - x, other.y - y) >= other.r + r + MIN_GAP);
        if (!clear || keepOut.some((rect) => touchesRect(x, y, r, rect))) continue;
        placed.push({ x, y, r, tint: TINT_ORDER[Math.floor(rand() * TINT_ORDER.length)], medium: group.medium });
        break;
      }
    }
  }
  return placed;
}
