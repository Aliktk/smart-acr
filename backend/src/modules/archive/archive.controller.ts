import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { ArchiveService } from "./archive.service";

@Controller("archive")
@UseGuards(JwtAuthGuard)
export class ArchiveController {
  constructor(private readonly archiveService: ArchiveService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.archiveService.list(user.id, user.activeRole);
  }
}
