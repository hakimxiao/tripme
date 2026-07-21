import { Ionicons } from "@expo/vector-icons";
import { SFSymbol, SymbolView, SymbolViewProps } from "expo-symbols";
import { Platform } from "react-native";

// Map SFSymbol names to Ionicons names for Android fallback
const IONICONS_MAP: Partial<Record<SFSymbol, keyof typeof Ionicons.glyphMap>> = {
  "sparkles": "sparkles",
  "arrow.right": "arrow-forward",
  "chevron.right": "chevron-forward",
  "calendar": "calendar",
  "mappin": "location",
  "wallet.bifold": "wallet",
  "star.fill": "star",
  "chevron.left": "chevron-back",
  "person.2": "people",
  "minus": "remove",
  "plus": "add",
  "magnifyingglass": "search",
  "map": "map",
  "exclamationmark.triangle.fill": "warning",
  "arrow.clockwise": "refresh",
  "camera.fill": "camera",
  "trash": "trash",
  "location.fill": "location",
  "chevron.up": "chevron-up",
  "chevron.down": "chevron-down",
  "camera": "camera-outline",
  "fork.knife": "restaurant",
  "figure.walk": "walk",
};

export type AppIconProps = Omit<SymbolViewProps, "type">;

export function AppIcon({
  name,
  size = 24,
  tintColor,
  weight,
  style,
  ...rest
}: AppIconProps) {
  if (Platform.OS === "ios") {
    return (
      <SymbolView
        name={name}
        size={size}
        tintColor={tintColor}
        weight={weight}
        style={style}
        {...rest}
      />
    );
  }

  const iconName = typeof name === "string" ? name : name.ios;
  const ioniconName = (iconName ? IONICONS_MAP[iconName as SFSymbol] : "ellipse") ?? "ellipse";

  return (
    <Ionicons
      name={ioniconName}
      size={size}
      color={tintColor}
      style={style as any}
    />
  );
}
