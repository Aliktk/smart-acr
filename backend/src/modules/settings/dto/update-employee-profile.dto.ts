import { DeputationType, EducationLevel, Gender, LanguageProficiencyLevel } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { LanguageProficiencyDto, TrainingCourseDto } from "../../employees/dto/create-employee.dto";

export class UpdateEmployeeProfileDto {
  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsDateString()
  joiningDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  fatherName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  spouseName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  mobile?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  basicPay?: number;

  @IsOptional()
  @IsDateString()
  appointmentToBpsDate?: string;

  @IsOptional()
  @IsEnum(EducationLevel)
  educationLevel?: EducationLevel;

  @IsOptional()
  @IsString()
  qualifications?: string;

  @IsOptional()
  @IsEnum(DeputationType)
  deputationType?: DeputationType;

  @IsOptional()
  @IsString()
  natureOfDuties?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  personnelNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  serviceGroup?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  licenseType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  vehicleType?: string;

  @IsOptional()
  @IsString()
  trainingCoursesText?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TrainingCourseDto)
  trainingCourses?: TrainingCourseDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => LanguageProficiencyDto)
  languages?: LanguageProficiencyDto[];
}

export type { EducationLevel, LanguageProficiencyLevel, Gender, DeputationType };
