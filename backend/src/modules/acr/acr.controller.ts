import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { CreateAcrDto } from "./dto/create-acr.dto";
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
    @Query("status") status?: string,
    @Query("priority") priority?: string,
    @Query("query") query?: string,
  ) {
    return this.acrService.list(user.id, user.activeRole, status, priority, query);
  }

  @Get(":id")
  detail(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.acrService.detail(user.id, user.activeRole, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateAcrDto) {
    return this.acrService.create(user.id, user.activeRole, dto);
  }

  @Patch(":id/form-data")
  updateFormData(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: UpdateAcrFormDataDto) {
    return this.acrService.updateFormData(user.id, user.activeRole, id, dto.formData);
  }

  @Post(":id/transition")
  transition(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Body() dto: TransitionAcrDto) {
    return this.acrService.transition(user.id, user.activeRole, id, dto.action, dto.remarks);
  }
}
