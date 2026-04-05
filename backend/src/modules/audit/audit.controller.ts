import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuditService } from "./audit.service";

@Controller("audit")
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
    @Query("action") action?: string,
    @Query("actorRole") actorRole?: string,
    @Query("actorName") actorName?: string,
    @Query("recordQuery") recordQuery?: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("module") module?: "ACR" | "Authentication" | "Settings" | "Administration" | "System",
    @Query("eventType") eventType?: "create" | "update" | "transition" | "archive" | "authentication" | "system",
  ) {
    return this.auditService.list(user.id, user.activeRole, {
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
      action,
      actorRole,
      actorName,
      recordQuery,
      dateFrom,
      dateTo,
      module,
      eventType,
    });
  }
}
