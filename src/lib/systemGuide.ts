/** The Zupona System Guide: the owner's blueprint of the whole system.
 *
 * Sections live in `system_guide_sections` (migration 0024), not in the
 * repository, because the repository is public and the guide maps the whole
 * shop. They are written by whoever changes the system -- a Claude session,
 * the WhatsApp agent, a developer -- through `scripts/guide.mjs`, and read
 * here for Admin > Settings > System Guide.
 *
 * Markdown is turned into HTML on the server, so the page ships no parser.
 * Raw HTML typed into a section is shown as text rather than run: the guide
 * is written by trusted hands, but a stray tag should never be able to break
 * or script the admin panel. The one exception is a ```svg fence, which is
 * how the architecture diagram is stored and is drawn as the picture it is. */

import { Marked } from "marked";
import { getDB } from "@/lib/db";

export interface GuideSection {
  slug: string;
  title: string;
  position: number;
  html: string;
  updatedAt: string;
  updatedBy: string | null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const markdown = new Marked({
  gfm: true,
  renderer: {
    html({ text }) {
      return escapeHtml(text);
    },
    code({ text, lang }) {
      if (lang === "svg" && /^\s*<svg[\s>]/.test(text)) {
        return `<figure class="guide-diagram">${text}</figure>`;
      }
      return `<pre><code>${escapeHtml(text)}</code></pre>`;
    },
  },
});

export function renderGuideMarkdown(source: string): string {
  return markdown.parse(source, { async: false });
}

export async function getGuideSections(): Promise<GuideSection[]> {
  const db = await getDB();
  const { results } = await db
    .prepare(
      `SELECT slug, title, position, body_md, updated_at, updated_by
       FROM system_guide_sections
       ORDER BY position`
    )
    .all<{
      slug: string;
      title: string;
      position: number;
      body_md: string;
      updated_at: string;
      updated_by: string | null;
    }>();

  return results.map((row) => ({
    slug: row.slug,
    title: row.title,
    position: row.position,
    html: renderGuideMarkdown(row.body_md),
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }));
}
