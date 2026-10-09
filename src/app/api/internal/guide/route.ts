import { NextResponse, type NextRequest } from "next/server";
import { getDB } from "@/lib/db";

/** The System Guide's sections, for the Update System Guide workflow.
 *
 * GitHub Actions has no token that can reach D1 (the deploy token is refused
 * with 7403), so the workflow reads and writes the guide through the Worker,
 * which already holds the D1 binding. `scripts/guide.mjs` uses this route
 * when GUIDE_API_URL and GUIDE_SYNC_TOKEN are set.
 *
 * The caller proves itself with the Worker secret GUIDE_SYNC_TOKEN as a
 * bearer token. That token can read and write `system_guide_sections` and
 * nothing else. With the secret unset the route answers 404, as if absent. */

interface SectionInput {
  slug: string;
  title: string;
  position: number;
  body_md: string;
}

async function syncToken(): Promise<string | null> {
  try {
    const { env } = await import("cloudflare:workers");
    const value = (env as unknown as Record<string, unknown>).GUIDE_SYNC_TOKEN;
    return typeof value === "string" && value.trim().length >= 32 ? value.trim() : null;
  } catch {
    return null;
  }
}

/** Compares without stopping at the first difference, so response time says
 * nothing about how much of a guessed token was right. */
function sameSecret(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0;
}

async function authorized(request: NextRequest): Promise<NextResponse | null> {
  const expected = await syncToken();
  if (!expected) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!given || !sameSecret(given, expected)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  return null;
}

export async function GET(request: NextRequest) {
  const refused = await authorized(request);
  if (refused) return refused;

  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT slug, title, position, body_md, updated_at, updated_by
       FROM system_guide_sections ORDER BY position`
    )
    .all();
  return NextResponse.json({ sections: results }, { headers: { "cache-control": "no-store" } });
}

function valid(section: unknown): section is SectionInput {
  if (!section || typeof section !== "object") return false;
  const s = section as Record<string, unknown>;
  return (
    typeof s.slug === "string" &&
    /^[a-z0-9-]{1,64}$/.test(s.slug) &&
    typeof s.title === "string" &&
    s.title.trim().length > 0 &&
    s.title.length <= 200 &&
    Number.isInteger(s.position) &&
    (s.position as number) >= 0 &&
    (s.position as number) < 1000 &&
    typeof s.body_md === "string" &&
    s.body_md.length <= 300_000
  );
}

export async function PUT(request: NextRequest) {
  const refused = await authorized(request);
  if (refused) return refused;

  let payload: { sections?: unknown; author?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const sections = Array.isArray(payload.sections) ? payload.sections : [];
  if (sections.length === 0 || sections.length > 50 || !sections.every(valid)) {
    return NextResponse.json({ error: "Expected 1-50 valid sections." }, { status: 400 });
  }
  const author =
    typeof payload.author === "string" && payload.author.trim()
      ? payload.author.trim().slice(0, 100)
      : "Guide sync";

  const db = await getDB();
  // Rows whose words did not change keep their timestamp and author, so the
  // page's "last updated" names whoever last changed something real.
  await db.batch(
    sections.map((section) =>
      db
        .prepare(
          `INSERT INTO system_guide_sections (slug, title, position, body_md, updated_at, updated_by)
           VALUES (?, ?, ?, ?, datetime('now'), ?)
           ON CONFLICT(slug) DO UPDATE SET title = excluded.title, position = excluded.position,
             body_md = excluded.body_md, updated_at = excluded.updated_at, updated_by = excluded.updated_by
           WHERE system_guide_sections.body_md IS NOT excluded.body_md
              OR system_guide_sections.title IS NOT excluded.title
              OR system_guide_sections.position IS NOT excluded.position`
        )
        .bind(section.slug, section.title.trim(), section.position, section.body_md, author)
    )
  );

  return NextResponse.json({ ok: true, sections: sections.length });
}
