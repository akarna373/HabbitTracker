// One-off: generate app icon / adaptive-icon / favicon / splash assets from
// the user-provided Habbit-Logo-Pack (app/Habbit-Logo-Pack/). Run once; the
// generated files under assets/ are committed, this script and the pack are
// not part of the running app.
const path = require("path");
const sharp = require("sharp");

const PACK = path.join(__dirname, "..", "app", "Habbit-Logo-Pack");
const ASSETS = path.join(__dirname, "..", "assets");
// Icon-only background - a distinct blue-black, not the app's near-neutral
// dark theme colors.background (#0B0A0F), which read as plain black at icon size.
const BG = "#0A0E1C";

// Exact pixel bounding box of just the "h" mark inside habbit-logo-
// transparent.png (1254x1254), measured by scanning alpha rows/columns -
// excludes the "Habbit" wordmark band that starts further down.
const MARK_BBOX = { left: 377, top: 215, width: 549, height: 666 };
const CANVAS = 1024;
// Android only GUARANTEES the inner 72dp of a 108dp adaptive-icon canvas
// stays unclipped (66.7%) - anything past that can get cropped depending on
// the launcher's mask shape. 0.8 overshot that and got clipped asymmetrically
// (the checkmark swoop and left stem tips cut off); stay just inside it.
const SAFE_ZONE_HEIGHT = Math.round(CANVAS * 0.66);

async function markLayer() {
  const scale = SAFE_ZONE_HEIGHT / MARK_BBOX.height;
  const resizedWidth = Math.round(MARK_BBOX.width * scale);
  const resizedHeight = Math.round(MARK_BBOX.height * scale);

  const croppedMark = await sharp(path.join(PACK, "habbit-logo-transparent.png"))
    .extract(MARK_BBOX)
    .resize(resizedWidth, resizedHeight)
    .toBuffer();

  return { croppedMark, resizedWidth, resizedHeight };
}

async function main() {
  // Main app icon - habbit-app-icon.png is already a flattened square (dark
  // bg + pink mark), just resize to Expo's standard 1024x1024.
  await sharp(path.join(PACK, "habbit-app-icon.png"))
    .resize(CANVAS, CANVAS)
    .png()
    .toFile(path.join(ASSETS, "icon.png"));
  console.log("icon.png done");

  // Web favicon - smaller square, same source.
  await sharp(path.join(PACK, "habbit-app-icon.png"))
    .resize(512, 512)
    .png()
    .toFile(path.join(ASSETS, "favicon.png"));
  console.log("favicon.png done");

  // Android adaptive icon: flat background layer matching the app's theme.
  await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: BG } })
    .png()
    .toFile(path.join(ASSETS, "android-icon-background.png"));
  console.log("android-icon-background.png done");

  // Android adaptive icon: just the mark, transparent, centered, padded to
  // the safe zone.
  const { croppedMark, resizedWidth, resizedHeight } = await markLayer();
  await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: croppedMark, left: Math.round((CANVAS - resizedWidth) / 2), top: Math.round((CANVAS - resizedHeight) / 2) }])
    .png()
    .toFile(path.join(ASSETS, "android-icon-foreground.png"));
  console.log("android-icon-foreground.png done");

  // Android 13+ themed (monochrome) icon: same mark shape, recolored to
  // solid white using its own alpha as a mask - the OS applies its own tint.
  const markAlpha = await sharp(croppedMark).ensureAlpha().extractChannel(3).toBuffer();
  const whiteMark = await sharp({ create: { width: resizedWidth, height: resizedHeight, channels: 3, background: "#FFFFFF" } })
    .joinChannel(markAlpha)
    .png()
    .toBuffer();
  await sharp({ create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: whiteMark, left: Math.round((CANVAS - resizedWidth) / 2), top: Math.round((CANVAS - resizedHeight) / 2) }])
    .png()
    .toFile(path.join(ASSETS, "android-icon-monochrome.png"));
  console.log("android-icon-monochrome.png done");

  // Splash screen - full mark + wordmark, exactly as originally designed -
  // no outline/overlay on the "Habbit" text.
  await sharp(path.join(PACK, "habbit-original.png"))
    .png()
    .toFile(path.join(ASSETS, "splash-icon.png"));
  console.log("splash-icon.png done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
