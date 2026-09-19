import { Image, StyleSheet } from "react-native";

// A picture is ONLY ever a layer inside the card. The layer that holds it is
// absolutely positioned and clipped by the card (see SummaryBackground), so the
// card alone decides its width and height; the picture is 100% x 100% of that
// layer and resizeMode="cover" scales it to cover the box and crops the overflow
// from the centre - it never stretches, and its own pixel size has no say in how
// wide or tall the card is.
//
// The picture itself must NOT be given absoluteFill (position: absolute with all
// four edges at 0): on Android that made it render at its natural size instead of
// the box's, magnifying it several times so only a corner of it was visible -
// Pokhara showed as plain sky. Width and height of 100% fix that.
//
// resizeMethod="resize" makes Android decode the picture at the size it is shown
// (about the picture's own resolution here, so nothing is lost); fadeDuration={0}
// switches off Android's own 300 ms fade-in so it doesn't fight the crossfade
// between backgrounds.
const styles = StyleSheet.create({
  picture: { width: "100%", height: "100%" },
});

export function coverScene(source: number) {
  return function CoverImageScene() {
    return (
      <Image
        source={source}
        style={styles.picture}
        resizeMode="cover"
        resizeMethod="resize"
        fadeDuration={0}
        accessibilityIgnoresInvertColors
      />
    );
  };
}
