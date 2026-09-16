// Augments the generated `Cloudflare.Env` (see worker-configuration.d.ts) with
// vars/secrets that aren't declared in wrangler.jsonc because they're secret.
// Set locally via `.dev.vars` and in production via `wrangler secret put`.
declare namespace Cloudflare {
  interface Env {
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    /** Which adapter in src/lib/sms.ts handles the send. Defaults to sms.net.bd. */
    SMS_PROVIDER?: "smsnetbd" | "bulksmsbd" | "mimsms" | "custom";
    SMS_API_KEY?: string;
    /** The approved sender mask. The `sms_sender_id` setting is used when this
     * is unset, so a shop can change masks without a deploy. */
    SMS_SENDER_ID?: string;
    /** MiMSMS authenticates on a username as well as the key. */
    SMS_USERNAME?: string;
    /** Overrides the provider's endpoint; required for SMS_PROVIDER=custom,
     * where it is a URL template — see src/lib/sms.ts. */
    SMS_ENDPOINT?: string;
  }
}
