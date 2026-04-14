import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { getRequestContext } from "../request-context.middleware";
import { appLogger } from "../logger.service";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const reqCtx = getRequestContext();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = "An unexpected error occurred.";
    let error = "Internal Server Error";

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      error = exception.name;

      if (typeof exceptionResponse === "string") {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === "object" && exceptionResponse !== null) {
        const body = exceptionResponse as Record<string, unknown>;
        message = (body.message as string | string[]) ?? message;
        error = (body.error as string) ?? error;
      }

      // Log 4xx client errors as warnings for visibility
      if (statusCode >= 400 && statusCode < 500) {
        appLogger.child({
          requestId: reqCtx?.requestId,
          module: "exception",
          statusCode,
          error,
          path: request.url,
        }).warn(
          `Client error on ${request.method} ${request.url}: ${Array.isArray(message) ? message.join(", ") : message}`,
          "ExceptionFilter",
        );
      }
    } else {
      // Unhandled / unexpected exceptions
      const stack = exception instanceof Error ? exception.stack : undefined;
      const errMessage = exception instanceof Error ? exception.message : String(exception);

      appLogger.child({
        requestId: reqCtx?.requestId,
        module: "exception",
        statusCode,
        error: errMessage,
        path: request.url,
        method: request.method,
        userId: reqCtx?.userId,
      }).error(
        `Unhandled exception on ${request.method} ${request.url}: ${errMessage}`,
        stack,
        "ExceptionFilter",
      );
    }

    response.status(statusCode).json({
      statusCode,
      error,
      message,
      requestId: reqCtx?.requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
