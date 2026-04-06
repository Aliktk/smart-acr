import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AnalyticsService } from "./analytics.service";
import { DashboardAnalyticsQueryDto } from "./dto/dashboard-analytics-query.dto";

@Controller("analytics")
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("leadership")
  leadership(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.leadership(user.id, user.activeRole);
  }

  @Get("dashboard")
  dashboard(@CurrentUser() user: AuthenticatedUser, @Query() query: DashboardAnalyticsQueryDto) {
    return this.analyticsService.dashboard(user.id, user.activeRole, query);
  }
}
