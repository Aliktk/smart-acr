import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from "class-validator";
import { TemplateFamilyCode } from "@prisma/client";

export class CreateAuthorityRuleDto {
  @IsString()
  @MinLength(1)
  unitType: string;

  @IsOptional()
  @IsString()
  wingCode?: string;

  @IsOptional()
  @IsString()
  unitCode?: string;

  @IsString()
  @MinLength(1)
  postTitle: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  bpsMin?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  bpsMax?: number;

  @IsOptional()
  @IsEnum(TemplateFamilyCode)
  templateFamily?: TemplateFamilyCode;

  @IsString()
  @MinLength(1)
  reportingAuthorityTitle: string;

  @IsOptional()
  @IsString()
  countersigningAuthorityTitle?: string;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;
}
