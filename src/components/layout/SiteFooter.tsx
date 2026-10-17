import Link from "next/link";
import {
  Banknote,
  CreditCard,
  Mail,
  Maximize,
  MessageCircle,
  Phone,
  ShoppingBag,
  Store,
  Zap,
} from "lucide-react";
import InstallAppButton from "./InstallAppButton";
import { getShopSettings, DEFAULT_SETTINGS, type SocialLinks } from "@/lib/shopSettings";
import { DEFAULT_SUPPORT_WHATSAPP, waLink } from "@/lib/contact";
import { acceptedPaymentProviders, type PaymentProvider } from "@/lib/payments";

/** Where every storefront page ends: the shop's directory, the way to reach
 * it, the app, its pages elsewhere and how a shopper can pay.
 *
 * Everything in it is either a page that exists or a value the admin set in
 * Settings -- the support line, the social links, the payment gateways with
 * credentials. Nothing is listed until it is real, so a shop with no
 * Instagram shows no Instagram icon and an unconfigured gateway is not
 * advertised as accepted.
 *
 * A dark band across the full width from the `tab` breakpoint up, in columns,
 * the way large marketplaces close a page on a laptop; on a phone the same
 * content stacks, and it sits above the fixed tab bar like the rest of a
 * page's content. */

const SHOP_LINKS = [
  { label: "All categories", href: "/categories" },
  { label: "New arrivals", href: "/new-arrivals" },
  { label: "Best sellers", href: "/best-sellers" },
  { label: "Offers", href: "/offers" },
  { label: "Wishlist", href: "/wishlist" },
  { label: "About Zupona", href: "/about" },
];

const SERVICE_LINKS = [
  { label: "Help center", href: "/support" },
  { label: "Track your order", href: "/account/orders" },
  { label: "Shipping & delivery", href: "/shipping" },
  { label: "Return & Refund Policy", href: "/returns-policy" },
  { label: "Our guarantees", href: "/guarantees" },
  { label: "Contact us", href: "/contact" },
];

/** The fine print along the bottom edge. */
const LEGAL_LINKS = [
  { label: "Terms of use", href: "/terms" },
  { label: "Privacy policy", href: "/privacy" },
  { label: "Safety & scam alerts", href: "/safety" },
];

const APP_PERKS = [
  { label: "Opens straight from your home screen", icon: Zap },
  { label: "Full screen, no browser bars", icon: Maximize },
  { label: "Your cart and orders a tap away", icon: ShoppingBag },
];

