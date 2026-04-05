import { Controller, Get, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("leadership")
  leadership(@CurrentUser() user: AuthenticatedUser) {
    return this.analyticsService.leadership(user.id, user.activeRole);
  }
}
