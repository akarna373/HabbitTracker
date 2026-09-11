// One-off: recolor the Noto Emoji "grinning face" Lottie JSON to the app's
// pink theme, preserving its original outline/shading structure as a
// duotone (dark outline -> mid accentRed -> accentPink -> light softAccent),
// white highlights untouched. Run once; the recolored file is committed.
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "..", "assets", "lottie", "happy-face.json");
let json = fs.readFileSync(file, "utf8");

const replacements = [
  // dark outline / mouth-interior tones -> dark maroon (#5C0F1E)
  { from: "[0.211764720842,0.16862745098,0.109803929048,1]", to: "[0.360784313725,0.058823529412,0.117647058824,1]" },
  { from: "[0.258999992819,0.169000004787,0.051000000449,1]", to: "[0.360784313725,0.058823529412,0.117647058824,1]" },
  // medium shading -> accentRed (#FF5A62)
  { from: "[0.536999990426,0.375999989229,0.141000007181,1]", to: "[1,0.352941176471,0.384313725490,1]" },
  // face base (two near-duplicate yellows) -> accentPink (#FF4F8B)
  { from: "[0.921568627451,0.560784313725,0,1]", to: "[1,0.309803921568,0.545098039216,1]" },
  { from: "[0.922000002394,0.560999971278,0,1]", to: "[1,0.309803921568,0.545098039216,1]" },
  // cheek blush -> softAccent (#FFB5CC)
  { from: "[0.929000016755,0.46699999641,0.438999998803,1]", to: "[1,0.709803921569,0.8,1]" },
  // white teeth/highlight left untouched
];

// The glossy face "sheen" (a separate gradient fill, "ty":"gf") is left
// yellow on purpose - a pink-recolored attempt didn't look good, reverted.
for (const { from, to } of replacements) {
  const needle = `"c":{"a":0,"k":${from}`;
  const replacement = `"c":{"a":0,"k":${to}`;
  const count = json.split(needle).length - 1;
  if (count === 0) {
    console.warn(`No match for ${from}`);
    continue;
  }
  json = json.split(needle).join(replacement);
  console.log(`Replaced ${count} occurrence(s) of ${from}`);
}

fs.writeFileSync(file, json);
console.log("Done.");
