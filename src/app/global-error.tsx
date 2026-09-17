"use client";

/** The last resort: a failure in the root layout itself, where `error.tsx`
 * cannot help because the layout it lives inside is the thing that broke.
 *
 * It has to render its own `<html>` and `<body>`, so it carries no fonts and no
 * Tailwind -- the styles are inline on purpose. Nothing here may depend on the
 * app, because the app is what failed. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 24,
          textAlign: "center",
          background: "#f1f7f4",
          color: "#12261f",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Zupona could not load this page</h1>
        <p style={{ fontSize: 14, margin: 0, maxWidth: 320, color: "#4a5b55" }}>
          Something went wrong on our side. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: 8,
            border: 0,
            borderRadius: 999,
            background: "#037e5b",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            padding: "12px 24px",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
