/** Server errors go to Sentry, when Settings holds a DSN; see
 * src/lib/errorReport.ts. vinext calls this for any request that throws. */

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routePath?: string; routeType?: string }
): Promise<void> {
  const { reportError } = await import("@/lib/errorReport");
  const problem = error instanceof Error ? error : new Error(String(error));
  // Redirects and not-found are how pages navigate, not failures.
  const digest = (problem as Error & { digest?: string }).digest ?? "";
  if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND") || digest.startsWith("NEXT_HTTP_ERROR")) return;
  await reportError({
    source: "server",
    message: problem.message,
    type: problem.name,
    stack: problem.stack,
    url: request.path,
    tags: { route: context.routePath ?? "", kind: context.routeType ?? "", method: request.method },
  });
}
