import { IsBoolean, IsDateString, IsObject, IsOptional, IsString } from "class-validator";

export class CreateAcrDto {
  @IsString()
  employeeId!: string;

  @IsDateString()
  reportingPeriodFrom!: string;

  @IsDateString()
  reportingPeriodTo!: string;

  @IsOptional()
  @IsBoolean()
  isPriority?: boolean;

  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;
}
