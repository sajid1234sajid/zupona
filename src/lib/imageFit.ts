/** Server half of fitting product pictures to the shop's frame.
 *
 * The fitting itself happens in the admin's browser (see
 * `apps/image-fit/shared/fit.ts`); what lives here is the setting that says
 * how, and the door to the AI painter. The painter is its own Worker --
 * Zupona Image Fit, at fit.zupona.com -- reached over a service binding, so
 * the shop and the standalone app share one piece of AI code and the shop
 * needs no key of its own. */

import { getSetting } from "@/lib/admin";
import type { AutoFitMode } from "@/components/admin/ImageUploader";

/** How the product form fits pictures, from Settings. AI by default: that is
 * what the owner asked for, and when the AI cannot answer the uploader falls
 * back to the blurred fill on its own. */
export async function getAutoFitMode(): Promise<AutoFitMode> {
  const value = await getSetting("image_autofit", "ai").catch(() => "ai");
  return value === "off" || value === "blur" ? value : "ai";
}

export interface ImageFitService {
  expand(input: { image: ArrayBuffer; width: number; height: number }): Promise<Uint8Array>;
}

/** The Image Fit Worker's RPC entrypoint, or null where the binding does not
 * exist (a local dev run without that Worker beside it). */
export async function getImageFit(): Promise<ImageFitService | null> {
  try {
    const { env } = await import("cloudflare:workers");
    return ((env as unknown as { IMAGE_FIT?: ImageFitService }).IMAGE_FIT ?? null);
  } catch {
    return null;
  }
}
