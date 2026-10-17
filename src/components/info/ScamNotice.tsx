import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import ScamNoticeClose from "./ScamNoticeClose";
import { scamNoticeScript } from "./scamNoticeScript";

/** "Zupona never asks for advance payment to a personal number."
 *
 * The most common way Bangladeshi shoppers lose money online is a fake page
 * or caller asking for an advance on bKash; a shop that says plainly what it
 * will never ask for makes the fake easier to spot. Shown on the homepage and
 * in the account, closable, and back after 30 days. Hidden with CSS from the
 * first frame when closed (see `data-scam-note-closed` in globals.css), so it
 * never pushes the page down and then disappears. */
export default function ScamNotice({ className = "" }: { className?: string }) {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: scamNoticeScript }} />
      <div
        role="note"
        className={`scam-note flex items-center gap-2.5 rounded-xl border border-urgency/25 bg-badge-bg py-2 pl-3 pr-1.5 ${className}`}
      >
        <ShieldAlert className="h-4 w-4 shrink-0 text-urgency" strokeWidth={2.4} />
        <p className="flex-1 text-[11.5px] leading-snug text-heading tab:text-[12.5px]">
          Zupona never asks for advance payment to a personal bKash/Nagad number or for your OTP.
          Only order on <strong>zupona.com</strong>.{" "}
          <Link href="/safety" prefetch={false} className="font-semibold text-brand underline-offset-2 hover:underline">
            Learn more
          </Link>
        </p>
        <ScamNoticeClose />
      </div>
    </>
  );
}
