import { TemplateFamilyCode } from "@prisma/client";
import { IsDateString, IsEmail, IsEnum, IsInt, IsOptional, IsString, Length, Max, Min } from "class-validator";

export class CreateEmployeeDto {
  @IsString()
  name!: string;

  @IsString()
  rank!: string;

  @IsString()
  designation!: string;

  @IsInt()
  @Min(1)
  @Max(16)
  bps!: number;

  @IsString()
  @Length(13, 15)
  cnic!: string;

  @IsString()
  mobile!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  posting!: string;

  @IsDateString()
  joiningDate!: string;

  @IsString()
  address!: string;

  @IsEnum(TemplateFamilyCode)
  templateFamily!: TemplateFamilyCode;

  @IsString()
  officeId!: string;

  @IsString()
  reportingOfficerId!: string;

  @IsOptional()
  @IsString()
  countersigningOfficerId?: string;
}
