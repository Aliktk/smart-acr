"use client";

import { useEffect } from "react";

/**
 * Next.js global error boundary. Catches unhandled errors in the root layout.
 * This is the last line of defense for client-side errors.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Store error for diagnostics (same format as ErrorBoundary component)
    try {
      const stored = JSON.parse(
        sessionStorage.getItem("acr_client_errors") ?? "[]",
      );
      stored.push({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: window.location.href,
        timestamp: new Date().toISOString(),
        source: "global-error-boundary",
      });
      // Keep last 10 errors
      sessionStorage.setItem(
        "acr_client_errors",
        JSON.stringify(stored.slice(-10)),
      );
    } catch {
      // sessionStorage might be unavailable
    }

    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            fontFamily: "system-ui, sans-serif",
            padding: "2rem",
            textAlign: "center",
            backgroundColor: "#fafafa",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "#1a1a1a" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#666", marginBottom: "1.5rem", maxWidth: "400px" }}>
            An unexpected error occurred. Please try again or contact your
            administrator if the problem persists.
          </p>
          {error.digest && (
            <p style={{ color: "#999", fontSize: "0.75rem", marginBottom: "1rem" }}>
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1.5rem",
              border: "1px solid #ccc",
              borderRadius: "6px",
              cursor: "pointer",
              backgroundColor: "#fff",
              fontSize: "0.875rem",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
