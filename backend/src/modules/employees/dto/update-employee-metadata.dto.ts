import { DeputationType, DisciplinaryRecordType, EducationLevel, Gender, LanguageProficiencyLevel, RewardType } from "@prisma/client";
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { DisciplinaryRecordDto, LanguageProficiencyDto, RewardDto, TrainingCourseDto } from "./create-employee.dto";

export class UpdateEmployeeMetadataDto {
  @IsOptional()
  @IsString()
  userId?: string | null;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

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
  @IsString()
  fatherName?: string;

  @IsOptional()
  @IsString()
  spouseName?: string;

  @IsOptional()
  @IsEnum(DeputationType)
  deputationType?: DeputationType;

  @IsOptional()
  @IsString()
  natureOfDuties?: string;

  @IsOptional()
  @IsString()
  personnelNumber?: string;

  @IsOptional()
  @IsString()
  serviceGroup?: string;

  @IsOptional()
  @IsString()
  licenseType?: string;

  @IsOptional()
  @IsString()
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
  @Type(() => DisciplinaryRecordDto)
  disciplinaryRecords?: DisciplinaryRecordDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => RewardDto)
  rewards?: RewardDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => LanguageProficiencyDto)
  languages?: LanguageProficiencyDto[];
}

// Re-export sub-DTOs for use in controller/service
export type { DisciplinaryRecordType, EducationLevel, Gender, LanguageProficiencyLevel, RewardType };
