import { IsEnum, IsOptional, IsString } from "class-validator";
import { OrgScopeTrack, TemplateFamilyCode } from "@prisma/client";

export const DASHBOARD_DATE_PRESETS = ["30d", "90d", "180d", "365d", "fy", "all"] as const;

export type DashboardDatePreset = (typeof DASHBOARD_DATE_PRESETS)[number];

export class DashboardAnalyticsQueryDto {
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
  status?: string;

  @IsOptional()
  @IsEnum(TemplateFamilyCode)
  templateFamily?: TemplateFamilyCode;

  @IsOptional()
  @IsEnum(DASHBOARD_DATE_PRESETS)
  datePreset?: DashboardDatePreset;

  @IsOptional()
  @IsEnum(OrgScopeTrack)
  scopeTrack?: OrgScopeTrack;
}
