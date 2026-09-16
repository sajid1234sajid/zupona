"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { CODE_LENGTH, formatBdPhone } from "@/lib/checkout";

interface VerificationCardProps {
  phone: string;
  code: string;
  onCodeChange: (code: string) => void;
  /** Epoch ms at which "Resend code" becomes tappable; counts down on its own. */
  resendAt: number;
  onResend: () => void;
  resending?: boolean;
  /** Set once the number is confirmed - the inputs lock and turn green. */
  verified?: boolean;
  /** Whether a code actually reached the gateway. The card says "we've sent
   * you a code" only when one was sent: a shopper told to check their phone
   * for a message the gateway refused will sit and wait for it. */
  sent?: boolean;
  /** Set only when the shop has demo mode on: the code is printed here
   * instead of being sent, so checkout can be tested without a gateway. */
  demoCode?: string | null;
  bare?: boolean;
}

/** Seconds left until `deadline`, ticked from a clock rather than from state
 * copied out of props - so a freshly issued code restarts it automatically. */
function useSecondsLeft(deadline: number): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

function formatCountdown(seconds: number): string {
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function VerificationCard({
  phone,
  code,
  onCodeChange,
  resendAt,
  onResend,
  resending = false,
  verified = false,
  sent = false,
  demoCode,
  bare = false,
}: VerificationCardProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const left = useSecondsLeft(resendAt);
  const digits = code.padEnd(CODE_LENGTH, " ").slice(0, CODE_LENGTH).split("");

  function writeDigit(index: number, value: string) {
    const next = digits.map((digit) => (digit === " " ? "" : digit));
    next[index] = value;
    onCodeChange(next.join("").slice(0, CODE_LENGTH));
    if (value && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  }

  const body = (
    <>
      <div className="mb-3 flex items-center gap-2">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand"
        >
          {verified ? (
            <BadgeCheck className="h-[22px] w-[22px] text-white" />
          ) : (
            <ShieldCheck className="h-[22px] w-[22px] text-white" />
          )}
        </span>
        <div className="min-w-0">
          <h2 className="text-[16px] font-bold leading-tight text-ink-strong">
            {verified ? "Mobile number verified" : "Enter verification code"}
          </h2>
          <p className="text-[10px] leading-tight text-ink-slate">
            {verified ? (
              <>{formatBdPhone(phone)} is confirmed for this order.</>
            ) : sent || demoCode ? (
              <>
                We&apos;ve sent a {CODE_LENGTH}-digit code to your phone number{" "}
                <span className="font-semibold text-ink-slate">{formatBdPhone(phone)}</span>
              </>
            ) : resending ? (
              <>
                Sending a {CODE_LENGTH}-digit code to{" "}
                <span className="font-semibold text-ink-slate">{formatBdPhone(phone)}</span>…
              </>
            ) : (
              <>
                No code has reached{" "}
                <span className="font-semibold text-ink-slate">{formatBdPhone(phone)}</span> yet —
                tap Resend code to try again.
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex justify-between gap-1.5">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(element) => {
              inputs.current[index] = element;
            }}
            value={digit.trim()}
            disabled={verified}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label={`Digit ${index + 1}`}
            maxLength={1}
            onChange={(event) => writeDigit(index, event.target.value.replace(/\D/g, "").slice(-1))}
            onKeyDown={(event) => {
              if (event.key === "Backspace" && !digit.trim() && index > 0) {
                inputs.current[index - 1]?.focus();
              }
            }}
            onPaste={(event) => {
              event.preventDefault();
              const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
              if (pasted) {
                onCodeChange(pasted);
                inputs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
              }
            }}
            className={`h-11 w-full min-w-0 rounded-xl border text-center text-base font-bold outline-none transition-colors ${
              verified
                ? "border-brand/40 bg-brand-tint text-brand-dark"
                : digit.trim()
                  ? "border-brand bg-white text-brand-darkest"
                  : "border-line bg-white text-ink-strong focus:border-brand"
            }`}
          />
        ))}
      </div>

      {!verified && (
        <div className="mt-2.5 flex items-center justify-between">
          <p className="text-[10px] text-ink-slate">
            {left > 0 ? (
              <>Resend code in {formatCountdown(left)}</>
            ) : (
              <>Didn&apos;t get the code?</>
            )}
          </p>
          <button
            type="button"
            onClick={onResend}
            disabled={left > 0 || resending}
            className="text-[11px] font-semibold text-brand disabled:text-ink-faint"
          >
            {resending ? "Sending…" : "Resend code"}
          </button>
        </div>
      )}

      {!verified && demoCode && (
        <p className="mt-2 rounded-lg bg-accent-orange/10 px-2.5 py-1.5 text-[10px] text-accent-orange-dark">
          Demo mode — no SMS was sent, so your code is shown here:{" "}
          <span className="font-bold tracking-widest">{demoCode}</span>
        </p>
      )}
    </>
  );

  if (bare) return body;

  return <section className="rounded-2xl border border-line bg-white p-4 shadow-card">{body}</section>;
}
