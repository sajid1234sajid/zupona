"use client";

import Link from "next/link";
import { RefreshCw, TriangleAlert } from "lucide-react";

/** What a shopper sees when something on the page throws.
 *
 * Until this existed there was no error boundary anywhere between a button and
 * the root, so one failed request -- a server action the Worker refused, a read
 * that timed out on a slow connection -- took the whole tab down and Chrome
 * drew its own "This page couldn't load". A shopper who had been reading a
 * product lost it, and nothing on the screen suggested that pressing again
 * would work, which it almost always does.
 *
 * So: the shop's own page, saying what happened in a sentence, with the retry
 * that fixes it first and a way home behind it. */
export default function StoreError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-brand-mist px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-card">
        <TriangleAlert className="h-7 w-7 text-brand" />
      </span>
      <h1 className="text-lg font-bold text-heading">Something went wrong</h1>
      <p className="max-w-xs text-sm text-ink-slate">
        The page could not finish loading. This is usually a slow connection —
        please try again.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white"
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </button>
      <Link href="/" className="text-sm font-semibold text-brand-darkest underline">
        Go to home
      </Link>
    </main>
  );
}
