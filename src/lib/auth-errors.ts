const MESSAGES: Record<string, string> = {
  google_not_configured: "Google sign-in isn't set up yet. Use email or mobile number instead.",
  google_state_mismatch: "That sign-in attempt expired. Please try again.",
  google_token_exchange_failed: "Google sign-in failed. Please try again.",
  google_no_email: "Your Google account has no email we can use. Try another sign-in method.",
};

export function mapAuthError(code?: string): string | undefined {
  if (!code) return undefined;
  return MESSAGES[code] ?? "Something went wrong. Please try again.";
}
