/** Zupona Image Fit.
 *
 * Two doors into the same AI painter:
 *
 *   - `POST /api/expand` for the app's own page at fit.zupona.com. Anyone can
 *     load the page, but painting spends the account's AI allowance, so the
 *     request must carry the access key set with `wrangler secret put
 *     ACCESS_KEY`.
 *   - The `ImageFit` entrypoint, for the Zupona shop itself. It is reachable
 *     only through a service binding from another Worker on this account,
 *     never from the internet, so it needs no key: the shop's admin route has
 *     already checked that an admin is asking.
 *
 * Everything else -- the page, its script -- is served from `public/` by the
 * assets binding before this code runs. */

import { WorkerEntrypoint } from "cloudflare:workers";
import { expand, ExpandError, type ExpandInput } from "./expand";

interface Env {
  AI: Ai;
  ACCESS_KEY?: string;
}

/** Constant-time comparison, so the key cannot be guessed a character at a
 * time from how long a refusal takes. */
function sameKey(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a[index] ^ b[index];
  return difference === 0;
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "cache-control": "no-store" } });
}

async function readInput(request: Request): Promise<ExpandInput> {
  const form = await request.formData().catch(() => null);
  const image = form?.get("image");
  if (!(image instanceof File)) throw new ExpandError("Send the picture as a form file.");
  return {
    image: await image.arrayBuffer(),
    width: Number(form?.get("width")),
    height: Number(form?.get("height")),
  };
}

/** The model answers in whichever format it likes; the bytes say which. */
function imageType(bytes: Uint8Array): string {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  return "image/webp";
}

export class ImageFit extends WorkerEntrypoint<Env> {
  /** Called by the Zupona admin through its service binding. Returns the
   * painted frame's bytes; the browser decodes whatever format they are. */
  async expand(input: ExpandInput): Promise<Uint8Array<ArrayBuffer>> {
    return expand(this.env.AI, input);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/expand") {
      if (request.method !== "POST") return json({ error: "Use POST." }, 405);

      if (!env.ACCESS_KEY) {
        return json({ error: "The app has no access key set yet." }, 503);
      }
      if (!sameKey(request.headers.get("x-access-key") ?? "", env.ACCESS_KEY)) {
        return json({ error: "Wrong access key." }, 401);
      }

      try {
        const painted = await expand(env.AI, await readInput(request));
        return new Response(painted, {
          headers: { "content-type": imageType(painted), "cache-control": "no-store" },
        });
      } catch (error) {
        if (error instanceof ExpandError) return json({ error: error.message }, error.status);
        throw error;
      }
    }

    // The key check on its own, so the page can tell someone their key is
    // wrong before they spend a minute choosing pictures.
    if (url.pathname === "/api/check") {
      const ok =
        !!env.ACCESS_KEY && sameKey(request.headers.get("x-access-key") ?? "", env.ACCESS_KEY);
      return json({ ok }, ok ? 200 : 401);
    }

    return json({ error: "Not found." }, 404);
  },
} satisfies ExportedHandler<Env>;
