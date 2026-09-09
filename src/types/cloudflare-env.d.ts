// Augments the generated `Cloudflare.Env` (see worker-configuration.d.ts) with
// vars/secrets that aren't declared in wrangler.jsonc because they're secret.
// Set locally via `.dev.vars` and in production via `wrangler secret put`.
declare namespace Cloudflare {
  interface Env {
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
  }
}
