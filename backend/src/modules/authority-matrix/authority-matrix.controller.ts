import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { AuthorityMatrixService } from "./authority-matrix.service";
import { CreateAuthorityRuleDto } from "./dto/create-authority-rule.dto";

@Controller("authority-matrix")
@UseGuards(JwtAuthGuard)
export class AuthorityMatrixController {
  constructor(private readonly authorityMatrixService: AuthorityMatrixService) {}

  @Get("resolve/:employeeId")
  resolve(@Param("employeeId") employeeId: string) {
    return this.authorityMatrixService.resolveAuthority(employeeId);
  }

  @Get("validate")
  validate(
    @Query("employeeId") employeeId: string,
    @Query("reportingOfficerId") reportingOfficerId: string,
    @Query("countersigningOfficerId") countersigningOfficerId?: string,
  ) {
    return this.authorityMatrixService.validateAssignment(
      employeeId,
      reportingOfficerId,
      countersigningOfficerId ?? null,
    );
  }

  @Get("rules")
  listRules(
    @Query("unitType") unitType?: string,
    @Query("wingCode") wingCode?: string,
    @Query("isActive") isActive?: string,
  ) {
    return this.authorityMatrixService.listRules({
      unitType,
      wingCode,
      isActive: isActive === undefined ? undefined : isActive === "true",
    });
  }

  @Post("rules")
  createRule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAuthorityRuleDto,
  ) {
    return this.authorityMatrixService.upsertRule(user.id, user.activeRole, {
      unitType: dto.unitType,
      wingCode: dto.wingCode,
      unitCode: dto.unitCode,
      postTitle: dto.postTitle,
      bpsMin: dto.bpsMin,
      bpsMax: dto.bpsMax,
      templateFamily: dto.templateFamily,
      reportingAuthorityTitle: dto.reportingAuthorityTitle,
      countersigningAuthorityTitle: dto.countersigningAuthorityTitle,
      priority: dto.priority,
      isActive: dto.isActive,
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : undefined,
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
    });
  }
}
