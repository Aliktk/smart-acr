import { ArrayMinSize, ArrayUnique, IsArray, IsBoolean, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { UserRole } from "@prisma/client";
import { UserScopeDto } from "./user-scope.dto";

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

  @IsString()
  @MinLength(8)
  @MaxLength(128)
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
}
