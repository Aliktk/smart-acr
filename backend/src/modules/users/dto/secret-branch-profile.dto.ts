import { IsBoolean, IsEnum, IsOptional } from "class-validator";
import { SecretBranchDeskCode } from "@prisma/client";

export class SecretBranchProfileDto {
  @IsOptional()
  @IsEnum(SecretBranchDeskCode)
  deskCode?: SecretBranchDeskCode;

  @IsOptional()
  @IsBoolean()
  canManageUsers?: boolean;

  @IsOptional()
  @IsBoolean()
  canVerify?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
