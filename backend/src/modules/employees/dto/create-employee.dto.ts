import { DeputationType, DisciplinaryRecordType, EducationLevel, Gender, LanguageProficiencyLevel, RewardType, TemplateFamilyCode } from "@prisma/client";
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

export class TrainingCourseDto {
  @IsNotEmpty()
  @IsString()
  courseName!: string;

  @IsOptional()
  @IsDateString()
  durationFrom?: string;

  @IsOptional()
  @IsDateString()
  durationTo?: string;

  @IsOptional()
  @IsString()
  institution?: string;

  @IsOptional()
  @IsString()
  country?: string;
}

export class DisciplinaryRecordDto {
  @IsEnum(DisciplinaryRecordType)
  type!: DisciplinaryRecordType;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsOptional()
  @IsInt()
  year?: number;

  @IsOptional()
  @IsString()
  outcome?: string;

  @IsOptional()
  @IsDateString()
  awardedDate?: string;
}

export class RewardDto {
  @IsEnum(RewardType)
  type!: RewardType;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsOptional()
  @IsDateString()
  awardedDate?: string;

  @IsOptional()
  @IsString()
  awardedBy?: string;
}

export class LanguageProficiencyDto {
  @IsNotEmpty()
  @IsString()
  language!: string;

  @IsEnum(LanguageProficiencyLevel)
  speaking!: LanguageProficiencyLevel;

  @IsEnum(LanguageProficiencyLevel)
  reading!: LanguageProficiencyLevel;

  @IsEnum(LanguageProficiencyLevel)
  writing!: LanguageProficiencyLevel;
}

export class CreateEmployeeDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsNotEmpty()
  @IsString()
  name!: string;

  @IsNotEmpty()
  @IsString()
  rank!: string;

  @IsNotEmpty()
  @IsString()
  designation!: string;

  @IsInt()
  @Min(1)
  @Max(22)
  bps!: number;

  @IsString()
  @Length(13, 15)
  cnic!: string;

  @IsNotEmpty()
  @IsString()
  mobile!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsNotEmpty()
  @IsString()
  posting!: string;

  @IsDateString()
  joiningDate!: string;

  @IsNotEmpty()
  @IsString()
  address!: string;

  @IsEnum(TemplateFamilyCode)
  templateFamily!: TemplateFamilyCode;

  @IsNotEmpty()
  @IsString()
  officeId!: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsNotEmpty()
  @IsString()
  reportingOfficerId!: string;

  @IsOptional()
  @IsString()
  countersigningOfficerId?: string;

  // --- optional metadata fields ---

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
