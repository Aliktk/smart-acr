import { Body, Controller, Get, Ip, Post, Req, Res, UseGuards } from "@nestjs/common";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import type { AuthenticatedUser } from "../../@types/authenticated-user.interface";
import { LoginDto } from "./dto/login.dto";
import { RequestPasswordResetDto } from "./dto/request-password-reset.dto";
import { ResetPasswordWithTokenDto } from "./dto/reset-password-with-token.dto";
import { RequestAuthChallengeDto } from "./dto/request-auth-challenge.dto";
import { ResendAuthChallengeDto } from "./dto/resend-auth-challenge.dto";
import { SwitchRoleDto } from "./dto/switch-role.dto";
import { VerifyAuthChallengeDto } from "./dto/verify-auth-challenge.dto";
import { AuthService } from "./auth.service";

@Controller("auth")
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ short: { ttl: 1000, limit: 3 }, medium: { ttl: 60000, limit: 10 } })
  @Post("challenge")
  requestChallenge(
    @Body() dto: RequestAuthChallengeDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
    @Ip() ipAddress: string,
  ) {
    return this.authService.requestChallenge(dto.username, dto.password, response, ipAddress, request.headers["user-agent"]);
  }

  @Throttle({ short: { ttl: 1000, limit: 3 }, medium: { ttl: 60000, limit: 10 } })
  @Post("verify")
  verifyChallenge(
    @Body() dto: VerifyAuthChallengeDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
    @Ip() ipAddress: string,
  ) {
    return this.authService.verifyChallenge(dto.challengeId, dto.code, response, ipAddress, request.headers["user-agent"]);
  }

  @Throttle({ short: { ttl: 1000, limit: 3 }, medium: { ttl: 60000, limit: 10 } })
  @Post("challenge/resend")
  resendChallenge(@Body() dto: ResendAuthChallengeDto) {
    return this.authService.resendChallenge(dto.challengeId);
  }

  @Throttle({ short: { ttl: 1000, limit: 3 }, medium: { ttl: 60000, limit: 10 } })
  @Post("login")
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request,
    @Ip() ipAddress: string,
  ) {
    return this.authService.login(dto.username, dto.password, response, ipAddress, request.headers["user-agent"]);
  }

  @Throttle({ short: { ttl: 1000, limit: 2 }, medium: { ttl: 60000, limit: 5 } })
  @Post("forgot-password/request")
  requestPasswordReset(@Body() dto: RequestPasswordResetDto, @Ip() ipAddress: string) {
    return this.authService.requestPasswordReset(dto.identifier, ipAddress);
  }

  @Throttle({ short: { ttl: 1000, limit: 2 }, medium: { ttl: 60000, limit: 5 } })
  @Post("forgot-password/reset")
  resetPasswordWithToken(@Body() dto: ResetPasswordWithTokenDto, @Ip() ipAddress: string) {
    return this.authService.completePasswordReset(dto.token, dto.nextPassword, ipAddress);
  }

  @Throttle({ short: { ttl: 1000, limit: 5 }, medium: { ttl: 60000, limit: 20 } })
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
