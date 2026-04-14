import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { HealthController } from "./health.controller";
import { MetricsController } from "./metrics.controller";
import { RequestContextMiddleware } from "../../common/request-context.middleware";
import { MetricsMiddleware } from "../../common/metrics.middleware";

@Module({
  controllers: [HealthController, MetricsController],
})
export class HealthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // RequestContextMiddleware must come first so requestId is available
    consumer.apply(RequestContextMiddleware, MetricsMiddleware).forRoutes("*");
  }
}
