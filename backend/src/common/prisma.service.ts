import { INestApplication, Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { appLogger } from "./logger.service";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = appLogger.child({ module: "prisma" });

  constructor() {
    super({
      log:
        process.env.NODE_ENV === "production"
          ? [
              { emit: "event", level: "error" },
              { emit: "event", level: "warn" },
            ]
          : [
              { emit: "event", level: "error" },
              { emit: "event", level: "warn" },
              { emit: "event", level: "query" },
            ],
    });
  }

  async onModuleInit() {
    // Wire Prisma events to structured logger
    (this as any).$on("error", (e: Prisma.LogEvent) => {
      this.logger.error(`DB error: ${e.message}`, undefined, "Prisma");
    });

    (this as any).$on("warn", (e: Prisma.LogEvent) => {
      this.logger.warn(`DB warning: ${e.message}`, "Prisma");
    });

    if (process.env.NODE_ENV !== "production") {
      (this as any).$on("query", (e: Prisma.QueryEvent) => {
        if (e.duration > 500) {
          this.logger.warn(
            `Slow query detected (${e.duration}ms)`,
            "Prisma",
          );
        }
      });
    }

    try {
      await this.$connect();
      this.logger.log("Database connection established", "Prisma");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Database connection failed: ${msg}`, undefined, "Prisma");
      throw err;
    }
  }

  async onModuleDestroy() {
    this.logger.log("Disconnecting from database", "Prisma");
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    process.once("beforeExit", async () => {
      await app.close();
    });
  }
}
