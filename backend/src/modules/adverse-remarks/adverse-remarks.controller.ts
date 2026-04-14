import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { Request } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { AdverseRemarksService } from "./adverse-remarks.service";
import { CreateAdverseRemarkDto } from "./dto/create-adverse-remark.dto";
import { SubmitRepresentationDto } from "./dto/submit-representation.dto";
import { DecideRepresentationDto } from "./dto/decide-representation.dto";

@Controller("acrs/:acrId/adverse-remarks")
@UseGuards(JwtAuthGuard)
export class AdverseRemarksController {
  constructor(private readonly adverseRemarksService: AdverseRemarksService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Param("acrId") acrId: string) {
    return this.adverseRemarksService.listByAcr(user.id, user.activeRole, acrId);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param("acrId") acrId: string,
    @Body() dto: CreateAdverseRemarkDto,
    @Req() req: Request,
  ) {
    return this.adverseRemarksService.createRemark(
      user.id,
      user.activeRole,
      acrId,
      dto.remarkText,
      dto.counsellingDate,
      dto.counsellingNotes,
      req.ip,
    );
  }

  @Patch(":remarkId/endorse")
  endorse(
    @CurrentUser() user: AuthenticatedUser,
    @Param("remarkId") remarkId: string,
    @Req() req: Request,
  ) {
    return this.adverseRemarksService.endorseRemark(user.id, user.activeRole, remarkId, req.ip);
  }

  @Patch(":remarkId/communicate")
  communicate(
    @CurrentUser() user: AuthenticatedUser,
    @Param("remarkId") remarkId: string,
    @Req() req: Request,
  ) {
    return this.adverseRemarksService.communicateRemark(user.id, user.activeRole, remarkId, req.ip);
  }

  @Patch(":remarkId/acknowledge")
  acknowledge(
    @CurrentUser() user: AuthenticatedUser,
    @Param("remarkId") remarkId: string,
    @Req() req: Request,
  ) {
    return this.adverseRemarksService.acknowledgeRemark(user.id, user.activeRole, remarkId, req.ip);
  }

  @Post(":remarkId/representation")
  submitRepresentation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("remarkId") remarkId: string,
    @Body() dto: SubmitRepresentationDto,
    @Req() req: Request,
  ) {
    return this.adverseRemarksService.submitRepresentation(
      user.id,
      user.activeRole,
      remarkId,
      dto.representationText,
      req.ip,
    );
  }

  @Patch(":remarkId/decide")
  decideRepresentation(
    @CurrentUser() user: AuthenticatedUser,
    @Param("remarkId") remarkId: string,
    @Body() dto: DecideRepresentationDto,
    @Req() req: Request,
  ) {
    return this.adverseRemarksService.decideRepresentation(
      user.id,
      user.activeRole,
      remarkId,
      dto.decision,
      dto.decisionNotes,
      req.ip,
    );
  }
}
