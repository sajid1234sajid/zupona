"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { sendContactAction } from "@/app/contact/actions";

const field =
  "mt-1 block w-full rounded-xl border border-line bg-white px-3 text-[14px] text-heading placeholder:text-ink-faint focus:border-brand focus:outline-none";

/** Name, phone, an optional order number and the message. */
export default function ContactForm({ defaults }: { defaults: { name: string; phone: string } }) {
  const [name, setName] = useState(defaults.name);
  const [phone, setPhone] = useState(defaults.phone);
  const [orderNumber, setOrderNumber] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  if (sent) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-brand-tint px-4 py-3 text-[13.5px] font-semibold text-brand-dark">
        <CheckCircle2 className="h-5 w-5 shrink-0" />
        Thank you, we got your message. We&apos;ll call or WhatsApp you on {phone}, usually within one working day.
      </p>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        startTransition(async () => {
          const result = await sendContactAction({ name, phone, orderNumber, message });
          if (!result.ok) {
            setError(result.error ?? "Could not send. Please try WhatsApp.");
            return;
          }
          setSent(true);
        });
      }}
      className="grid grid-cols-1 gap-3 tab:grid-cols-2"
    >
      <label className="text-[12.5px] font-semibold text-ink-muted">
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoComplete="name" className={`${field} h-11`} />
      </label>
      <label className="text-[12.5px] font-semibold text-ink-muted">
        Mobile number
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="01XXXXXXXXX"
          className={`${field} h-11`}
        />
      </label>
      <label className="text-[12.5px] font-semibold text-ink-muted tab:col-span-2">
        Order number <span className="font-normal">(optional)</span>
        <input
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          maxLength={20}
          placeholder="e.g. ZUP1234567"
          className={`${field} h-11`}
        />
      </label>
      <label className="text-[12.5px] font-semibold text-ink-muted tab:col-span-2">
        Message
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={2000}
          required
          rows={4}
          placeholder="How can we help?"
          className={`${field} resize-y py-2.5`}
        />
      </label>
      {error ? (
        <p role="alert" className="rounded-lg bg-accent-red/10 px-3 py-2 text-xs font-semibold text-accent-red tab:col-span-2">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-6 text-[14px] font-bold text-white disabled:opacity-60 tab:col-span-2 tab:justify-self-start"
      >
        {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Send message
      </button>
    </form>
  );
}
