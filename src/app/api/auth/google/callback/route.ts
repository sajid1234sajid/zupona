import { NextResponse, type NextRequest } from "next/server";
import { env } from "cloudflare:workers";
import { getDB } from "@/lib/db";
import { createSession } from "@/lib/session";

interface GoogleTokenResponse {
  id_token: string;
}

interface GoogleIdTokenClaims {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

function decodeIdToken(idToken: string): GoogleIdTokenClaims {
  const payload = idToken.split(".")[1];
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  return JSON.parse(json);
}

export async function GET(request: NextRequest) {
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/account/login?error=${reason}`, request.url));

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const cookieState = request.cookies.get("google_oauth_state")?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return fail("google_state_mismatch");
  }

  const clientId = env.GOOGLE_CLIENT_ID;
  const clientSecret = env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return fail("google_not_configured");
  }

  const redirectUri = new URL("/api/auth/google/callback", request.url).toString();

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    return fail("google_token_exchange_failed");
  }

  const tokens = (await tokenResponse.json()) as GoogleTokenResponse;
  const claims = decodeIdToken(tokens.id_token);

  if (!claims.email) {
    return fail("google_no_email");
  }

  const db = await getDB();
  const email = claims.email.toLowerCase();

  let user = await db
    .prepare("SELECT id FROM users WHERE google_id = ? OR email = ?")
    .bind(claims.sub, email)
    .first<{ id: string }>();

  if (!user) {
    const id = crypto.randomUUID();
    await db
      .prepare("INSERT INTO users (id, name, email, google_id, avatar_url) VALUES (?, ?, ?, ?, ?)")
      .bind(id, claims.name ?? email.split("@")[0], email, claims.sub, claims.picture ?? null)
      .run();
    user = { id };
  } else {
    await db
      .prepare("UPDATE users SET google_id = ?, avatar_url = COALESCE(avatar_url, ?) WHERE id = ?")
      .bind(claims.sub, claims.picture ?? null, user.id)
      .run();
  }

  await createSession(user.id);

  const response = NextResponse.redirect(new URL("/account", request.url));
  response.cookies.delete("google_oauth_state");
  return response;
}