export default async function SiteFooter() {
  const [settings, providers] = await Promise.all([
    getShopSettings().catch(() => DEFAULT_SETTINGS),
    acceptedPaymentProviders().catch(() => [] as PaymentProvider[]),
  ]);
  // A settings object cached before `social` existed has no such key.
  const social: SocialLinks = settings.social ?? DEFAULT_SETTINGS.social;
  const storeName = settings.storeName;
  const year = new Date().getFullYear();

  return (
    <footer className="mt-8 bg-heading text-white/75">
      <div className="mx-auto w-full max-w-shell px-4 pb-6 pt-7 tab:px-6 tab:pb-8 tab:pt-10">
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 tab:grid-cols-[1fr_1fr_1fr_1.35fr] tab:gap-x-8">
          <LinkColumn title={`Shop ${settings.storeName}`} links={SHOP_LINKS} />
          <LinkColumn title="Customer service" links={SERVICE_LINKS} />

          <div className="col-span-2 tab:col-span-1">
            <h2 className="text-[14px] font-bold text-white">Help</h2>
            <ul className="mt-3 space-y-2.5 text-[13px]">
              {settings.supportPhone ? (
                <li>
                  <a
                    href={`tel:${settings.supportPhone.replace(/[^\d+]/g, "")}`}
                    className="inline-flex items-center gap-2 hover:text-white"
                  >
                    <Phone className="h-4 w-4 shrink-0" strokeWidth={2} />
                    {settings.supportPhone}
                  </a>
                </li>
              ) : null}
              {settings.supportEmail ? (
                <li>
                  <a
                    href={`mailto:${settings.supportEmail}`}
                    className="inline-flex items-center gap-2 break-all hover:text-white"
                  >
                    <Mail className="h-4 w-4 shrink-0" strokeWidth={2} />
                    {settings.supportEmail}
                  </a>
                </li>
              ) : null}
              {/* Always shown: the support line falls back to the one the
                  account page has always used. */}
              <li>
                <a
                  href={waLink(social.whatsapp || DEFAULT_SUPPORT_WHATSAPP)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 hover:text-white"
                >
                  <MessageCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
                  Chat on WhatsApp
                </a>
              </li>
              {/* The Seller Center's one public door: nobody finds it by typing
                  its address. */}
              <li>
                <Link
                  href="/sell"
                  prefetch={false}
                  className="inline-flex items-center gap-2 hover:text-white"
                >
                  <Store className="h-4 w-4 shrink-0" strokeWidth={2} />
                  Sell on {storeName}
                </Link>
              </li>
            </ul>
          </div>

          <div className="col-span-2 tab:col-span-1">
            <h2 className="text-[14px] font-bold text-white">Get the {settings.storeName} app</h2>
            <ul className="mt-3 space-y-2 text-[13px]">
              {APP_PERKS.map(({ label, icon: Icon }) => (
                <li key={label} className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-white" strokeWidth={2} />
                  {label}
                </li>
              ))}
            </ul>
            {/* Inside the installed app there is nothing left to install. */}
            <div className="mt-4 [@media(display-mode:standalone)]:hidden">
              <InstallAppButton />
            </div>

            <SocialRow social={social} storeName={settings.storeName} />
          </div>
        </div>

        <div className="mt-8 border-t border-white/10 pt-6">
          <h2 className="text-[14px] font-bold text-white">We accept</h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {providers.map((provider) => (
              <li key={provider.id}>
                <PaymentBadge provider={provider} />
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex flex-col items-center gap-2 border-t border-white/10 pt-5 text-[12px] text-white/55 tab:flex-row tab:justify-center tab:gap-6">
          <p>
            &copy; {year} {settings.storeName}. All rights reserved.
          </p>
          {LEGAL_LINKS.map((link) => (
            <Link key={link.href} href={link.href} prefetch={false} className="underline hover:text-white">
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </footer>
  );
}

function LinkColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <h2 className="text-[14px] font-bold text-white">{title}</h2>
      <ul className="mt-3 space-y-2.5 text-[13px]">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} prefetch={false} className="hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Cash on delivery is a plain badge; the wallets wear their own colours so a
 * shopper recognises them at a glance, as on any Bangladeshi checkout. */
function PaymentBadge({ provider }: { provider: PaymentProvider }) {
  const base =
    "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-bold shadow-sm";
  switch (provider.id) {
    case "bkash":
      return <span className={`${base} bg-[#e2136e] text-white`}>bKash</span>;
    case "nagad":
      return <span className={`${base} bg-[#f6921e] text-white`}>Nagad</span>;
    case "card":
      return (
        <span className={`${base} bg-white text-heading`}>
          <CreditCard className="h-4 w-4" strokeWidth={2.2} />
          Visa / Mastercard
        </span>
      );
    default:
      return (
        <span className={`${base} bg-white text-heading`}>
          <Banknote className="h-4 w-4 text-brand" strokeWidth={2.2} />
          {provider.label}
        </span>
      );
  }
}

function SocialRow({ social, storeName }: { social: SocialLinks; storeName: string }) {
  const entries = [
    { url: social.facebook, label: "Facebook", icon: <FacebookIcon /> },
    { url: social.instagram, label: "Instagram", icon: <InstagramIcon /> },
    { url: social.tiktok, label: "TikTok", icon: <TikTokIcon /> },
    { url: social.youtube, label: "YouTube", icon: <YouTubeIcon /> },
  ].filter((entry): entry is typeof entry & { url: string } => Boolean(entry.url));

  if (entries.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-[14px] font-bold text-white">Connect with {storeName}</h2>
      <ul className="mt-3 flex gap-4">
        {entries.map((entry) => (
          <li key={entry.label}>
            <a
              href={entry.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${storeName} on ${entry.label}`}
              className="block text-white transition hover:opacity-75"
            >
              {entry.icon}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* Brand marks drawn inline: the icon set the shop uses has none, and four
 * small paths cost less than a request for an icon font. */

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
      <path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-7 w-7"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.3" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden>
      <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden>
      <rect x="1" y="4.5" width="22" height="15" rx="4.5" fill="currentColor" />
      <path d="M10 8.8v6.4l5.6-3.2z" className="fill-heading" />
    </svg>
  );
}
