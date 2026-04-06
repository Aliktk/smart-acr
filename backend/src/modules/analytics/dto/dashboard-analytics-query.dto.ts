import { IsEnum, IsOptional, IsString } from "class-validator";
import { TemplateFamilyCode } from "@prisma/client";

export const DASHBOARD_DATE_PRESETS = ["30d", "90d", "180d", "365d", "fy", "all"] as const;

export type DashboardDatePreset = (typeof DASHBOARD_DATE_PRESETS)[number];

export class DashboardAnalyticsQueryDto {
  @IsOptional()
  @IsString()
  wingId?: string;

  @IsOptional()
  @IsString()
  zoneId?: string;

  @IsOptional()
  @IsString()
  officeId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsEnum(TemplateFamilyCode)
  templateFamily?: TemplateFamilyCode;

  @IsOptional()
  @IsEnum(DASHBOARD_DATE_PRESETS)
  datePreset?: DashboardDatePreset;
}
