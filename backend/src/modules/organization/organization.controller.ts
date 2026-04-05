import { Controller, Get, UseGuards } from "@nestjs/common";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { OrganizationService } from "./organization.service";

@Controller("organization")
@UseGuards(JwtAuthGuard)
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Get("summary")
  summary(@CurrentUser() user: AuthenticatedUser) {
    return this.organizationService.summary(user.id, user.activeRole);
  }
}
