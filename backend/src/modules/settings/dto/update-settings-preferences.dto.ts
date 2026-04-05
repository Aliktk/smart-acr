import { Type } from "class-transformer";
import { IsBoolean, IsOptional, ValidateNested } from "class-validator";

export class NotificationPreferencesDto {
  @IsBoolean()
  acrSubmitted!: boolean;

  @IsBoolean()
  acrReturned!: boolean;

  @IsBoolean()
  overdueAlerts!: boolean;

  @IsBoolean()
  priorityAlerts!: boolean;

  @IsBoolean()
  systemUpdates!: boolean;

  @IsBoolean()
  weeklyDigest!: boolean;
}

export class DisplayPreferencesDto {
  @IsBoolean()
  compactSidebar!: boolean;

  @IsBoolean()
  denseTables!: boolean;

  @IsBoolean()
  reduceMotion!: boolean;
}

export class SecurityPreferencesDto {
  @IsBoolean()
  twoFactorEnabled!: boolean;
}

export class UpdateSettingsPreferencesDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notifications?: NotificationPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => DisplayPreferencesDto)
  display?: DisplayPreferencesDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SecurityPreferencesDto)
  security?: SecurityPreferencesDto;
}
