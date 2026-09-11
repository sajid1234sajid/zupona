"use client";

import { useState, useTransition } from "react";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  Leaf,
  LoaderCircle,
  ShieldCheck,
  Smartphone,
  Zap,
} from "lucide-react";
import { CODE_LENGTH, CODE_TTL_SECONDS } from "@/lib/checkout";
import { sendCodeAction, verifyAndSignInAction } from "@/app/checkout/actions";
import VerificationCard from "./VerificationCard";
import PhoneShieldArt from "./PhoneShieldArt";
import BangladeshFlag from "@/components/brand/BangladeshFlag";

const TRUST_BADGES = [
  { icon: ShieldCheck, label: "Fast" },
  { icon: Zap, label: "Secure" },
  { icon: Leaf, label: "No password needed" },
];

/** Step 1 - shown only to signed-out shoppers. Confirming the code signs them in
 * (creating the account on first use); the action then redirects back into
 * /checkout, which re-renders on step 2 with their cart and saved details. */
export default function StepDetails() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [sentAt, setSentAt] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const stage = demoCode !== null || sentAt > 0 ? "code" : "phone";

  function send(isResend = false) {
    setError(undefined);
    startTransition(async () => {
      const result = await sendCodeAction(phone);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDemoCode(result.demoCode ?? null);
      setSentAt(Date.now());
      if (isResend) setCode("");
    });
  }

  function verify() {
    setError(undefined);
    startTransition(async () => {
      const result = await verifyAndSignInAction(phone, code);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-5 px-4">
      <section className="flex items-start gap-2 pt-1">
        <div className="min-w-0 flex-1">
          {/* Two lines, as the reference sets it: the second word carries the
              brighter green. */}
          <h1 className="text-[30px] font-extrabold leading-[1.08] tracking-tight text-brand-darkest">
            Let&apos;s get
            <br />
            <span className="text-brand-light">started</span>
          </h1>
          <p className="mt-1.5 text-[12.5px] text-neutral-500">
            Just one minute to place your order.
          </p>
          {/* the hand-drawn underline the reference puts below the subtitle */}
          <svg
            aria-hidden
            viewBox="0 0 120 10"
            className="mt-1.5 h-2.5 w-28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M2 7.5 C28 2 74 1.5 118 4"
              stroke="var(--color-brand-light)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <PhoneShieldArt className="-mr-1 -mt-1 h-28 w-28 shrink-0" />
      </section>

      <section className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm">
        {stage === "phone" ? (
          <>
            <div className="mb-3 flex items-center gap-2.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-tint">
                <Smartphone className="h-5 w-5 text-brand" />
              </span>
              <div>
                <h2 className="text-[16px] font-bold leading-tight text-brand-darkest">
                  Mobile number
                </h2>
                <p className="text-[11.5px] text-neutral-400">
                  Enter your mobile number to continue.
                </p>
              </div>
            </div>

            {/* The reference draws the dialling code and the number as one
                bordered row split by a divider, not as two separate boxes.
                Bangladesh is the only country the shop delivers to, so the
                prefix is a label rather than a picker -- a chevron here would
                promise a choice that does not exist. */}
            <div className="flex items-stretch rounded-xl border border-neutral-200 bg-white focus-within:border-brand">
              <span className="flex shrink-0 items-center gap-2 border-r border-neutral-200 px-3 py-3 text-[15px] font-bold text-brand-darkest">
                <BangladeshFlag className="h-4 w-[26px] rounded-[3px]" />
                +880
              </span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") send();
                }}
                type="tel"
                inputMode="numeric"
                autoComplete="tel"
                aria-label="Mobile number"
                placeholder="01XXXXXXXXX"
                className="w-full min-w-0 rounded-r-xl bg-transparent px-3 py-3 text-[15px] text-neutral-800 outline-none placeholder:text-neutral-300"
              />
            </div>

            <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px] text-neutral-400">
              <CircleCheck className="h-4 w-4 shrink-0 text-brand" />
              We&apos;ll use this number for order updates.
            </p>
          </>
        ) : (
          <>
            <VerificationCard
              bare
              phone={phone}
              code={code}
              onCodeChange={setCode}
              resendAt={sentAt + CODE_TTL_SECONDS * 1000}
              onResend={() => send(true)}
              resending={pending}
              demoCode={demoCode}
            />
            <button
              type="button"
              onClick={() => {
                setSentAt(0);
                setDemoCode(null);
                setCode("");
                setError(undefined);
              }}
              className="mt-3 text-[11px] font-semibold text-neutral-400 underline"
            >
              Use a different number
            </button>
          </>
        )}
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-accent-red/10 px-4 py-3 text-xs font-medium text-accent-red">
          <CircleAlert className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={() => (stage === "phone" ? send() : verify())}
        disabled={pending || (stage === "phone" ? phone.trim().length < 6 : code.length < CODE_LENGTH)}
        className="flex items-center justify-center gap-2 rounded-full bg-brand-dark py-4 text-[16px] font-bold text-white shadow-lg shadow-brand/25 transition-opacity disabled:opacity-50"
      >
        {pending ? (
          <LoaderCircle className="h-5 w-5 animate-spin" />
        ) : (
          <>
            {stage === "phone" ? "Continue" : "Verify & Continue"}
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-3 text-[11.5px] font-medium text-neutral-400">
        {TRUST_BADGES.map(({ icon: Icon, label }, index) => (
          <span key={label} className="flex items-center gap-1.5">
            {index > 0 && <span className="mr-2.5 h-3.5 w-px bg-neutral-200" />}
            <Icon className="h-3.5 w-3.5 text-brand-darkest" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
