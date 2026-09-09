import {
  Baby,
  BatteryFull,
  Droplets,
  Gem,
  Leaf,
  Package,
  ShieldCheck,
  Shirt,
  Sparkles,
  Timer,
  Volume2,
  Watch,
  Wind,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Feature-badge icons, resolved from the name stored in the database.
 *
 * `product_features.icon` holds a string like `"Droplets"` because a React
 * component cannot be serialized from a server component into a client one.
 * This is the other half of that: the browser maps the name back.
 *
 * Anything unrecognised falls back to a neutral box rather than rendering
 * nothing, so a typo in the admin panel shows a badge with the wrong picture
 * instead of a silently missing row. */
const ICONS: Record<string, LucideIcon> = {
  Baby,
  BatteryFull,
  Droplets,
  Gem,
  Leaf,
  Package,
  ShieldCheck,
  Shirt,
  Sparkles,
  Timer,
  Volume2,
  Watch,
  Wind,
  Zap,
};

export function resolveIcon(name: string): LucideIcon {
  return ICONS[name] ?? Package;
}

/** Names offered in admin tooling, so a badge can be picked from a list
 * rather than typed from memory. */
export const FEATURE_ICON_NAMES = Object.keys(ICONS);
