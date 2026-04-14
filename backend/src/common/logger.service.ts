import { Injectable, LoggerService as NestLoggerService } from "@nestjs/common";

export interface LogContext {
  requestId?: string;
  userId?: string;
  userRole?: string;
  method?: string;
  url?: string;
  module?: string;
  action?: string;
  [key: string]: unknown;
}

const IS_PRODUCTION = process.env.NODE_ENV === "production";

// ANSI color codes
const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const COLORS: Record<string, string> = {
  info:    "\x1b[32m",  // green
  warn:    "\x1b[33m",  // yellow
  error:   "\x1b[31m",  // red
  debug:   "\x1b[36m",  // cyan
  verbose: "\x1b[35m",  // magenta
  fatal:   "\x1b[41m\x1b[37m", // white on red bg
};
const CONTEXT_COLOR = "\x1b[33m"; // yellow for context

function formatTime(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  return `${h}:${m}:${s}.${ms}`;
}

function formatPretty(
  level: string,
  message: string,
  context: string | undefined,
  extra: LogContext,
): string {
  const color = COLORS[level] ?? RESET;
  const levelTag = `${color}${BOLD}${level.toUpperCase().padEnd(5)}${RESET}`;
  const time = `${DIM}${formatTime()}${RESET}`;
  const ctx = context ? ` ${CONTEXT_COLOR}[${context}]${RESET}` : "";

  // Build extra context string for important fields only
  const parts: string[] = [];
  if (extra.requestId) parts.push(`req=${extra.requestId.slice(0, 8)}`);
  if (extra.userId) parts.push(`user=${extra.userId.slice(0, 8)}`);
  if (extra.method && extra.url) parts.push(`${extra.method} ${extra.url}`);
  if (extra.statusCode) parts.push(`${extra.statusCode}`);
  if (extra.durationMs) parts.push(`${extra.durationMs}ms`);
  if (extra.module && !context) parts.push(`mod=${extra.module}`);
  const extraStr = parts.length > 0 ? ` ${DIM}${parts.join(" · ")}${RESET}` : "";

  return `${time} ${levelTag}${ctx} ${message}${extraStr}`;
}

function formatJson(
  level: string,
  message: string,
  context: string | undefined,
  extra: LogContext,
): string {
  const entry: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? { context } : {}),
    ...extra,
  };
  return JSON.stringify(entry);
}

function formatEntry(
  level: string,
  message: string,
  context: string | undefined,
  extra: LogContext,
): string {
  return IS_PRODUCTION
    ? formatJson(level, message, context, extra)
    : formatPretty(level, message, context, extra);
}

/**
 * Structured JSON logger that outputs one JSON object per line.
 * Compatible with log aggregators (CloudWatch, Datadog, ELK, Loki).
 */
@Injectable()
export class StructuredLogger implements NestLoggerService {
  private context?: string;
  private extra: LogContext = {};

  setContext(context: string): void {
    this.context = context;
  }

  setExtra(extra: LogContext): void {
    this.extra = { ...this.extra, ...extra };
  }

  log(message: string, context?: string): void {
    process.stdout.write(formatEntry("info", message, context ?? this.context, this.extra) + "\n");
  }

  error(message: string, trace?: string, context?: string): void {
    const extra = trace ? { ...this.extra, stack: trace } : this.extra;
    process.stderr.write(formatEntry("error", message, context ?? this.context, extra) + "\n");
  }

  warn(message: string, context?: string): void {
    process.stdout.write(formatEntry("warn", message, context ?? this.context, this.extra) + "\n");
  }

  debug(message: string, context?: string): void {
    if (process.env.NODE_ENV === "production") return;
    process.stdout.write(formatEntry("debug", message, context ?? this.context, this.extra) + "\n");
  }

  verbose(message: string, context?: string): void {
    if (process.env.NODE_ENV === "production") return;
    process.stdout.write(formatEntry("verbose", message, context ?? this.context, this.extra) + "\n");
  }

  fatal(message: string, context?: string): void {
    process.stderr.write(formatEntry("fatal", message, context ?? this.context, this.extra) + "\n");
  }

  /**
   * Create a child logger with additional context.
   */
  child(extra: LogContext): StructuredLogger {
    const child = new StructuredLogger();
    child.context = this.context;
    child.extra = { ...this.extra, ...extra };
    return child;
  }
}

/**
 * Singleton application logger used as the NestJS logger replacement.
 */
export const appLogger = new StructuredLogger();
