import { resolveIcon } from "@/components/product/featureIcons";

/** The mint strip of product claims under the buy buttons.
 *
 * Every item comes from `product_features`, so a serum says "Dermatologically
 * Tested" where a shoe says "Anti-slip Sole". Nothing here is hardcoded: a
 * product with no features renders no strip rather than three generic
 * promises that may not be true of it. */
export default function FeatureBar({
  features,
}: {
  features: { icon: string; label: string }[];
}) {
  if (features.length === 0) return null;

  return (
    <ul className="mt-4 grid grid-cols-3 overflow-hidden rounded-2xl border border-[#d8ebe4] bg-mint">
      {features.slice(0, 3).map((feature, index) => {
        const Icon = resolveIcon(feature.icon);
        return (
          <li
            key={`${feature.label}-${index}`}
            className={`flex min-h-[42px] items-center justify-center gap-1.5 px-2 py-1.5 text-center ${
              index < 2 ? "border-r border-[#cfe4dc]" : ""
            }`}
          >
            <Icon className="h-[18px] w-[18px] shrink-0 text-brand" aria-hidden />
            <span className="text-[11px] font-bold leading-tight text-brand-dark">
              {feature.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
