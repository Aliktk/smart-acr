import { Body, Controller, Get, Ip, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RolesGuard } from "../../common/guards/roles.guard";
import { UsersService } from "./users.service";
import { ListUsersDto } from "./dto/list-users.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { AdminResetPasswordDto } from "./dto/admin-reset-password.dto";

@Controller("users")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.SECRET_BRANCH)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: ListUsersDto) {
    return this.usersService.list(user.id, user.activeRole, query);
  }

  @Get("options")
  options(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.options(user.id, user.activeRole);
  }

  @Get(":id")
  detail(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.usersService.detail(user.id, user.activeRole, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto, @Ip() ipAddress: string) {
    return this.usersService.create(user.id, user.activeRole, dto, ipAddress);
  }

  @Patch(":id")
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
    @Ip() ipAddress: string,
  ) {
    return this.usersService.update(user.id, user.activeRole, id, dto, ipAddress);
  }

  @Post(":id/reset-password")
  resetPassword(
    @CurrentUser() user: AuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: AdminResetPasswordDto,
    @Ip() ipAddress: string,
  ) {
    return this.usersService.resetPassword(user.id, user.activeRole, id, dto, ipAddress);
  }

  @Post(":id/deactivate")
  deactivate(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Ip() ipAddress: string) {
    return this.usersService.deactivate(user.id, user.activeRole, id, ipAddress);
  }

  @Post(":id/reactivate")
  reactivate(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string, @Ip() ipAddress: string) {
    return this.usersService.reactivate(user.id, user.activeRole, id, ipAddress);
  }
}
