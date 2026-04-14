import { OrgScopeTrack } from "@prisma/client";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class UserScopeDto {
  @IsOptional()
  @IsEnum(OrgScopeTrack)
  scopeTrack?: OrgScopeTrack;

  @IsOptional()
  @IsString()
  wingId?: string;

  @IsOptional()
  @IsString()
  directorateId?: string;

  @IsOptional()
  @IsString()
  regionId?: string;

  @IsOptional()
  @IsString()
  zoneId?: string;

  @IsOptional()
  @IsString()
  circleId?: string;

  @IsOptional()
  @IsString()
  stationId?: string;

  @IsOptional()
  @IsString()
  branchId?: string;

  @IsOptional()
  @IsString()
  cellId?: string;

  @IsOptional()
  @IsString()
  officeId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  departmentName?: string;
}
