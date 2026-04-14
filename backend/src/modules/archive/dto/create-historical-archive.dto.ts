import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { TemplateFamilyCode } from "@prisma/client";

export class CreateHistoricalArchiveDto {
  @IsString()
  employeeId!: string;

  @IsOptional()
  @IsEnum(TemplateFamilyCode)
  templateFamily?: TemplateFamilyCode;

  @IsOptional()
  @IsDateString()
  reportingPeriodFrom?: string;

  @IsOptional()
  @IsDateString()
  reportingPeriodTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  archiveReference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;
}
