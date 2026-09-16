import Svg, { Circle, Defs, LinearGradient, Stop } from "react-native-svg";

// A small rainbow-gradient circle - the "more colors" entry point in the
// swatch grid, standing out from the flat preset colors around it.
export function RainbowSwatch({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id="rainbow" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#FF4F4F" />
          <Stop offset="17%" stopColor="#FF9A4F" />
          <Stop offset="34%" stopColor="#FFE14F" />
          <Stop offset="50%" stopColor="#4FFF88" />
          <Stop offset="67%" stopColor="#4FCBFF" />
          <Stop offset="84%" stopColor="#8C4FFF" />
          <Stop offset="100%" stopColor="#FF4FD8" />
        </LinearGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#rainbow)" />
    </Svg>
  );
}
