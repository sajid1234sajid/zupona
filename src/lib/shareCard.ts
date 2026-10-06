import type { Metadata } from "next";
import { resizedSrc } from "@/lib/image";

/** What a link to the shop looks like when it is pasted into Facebook,
 * Messenger or WhatsApp.
 *
 * Nothing used to say. With no `og:image` on the page, Facebook's crawler
 * picked whatever large picture it found first -- the hero banner of the day,
 * or an admin-panel icon -- so the same zupona.com link turned up with a
 * different, unrelated picture every time it was shared, and never the logo.
 * Every page now names its picture: the brand card by default, the product's
 * own photo on a product page.
 *
 * The URLs are made absolute against `metadataBase` in the root layout, which
 * is what the crawlers require; a relative `/api/media/...` was being ignored. */
export const SITE_URL = "https://zupona.com";

export const SITE_NAME = "Zupona";

/** 1200x630, the size Facebook and WhatsApp draw a large preview at.
 * Rendered from the real logo; regenerate it rather than editing by hand. */
export const BRAND_SHARE_IMAGE = {
  url: "/og-image.jpg",
  width: 1200,
  height: 630,
  alt: "Zupona — Trusted Online Shop",
};

/** Open Graph and Twitter tags for one page.
 *
 * A page that sets `openGraph` replaces the root layout's whole object rather
 * than merging into it, so the site name and the fallback picture are filled
 * in here every time instead of being lost. `image` is an uploaded or remote
 * picture; it is asked for at a width a preview can use, never full size. */
export function shareMetadata({
  title,
  description,
  path,
  image,
  imageAlt,
}: {
  title: string;
  description?: string;
  path?: string;
  image?: string | null;
  imageAlt?: string;
}): Pick<Metadata, "openGraph" | "twitter"> {
  const picture = image
    ? { url: resizedSrc(image, 1080), alt: imageAlt ?? title }
    : BRAND_SHARE_IMAGE;

  return {
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_BD",
      title,
      description,
      ...(path ? { url: path } : {}),
      images: [picture],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [picture.url],
    },
  };
}
