import { Body, Controller, Get, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { EmployeesService } from "./employees.service";

@Controller("employees")
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  search(@CurrentUser() user: AuthenticatedUser, @Query("query") query?: string) {
    return this.employeesService.search(user.id, user.activeRole, query);
  }

  @Get("manual-options")
  manualOptions(@CurrentUser() user: AuthenticatedUser, @Query("officeId") officeId?: string) {
    return this.employeesService.manualOptions(user.id, user.activeRole, officeId);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(user.id, user.activeRole, dto);
  }
}
