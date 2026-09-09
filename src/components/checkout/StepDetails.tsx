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
      <section className="flex items-center gap-3 pt-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold leading-tight text-brand-darkest">
            Let&apos;s get{" "}
            <span className="relative inline-block text-brand">
              started
              <span className="absolute inset-x-0 -bottom-0.5 h-1 rounded-full bg-brand-light/50" />
            </span>
          </h1>
          <p className="mt-1.5 text-xs text-neutral-500">Just one minute to place your order.</p>
        </div>

        <div className="relative flex h-24 w-20 shrink-0 items-center justify-center">
          <span className="absolute inset-0 rounded-full bg-brand-tint" />
          <span className="relative flex h-20 w-14 items-center justify-center rounded-xl bg-brand-darkest shadow-lg shadow-brand/25">
            <ShieldCheck className="h-7 w-7 text-brand-light" />
          </span>
        </div>
      </section>

      <section className="rounded-2xl border border-neutral-100 bg-white p-4 shadow-sm">
        {stage === "phone" ? (
          <>
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-tint">
                <Smartphone className="h-4 w-4 text-brand" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-neutral-800">Mobile number</h2>
                <p className="text-[10px] text-neutral-400">Enter your mobile number to continue.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="flex shrink-0 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 py-3 text-sm font-semibold text-neutral-700">
                <span className="text-base leading-none">🇧🇩</span>
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
                placeholder="01XXXXXXXXX"
                className="w-full min-w-0 rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-800 outline-none placeholder:text-neutral-300 focus:border-brand"
              />
            </div>

            <p className="mt-2.5 flex items-center gap-1.5 text-[10px] text-neutral-400">
              <CircleCheck className="h-3.5 w-3.5 shrink-0 text-brand" />
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
        className="flex items-center justify-center gap-2 rounded-full bg-brand py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-opacity disabled:opacity-50"
      >
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <>
            {stage === "phone" ? "Continue" : "Verify & Continue"}
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>

      <div className="flex items-center justify-center gap-3 text-[10px] font-medium text-neutral-400">
        {TRUST_BADGES.map(({ icon: Icon, label }, index) => (
          <span key={label} className="flex items-center gap-1">
            {index > 0 && <span className="mr-2 h-3 w-px bg-neutral-200" />}
            <Icon className="h-3 w-3 text-brand" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
