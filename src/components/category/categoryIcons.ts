import {
  Apple, Armchair, Baby, Bath, Bike, BookOpen, Boxes, Briefcase, Camera, Car, Cpu,
  Dog, Droplets, Dumbbell, Factory, Flame, Flower2, Footprints, Gamepad2, Gem, Gift,
  Glasses, Hammer, Headphones, Heart, House, Laptop, LayoutGrid, Leaf, Music, Package,
  Palette, PawPrint, Pill, Printer, Ruler, Scissors, Settings, Shapes, Shirt,
  ShoppingBag, ShoppingCart, ShowerHead, Smartphone, Sofa, Sparkles, Star, Sun, Tag,
  Truck, Tv, Utensils, Volleyball, Watch, Wheat, Wind, Wrench, Zap,
  type LucideIcon,
} from "lucide-react";

/** Category icons, resolved from the name stored in `categories.icon`.
 *
 * The database holds a string like `"Smartphone"` because a React component
 * cannot be serialized from a server component into a client one; this is the
 * other half of that, mapping the name back in the browser.
 *
 * A category with no icon set still needs *something* in the navigation rail --
 * a rail of identical grey boxes is harder to scan than a rail of wrong-but-
 * distinct pictures. So an unset icon falls back to a keyword match on the
 * category name, and only then to a neutral mark. Nothing here is a promise:
 * setting `icon` (or uploading an icon image) in the admin panel always wins. */
const ICONS: Record<string, LucideIcon> = {
  Apple, Armchair, Baby, Bath, Bike, BookOpen, Boxes, Briefcase, Camera, Car, Cpu,
  Dog, Droplets, Dumbbell, Factory, Flame, Flower2, Footprints, Gamepad2, Gem, Gift,
  Glasses, Hammer, Headphones, Heart, House, Laptop, LayoutGrid, Leaf, Music, Package,
  Palette, PawPrint, Pill, Printer, Ruler, Scissors, Settings, Shapes, Shirt,
  ShoppingBag, ShoppingCart, ShowerHead, Smartphone, Sofa, Sparkles, Star, Sun, Tag,
  Truck, Tv, Utensils, Volleyball, Watch, Wheat, Wind, Wrench, Zap,
};

/** Keyword -> icon, tried in order against a lowercased category name.
 *
 * Order is the whole design: the first match wins, so compound keys come before
 * the generic ones they contain. "women" has to be tested before "men" --
 * `"women's fashion".includes("men")` is true -- and "baby care" before "car".
 * Getting that wrong is invisible until every department wears the same icon. */
const KEYWORDS: [string, LucideIcon][] = [
  // Specific compounds first.
  ["women's accessor", Gem],
  ["men's accessor", Briefcase],
  ["baby", Baby],
  ["kids", Baby],
  ["women", Sparkles],
  ["men", Shirt],

  // Trades and industry.
  ["machinery", Factory],
  ["industrial", Factory],
  ["packaging", Boxes],
  ["printing", Printer],
  ["power tool", Zap],
  ["hand tool", Hammer],
  ["tool", Wrench],
  ["automotive", Car],
  ["vehicle", Car],

  // Everyday departments.
  ["grocery", ShoppingCart],
  ["toy", Gamepad2],
  ["game", Gamepad2],
  ["fashion", Shirt],
  ["shirt", Shirt],
  ["panjabi", Shirt],
  ["jacket", Shirt],
  ["saree", Sparkles],
  ["kurti", Sparkles],
  ["dress", Sparkles],
  ["footwear", Footprints],
  ["shoe", Footprints],
  ["sandal", Footprints],
  ["sneaker", Footprints],
  ["backpack", Briefcase],
  ["wallet", Briefcase],
  ["belt", Briefcase],
  ["bag", ShoppingBag],
  ["watch", Watch],
  ["jewel", Gem],
  ["bangle", Gem],
  ["accessor", Gem],

  ["home", House],
  ["living", Sofa],
  ["furniture", Armchair],
  ["appliance", Tv],
  ["kitchen", Utensils],

  ["beauty", Flower2],
  ["makeup", Palette],
  ["skin", Droplets],
  ["hair", Scissors],
  ["fragrance", Flower2],
  ["perfume", Flower2],
  ["bath", Bath],
  ["shower", ShowerHead],
  ["body", Droplets],
  ["health", Heart],
  ["wellness", Heart],
  ["medicine", Pill],
  ["vitamin", Pill],

  ["sport", Volleyball],
  ["fitness", Dumbbell],
  ["outdoor", Bike],
  ["book", BookOpen],
  ["stationery", Ruler],
  ["music", Music],
  ["camera", Camera],
  ["audio", Headphones],
  ["headphone", Headphones],
  ["speaker", Headphones],
  ["laptop", Laptop],
  ["computer", Cpu],
  ["mobile", Smartphone],
  ["phone", Smartphone],
  ["tablet", Smartphone],
  ["electronic", Smartphone],
  ["wearable", Watch],

  ["pet", PawPrint],
  ["food", Apple],
  ["snack", Wheat],
  ["gift", Gift],
  ["glass", Glasses],
  ["fan", Wind],
  ["light", Sun],
  ["deal", Tag],
  ["offer", Tag],
  ["featured", Star],
  ["organic", Leaf],
];

export function resolveCategoryIcon(icon: string | null, name = ""): LucideIcon {
  if (icon && ICONS[icon]) return ICONS[icon];

  const needle = name.toLowerCase();
  for (const [keyword, Icon] of KEYWORDS) {
    if (needle.includes(keyword)) return Icon;
  }
  return LayoutGrid;
}

/** Offered in the admin panel so an icon can be picked from a list rather than
 * typed from memory. */
export const CATEGORY_ICON_NAMES = Object.keys(ICONS).sort();
