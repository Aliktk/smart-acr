import { access, mkdir, stat } from "node:fs/promises";
import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../common/prisma.service";
import { metricsRegistry } from "../../common/metrics.middleware";
import { appLogger } from "../../common/logger.service";

interface CheckResult {
  status: "ok" | "unavailable";
  latencyMs?: number;
  detail?: string;
}

@Controller("health")
export class HealthController {
  private readonly startedAt = new Date().toISOString();
  private readonly logger = appLogger.child({ module: "health" });

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /** Liveness probe — fast, no dependency checks */
  @Get()
  getHealth() {
    return {
      ok: true,
      service: "smart-acr-api",
      uptime: process.uptime(),
      startedAt: this.startedAt,
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness probe — checks all critical dependencies */
  @Get("ready")
  async getReadiness() {
    const checks: Record<string, CheckResult> = {};

    checks.database = await this.checkDatabase();
    checks.storage = await this.checkStorage();

    // Update Prometheus gauges
    metricsRegistry.setHealthStatus("database", checks.database.status === "ok");
    metricsRegistry.setHealthStatus("storage", checks.storage.status === "ok");

    const allOk = Object.values(checks).every((c) => c.status === "ok");

    if (!allOk) {
      const failing = Object.entries(checks)
        .filter(([, c]) => c.status !== "ok")
        .map(([name]) => name);

      this.logger.error(
        `Readiness check failed: ${failing.join(", ")}`,
        undefined,
        "HealthController",
      );

      throw new ServiceUnavailableException({
        ok: false,
        service: "smart-acr-api",
        checks,
        timestamp: new Date().toISOString(),
      });
    }

    return {
      ok: true,
      service: "smart-acr-api",
      checks,
      uptime: process.uptime(),
      memory: this.getMemoryUsage(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Detailed diagnostics — restricted in production.
   * In production, returns 404 to avoid leaking runtime details.
   * Use the readiness probe for operational health checks.
   */
  @Get("diagnostics")
  async getDiagnostics() {
    const env = this.configService.get("NODE_ENV");
    if (env === "production") {
      return { ok: true, message: "Diagnostics disabled in production. Use /health/ready." };
    }
    const checks: Record<string, CheckResult> = {};
    checks.database = await this.checkDatabase();
    checks.storage = await this.checkStorage();

    return {
      ok: Object.values(checks).every((c) => c.status === "ok"),
      service: "smart-acr-api",
      version: process.env.npm_package_version ?? "unknown",
      nodeVersion: process.version,
      environment: this.configService.get("NODE_ENV"),
      uptime: process.uptime(),
      startedAt: this.startedAt,
      memory: this.getMemoryUsage(),
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<CheckResult> {
    const start = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: "ok", latencyMs: Date.now() - start };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Database check failed: ${msg}`, undefined, "HealthController");
      return { status: "unavailable", latencyMs: Date.now() - start, detail: msg };
    }
  }

  private async checkStorage(): Promise<CheckResult> {
    const storagePath = this.configService.get("STORAGE_PATH") ?? "storage";
    const start = Date.now();
    try {
      await mkdir(storagePath, { recursive: true });
      await access(storagePath);
      return { status: "ok", latencyMs: Date.now() - start };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Storage check failed: ${msg}`, undefined, "HealthController");
      return { status: "unavailable", latencyMs: Date.now() - start, detail: msg };
    }
  }

  private getMemoryUsage(): Record<string, string> {
    const mem = process.memoryUsage();
    return {
      rss: `${(mem.rss / 1024 / 1024).toFixed(1)}MB`,
      heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB`,
      heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`,
      external: `${(mem.external / 1024 / 1024).toFixed(1)}MB`,
    };
  }
}
