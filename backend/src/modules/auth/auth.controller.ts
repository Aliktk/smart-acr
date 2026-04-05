import { Body, Controller, Get, Ip, Post, Req, Res, UseGuards } from "@nestjs/common";
import type { Request, Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { LoginDto } from "./dto/login.dto";
import { RequestAuthChallengeDto } from "./dto/request-auth-challenge.dto";
import { ResendAuthChallengeDto } from "./dto/resend-auth-challenge.dto";
import { SwitchRoleDto } from "./dto/switch-role.dto";
import { VerifyAuthChallengeDto } from "./dto/verify-auth-challenge.dto";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("challenge")
  requestChallenge(
    @Body() dto: RequestAuthChallengeDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
    @Ip() ipAddress: string,
  ) {
    return this.authService.requestChallenge(dto.username, dto.password, response, ipAddress, request.headers["user-agent"]);
  }

  @Post("verify")
  verifyChallenge(
    @Body() dto: VerifyAuthChallengeDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
    @Ip() ipAddress: string,
  ) {
    return this.authService.verifyChallenge(dto.challengeId, dto.code, response, ipAddress, request.headers["user-agent"]);
  }

  @Post("challenge/resend")
  resendChallenge(@Body() dto: ResendAuthChallengeDto) {
    return this.authService.resendChallenge(dto.challengeId);
  }

  @Post("login")
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
    @Ip() ipAddress: string,
  ) {
    return this.authService.login(dto.username, dto.password, response, ipAddress, request.headers["user-agent"]);
  }

  @Post("refresh")
  refresh(@Res({ passthrough: true }) response: Response) {
    return this.authService.refreshSession(response);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getSessionUser(user.id, user.activeRole);
  }

  @UseGuards(JwtAuthGuard)
  @Post("switch-role")
  switchRole(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SwitchRoleDto,
    @Res({ passthrough: true }) response: Response,
    @Ip() ipAddress: string,
  ) {
    return this.authService.switchRole(user.id, user.sessionId, dto.role, response, ipAddress);
  }

  @UseGuards(JwtAuthGuard)
  @Post("logout")
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
    @Ip() ipAddress: string,
  ) {
    return this.authService.logout(user.id, user.sessionId, user.activeRole, response, ipAddress);
  }
}
