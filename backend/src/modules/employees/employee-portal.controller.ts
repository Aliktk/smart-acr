import { Body, Controller, Get, Ip, Param, Patch, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { AcrService } from "../acr/acr.service";
import { EmployeesService } from "./employees.service";
import { UpdateEmployeePortalProfileDto } from "./dto/update-employee-portal-profile.dto";

@Controller("employee")
@UseGuards(JwtAuthGuard)
export class EmployeePortalController {
  constructor(
    private readonly employeesService: EmployeesService,
    private readonly acrService: AcrService,
  ) {}

  @Get("profile")
  profile(@CurrentUser() user: AuthenticatedUser) {
    return this.employeesService.getPortalProfile(user.id, user.activeRole);
  }

  @Patch("profile")
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateEmployeePortalProfileDto, @Ip() ipAddress?: string) {
    return this.employeesService.updatePortalProfile(user.id, user.activeRole, dto, ipAddress);
  }

  @Get("acrs")
  listAcrs(@CurrentUser() user: AuthenticatedUser) {
    return this.acrService.list(user.id, user.activeRole);
  }

  @Get("acrs/:id")
  detail(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.acrService.detail(user.id, user.activeRole, id);
  }
}
