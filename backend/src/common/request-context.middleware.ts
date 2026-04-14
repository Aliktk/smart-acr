import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { AsyncLocalStorage } from "node:async_hooks";

export interface RequestContext {
  requestId: string;
  startTime: bigint;
  method: string;
  url: string;
  ip: string;
  userAgent: string;
  userId?: string;
  userRole?: string;
}

/**
 * AsyncLocalStorage provides request-scoped context without dependency injection.
 * Any code running within a request can call `requestStorage.getStore()` to get
 * the current request's correlation ID, user info, etc.
 */
export const requestStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Returns the current request context from AsyncLocalStorage, or undefined.
 */
export function getRequestContext(): RequestContext | undefined {
  return requestStorage.getStore();
}

const REQUEST_ID_HEADER = "x-request-id";

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const requestId =
      (req.headers[REQUEST_ID_HEADER] as string) || randomUUID();

    const context: RequestContext = {
      requestId,
      startTime: process.hrtime.bigint(),
      method: req.method,
      url: req.originalUrl,
      ip: req.ip ?? req.socket.remoteAddress ?? "unknown",
      userAgent: req.headers["user-agent"] ?? "unknown",
    };

    // Set response header so clients can correlate
    res.setHeader("x-request-id", requestId);

    requestStorage.run(context, () => {
      next();
    });
  }
}
