import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import type { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { UpdateEmployeeMetadataDto } from "./dto/update-employee-metadata.dto";
import { UpdateEmployeeStatusDto } from "./dto/update-employee-status.dto";
import { EmployeesService } from "./employees.service";

class SearchEmployeesDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;
}

class ManualOptionsDto {
  @IsOptional()
  @IsString()
  officeId?: string;
}

@Controller("employees")
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  search(@CurrentUser() user: AuthenticatedUser, @Query() dto: SearchEmployeesDto) {
    return this.employeesService.search(user.id, user.activeRole, dto.query);
  }

  @Get("manual-options")
  manualOptions(@CurrentUser() user: AuthenticatedUser, @Query() dto: ManualOptionsDto) {
    return this.employeesService.manualOptions(user.id, user.activeRole, dto.officeId);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEmployeeDto) {
    return this.employeesService.create(user.id, user.activeRole, dto);
  }

  @Patch(":id/metadata")
  @UseGuards(RolesGuard)
  @Roles(UserRole.CLERK, UserRole.SUPER_ADMIN, UserRole.IT_OPS)
  updateMetadata(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeMetadataDto,
  ) {
    return this.employeesService.updateMetadata(user.id, user.activeRole, id, dto);
  }

  @Patch(":id/status")
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.IT_OPS)
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateEmployeeStatusDto,
    @Req() req: Request,
  ) {
    return this.employeesService.updateStatus(
      user.id,
      user.activeRole,
      id,
      dto.status,
      dto.retirementDate,
      req.ip,
    );
  }
}
