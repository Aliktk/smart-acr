import { IsEnum, IsOptional, IsString } from "class-validator";
import { ArchiveRecordSource, OrgScopeTrack, TemplateFamilyCode } from "@prisma/client";

export class ListArchiveRecordsDto {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsEnum(ArchiveRecordSource)
  source?: ArchiveRecordSource;

  @IsOptional()
  @IsEnum(TemplateFamilyCode)
  templateFamily?: TemplateFamilyCode;

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
}
