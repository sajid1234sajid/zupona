/** How a shopper reaches the shop, from one place.
 *
 * Every help link on the storefront used to be `mailto:support@zupona.shop`,
 * a domain that does not exist -- the address could never receive a message.
 * The pages, the footer and the menus now read the channels from here, and
 * here reads them from Settings, so an address changed in the admin panel
 * changes everywhere at once.
 *
 * WhatsApp is the one channel with a standing fallback: it is the support line
 * the account page has always sent shoppers to. Email and phone have none; an
 * unset one is simply not shown, because a contact detail nobody answers is
 * worse than no detail at all. */

import { getShopSettings, DEFAULT_SETTINGS } from "@/lib/shopSettings";

/** The support WhatsApp the account page's "Need Help?" card has used since
 * launch, in the `+8801…` form Settings stores. */
export const DEFAULT_SUPPORT_WHATSAPP = "+8801627498933";

export interface SupportContact {
  /** `+8801…`, for display. */
  whatsapp: string;
  /** A wa.me link, optionally carrying a pre-filled message. */
  whatsappHref: (text?: string) => string;
  phone: string | null;
  email: string | null;
  facebook: string | null;
}

export function waLink(number: string, text?: string): string {
  const base = `https://wa.me/${number.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export async function getSupportContact(): Promise<SupportContact> {
  const settings = await getShopSettings().catch(() => DEFAULT_SETTINGS);
  // A settings object cached before `social` existed has no such key.
  const social = settings.social ?? DEFAULT_SETTINGS.social;
  const whatsapp = social.whatsapp || DEFAULT_SUPPORT_WHATSAPP;
  return {
    whatsapp,
    whatsappHref: (text) => waLink(whatsapp, text),
    phone: settings.supportPhone,
    email: settings.supportEmail,
    facebook: social.facebook,
  };
}

/** `+8801627498933` -> `+880 1627-498933`, the way a Bangladeshi number is read. */
export function formatWhatsapp(number: string): string {
  const digits = number.replace(/\D/g, "");
  const m = digits.match(/^880(1\d{3})(\d{6})$/);
  return m ? `+880 ${m[1]}-${m[2]}` : number;
}
