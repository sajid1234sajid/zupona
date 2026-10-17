"use server";

import { getCurrentUser } from "@/lib/session";
import { saveContactMessage, type ContactInput } from "@/lib/supportFeedback";

/** The contact form. Guests can write too; a signed-in shopper's message is
 * tied to their account so support can see their orders. */
export async function sendContactAction(input: ContactInput): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  return saveContactMessage(user?.id ?? null, {
    name: String(input?.name ?? ""),
    phone: String(input?.phone ?? ""),
    orderNumber: String(input?.orderNumber ?? ""),
    message: String(input?.message ?? ""),
  });
}
