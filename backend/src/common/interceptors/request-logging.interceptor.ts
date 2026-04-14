import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, tap } from "rxjs";
import type { Request, Response } from "express";
import { getRequestContext } from "../request-context.middleware";
import { appLogger } from "../logger.service";

/**
 * Logs every completed HTTP request with method, path, status, duration,
 * and the correlation request-id. Skips health/metrics to reduce noise.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private static readonly SKIP_PATHS = new Set([
    "/api/v1/health",
    "/api/v1/health/ready",
    "/api/v1/metrics",
  ]);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest<Request>();
    const res = httpCtx.getResponse<Response>();

    if (RequestLoggingInterceptor.SKIP_PATHS.has(req.path)) {
      return next.handle();
    }

    const startNs = process.hrtime.bigint();
    const reqCtx = getRequestContext();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logRequest(req, res, startNs, reqCtx?.requestId);
        },
        error: () => {
          this.logRequest(req, res, startNs, reqCtx?.requestId);
        },
      }),
    );
  }

  private logRequest(
    req: Request,
    res: Response,
    startNs: bigint,
    requestId?: string,
  ): void {
    const durationMs = Number(process.hrtime.bigint() - startNs) / 1e6;

    const logger = appLogger.child({
      requestId,
      module: "http",
    });

    const statusCode = res.statusCode;
    const entry = `${req.method} ${req.originalUrl} ${statusCode} ${durationMs.toFixed(1)}ms`;

    if (statusCode >= 500) {
      logger.error(entry, undefined, "HTTP");
    } else if (statusCode >= 400) {
      logger.warn(entry, "HTTP");
    } else {
      logger.log(entry, "HTTP");
    }
  }
}
