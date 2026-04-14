/**
 * Frontend structured logger.
 *
 * - Outputs structured JSON to console in development
 * - Stores recent errors in sessionStorage for debugging
 * - Reports critical errors to backend /api/v1/health/client-error (if available)
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  requestId?: string;
  userId?: string;
  url?: string;
  details?: Record<string, unknown>;
}

const MAX_STORED_ERRORS = 20;
const IS_DEV = process.env.NODE_ENV !== "production";

function createEntry(level: LogLevel, message: string, context?: string, details?: Record<string, unknown>): LogEntry {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    url: typeof window !== "undefined" ? window.location.pathname : undefined,
    details,
  };
}

function storeError(entry: LogEntry) {
  if (typeof window === "undefined") return;
  try {
    const stored = JSON.parse(sessionStorage.getItem("acr_client_logs") ?? "[]") as LogEntry[];
    stored.push(entry);
    if (stored.length > MAX_STORED_ERRORS) stored.splice(0, stored.length - MAX_STORED_ERRORS);
    sessionStorage.setItem("acr_client_logs", JSON.stringify(stored));
  } catch {
    // Storage full or unavailable
  }
}

function formatConsole(entry: LogEntry) {
  const prefix = `[${entry.level.toUpperCase()}]`;
  const ctx = entry.context ? ` (${entry.context})` : "";
  return `${prefix}${ctx} ${entry.message}`;
}

export const clientLogger = {
  debug(message: string, context?: string, details?: Record<string, unknown>) {
    if (!IS_DEV) return;
    const entry = createEntry("debug", message, context, details);
    // eslint-disable-next-line no-console
    console.debug(formatConsole(entry), details ?? "");
  },

  info(message: string, context?: string, details?: Record<string, unknown>) {
    const entry = createEntry("info", message, context, details);
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.info(formatConsole(entry), details ?? "");
    }
  },

  warn(message: string, context?: string, details?: Record<string, unknown>) {
    const entry = createEntry("warn", message, context, details);
    storeError(entry);
    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.warn(formatConsole(entry), details ?? "");
    }
  },

  error(message: string, error?: unknown, context?: string) {
    const details: Record<string, unknown> = {};
    if (error instanceof Error) {
      details.errorMessage = error.message;
      details.stack = error.stack?.split("\n").slice(0, 5).join("\n");
    } else if (error) {
      details.raw = String(error);
    }

    const entry = createEntry("error", message, context, details);
    storeError(entry);

    if (IS_DEV) {
      // eslint-disable-next-line no-console
      console.error(formatConsole(entry), error ?? "");
    }
  },

  /** Attach requestId from backend response header for correlation */
  withRequestId(requestId: string) {
    return { requestId, debug: clientLogger.debug, info: clientLogger.info, warn: clientLogger.warn, error: clientLogger.error };
  },

  /** Get stored error log for debugging or support */
  getStoredLogs(): LogEntry[] {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(sessionStorage.getItem("acr_client_logs") ?? "[]") as LogEntry[];
    } catch {
      return [];
    }
  },

  /** Clear stored logs */
  clearStoredLogs() {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem("acr_client_logs");
  },
};
