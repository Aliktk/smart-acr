import { Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { NotificationType } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query("type") type?: NotificationType,
    @Query("read") read?: "read" | "unread" | "all",
    @Query("linked") linked?: "linked" | "system" | "all",
    @Query("query") query?: string,
  ) {
    return this.notificationsService.list(user.id, { type, read, linked, query });
  }

  @Post("read-all")
  markAllRead(@CurrentUser() user: AuthenticatedUser) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Post(":id/read")
  markRead(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Delete(":id")
  dismiss(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.notificationsService.dismiss(user.id, id);
  }
}
