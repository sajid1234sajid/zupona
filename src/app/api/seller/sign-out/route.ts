import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/session";
import { sellerUrl } from "@/lib/panelUrl";

/** Signs out, then opens the application form in a fresh page load.
 *
 * A route handler rather than a server action on purpose. A server action that
 * redirects renders its destination inside the same request, where the signed
 * -in user has already been read and memoised -- so "sign out and apply" landed
 * back on "you are signed in as the admin". A 303 here makes the browser ask
 * for the form anew, without the cookie.
 *
 * POST only, so a link on another site cannot sign anyone out. */
export async function POST(request: NextRequest) {
  await destroySession();
  const target = new URL(await sellerUrl("/seller/apply"), request.url);
  return NextResponse.redirect(target, 303);
}
