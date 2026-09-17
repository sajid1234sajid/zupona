"use client";

/** Calls a server action in a way that cannot take the page down with it.
 *
 * A server action that rejects is caught by nothing: React rethrows it out of
 * the transition, and there is no error boundary between a Buy Now button and
 * the root, so the whole tab dies. On zupona.com that is what Chrome's "This
 * page couldn't load" after a Buy Now tap actually was -- the Worker refused
 * the action POST with "exceeded CPU time limit", the promise rejected, and a
 * shopper who had only pressed a button lost the page they were reading.
 *
 * So the purchase paths call through here. One silent retry, because the
 * refusal is a one-off -- the same tap goes through a moment later -- and a
 * result rather than an exception, so the button can say what happened
 * instead of the page disappearing. */
export type ActionOutcome<T> = { ok: true; value: T } | { ok: false };

/** Long enough for a cold isolate to have finished starting, short enough that
 * the retry still feels like the same tap. */
const RETRY_DELAY_MS = 400;

export async function callAction<T>(run: () => Promise<T>): Promise<ActionOutcome<T>> {
  try {
    return { ok: true, value: await run() };
  } catch {
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  }

  try {
    return { ok: true, value: await run() };
  } catch {
    return { ok: false };
  }
}
