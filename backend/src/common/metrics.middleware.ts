import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";

interface BucketCounter {
  le: number;
  count: number;
}

interface RouteMetrics {
  requests: Map<string, number>; // "method:route:status" -> count
  durationBuckets: Map<string, BucketCounter[]>; // "method:route" -> buckets
  durationSum: Map<string, number>;
  durationCount: Map<string, number>;
}

const HISTOGRAM_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

class MetricsRegistry {
  private readonly routes: RouteMetrics = {
    requests: new Map(),
    durationBuckets: new Map(),
    durationSum: new Map(),
    durationCount: new Map(),
  };

  private authTokensIssued = 0;
  private healthStatus: Record<string, number> = { database: 1, storage: 1 };

  recordRequest(method: string, route: string, status: number, durationSec: number): void {
    const reqKey = `${method}:${route}:${status}`;
    this.routes.requests.set(reqKey, (this.routes.requests.get(reqKey) ?? 0) + 1);

    const durKey = `${method}:${route}`;
    if (!this.routes.durationBuckets.has(durKey)) {
      this.routes.durationBuckets.set(
        durKey,
        HISTOGRAM_BUCKETS.map((le) => ({ le, count: 0 })),
      );
      this.routes.durationSum.set(durKey, 0);
      this.routes.durationCount.set(durKey, 0);
    }

    const buckets = this.routes.durationBuckets.get(durKey)!;
    for (const bucket of buckets) {
      if (durationSec <= bucket.le) {
        bucket.count++;
      }
    }
    this.routes.durationSum.set(durKey, (this.routes.durationSum.get(durKey) ?? 0) + durationSec);
    this.routes.durationCount.set(durKey, (this.routes.durationCount.get(durKey) ?? 0) + 1);
  }

  incrementAuthTokens(): void {
    this.authTokensIssued++;
  }

  setHealthStatus(check: string, up: boolean): void {
    this.healthStatus[check] = up ? 1 : 0;
  }

  serialize(): string {
    const lines: string[] = [];

    lines.push("# HELP smart_acr_http_requests_total Total HTTP requests");
    lines.push("# TYPE smart_acr_http_requests_total counter");
    for (const [key, count] of this.routes.requests) {
      const [method, route, status] = key.split(":");
      lines.push(`smart_acr_http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`);
    }

    lines.push("# HELP smart_acr_http_request_duration_seconds HTTP request duration histogram");
    lines.push("# TYPE smart_acr_http_request_duration_seconds histogram");
    for (const [key, buckets] of this.routes.durationBuckets) {
      const [method, route] = key.split(":");
      const labels = `method="${method}",route="${route}"`;
      let cumulative = 0;
      for (const bucket of buckets) {
        cumulative += bucket.count;
        lines.push(`smart_acr_http_request_duration_seconds_bucket{${labels},le="${bucket.le}"} ${cumulative}`);
      }
      lines.push(`smart_acr_http_request_duration_seconds_bucket{${labels},le="+Inf"} ${this.routes.durationCount.get(key)}`);
      lines.push(`smart_acr_http_request_duration_seconds_sum{${labels}} ${this.routes.durationSum.get(key)}`);
      lines.push(`smart_acr_http_request_duration_seconds_count{${labels}} ${this.routes.durationCount.get(key)}`);
    }

    lines.push("# HELP smart_acr_auth_tokens_issued_total Total JWT tokens issued");
    lines.push("# TYPE smart_acr_auth_tokens_issued_total counter");
    lines.push(`smart_acr_auth_tokens_issued_total ${this.authTokensIssued}`);

    lines.push("# HELP smart_acr_health_check_status Health check status (1=up, 0=down)");
    lines.push("# TYPE smart_acr_health_check_status gauge");
    for (const [check, status] of Object.entries(this.healthStatus)) {
      lines.push(`smart_acr_health_check_status{check="${check}"} ${status}`);
    }

    return lines.join("\n") + "\n";
  }
}

export const metricsRegistry = new MetricsRegistry();

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    if (req.path === "/api/v1/metrics" || req.path === "/api/v1/health") {
      return next();
    }

    const start = process.hrtime.bigint();

    res.on("finish", () => {
      const durationNs = Number(process.hrtime.bigint() - start);
      const durationSec = durationNs / 1e9;
      const route = this.normalizeRoute(req.route?.path ?? req.path);
      metricsRegistry.recordRequest(req.method, route, res.statusCode, durationSec);
    });

    next();
  }

  private normalizeRoute(path: string): string {
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
      .replace(/\/\d+/g, "/:id");
  }
}
