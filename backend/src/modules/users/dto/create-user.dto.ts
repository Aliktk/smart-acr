import { ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { UserRole } from "@prisma/client";
import { UserScopeDto } from "./user-scope.dto";
import { SecretBranchProfileDto } from "./secret-branch-profile.dto";

export class CreateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  fullName!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(60)
  username!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(60)
  badgeNo!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobileNumber?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{5}-\d{7}-\d$/, { message: "CNIC must be in 12345-1234567-1 format." })
  cnic?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  positionTitle?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?])/, {
    message: "Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character.",
  })
  temporaryPassword!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsEnum(UserRole, { each: true })
  roles!: UserRole[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;

  @ValidateNested()
  @Type(() => UserScopeDto)
  scope!: UserScopeDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SecretBranchProfileDto)
  secretBranchProfile?: SecretBranchProfileDto;
}
