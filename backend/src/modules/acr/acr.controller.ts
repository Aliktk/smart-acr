import { Body, Controller, Get, Ip, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { CreateAcrDto } from "./dto/create-acr.dto";
import { ListAcrDto } from "./dto/list-acr.dto";
import { TransitionAcrDto } from "./dto/transition-acr.dto";
import { UpdateAcrFormDataDto } from "./dto/update-acr-form-data.dto";
import { AcrService } from "./acr.service";

@Controller("acrs")
@UseGuards(JwtAuthGuard)
export class AcrController {
  constructor(private readonly acrService: AcrService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() dto: ListAcrDto,
  ) {
    return this.acrService.list(user.id, user.activeRole, dto.status, dto.priority ? "true" : undefined, dto.query);
  }

  @Get(":id")
  detail(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.acrService.detail(user.id, user.activeRole, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Ip() ipAddress: string, @Body() dto: CreateAcrDto) {
    return this.acrService.create(user.id, user.activeRole, dto, ipAddress);
  }

  @Patch(":id/form-data")
  updateFormData(@CurrentUser() user: AuthenticatedUser, @Ip() ipAddress: string, @Param("id") id: string, @Body() dto: UpdateAcrFormDataDto) {
    return this.acrService.updateFormData(user.id, user.activeRole, id, dto.formData, ipAddress);
  }

  @Post(":id/transition")
  transition(@CurrentUser() user: AuthenticatedUser, @Ip() ipAddress: string, @Param("id") id: string, @Body() dto: TransitionAcrDto) {
    return this.acrService.transition(user.id, user.activeRole, id, dto.action, dto.remarks, dto.formData, ipAddress, dto.targetDeskCode);
  }
}
