import { Transform } from "class-transformer";
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

function trimString({ value }: { value: unknown }) {
  return typeof value === "string" ? value.trim() : value;
}

export class UpdateEmployeePortalProfileDto {
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(7)
  @MaxLength(20)
  @Matches(/^[0-9+()\-\s]+$/, {
    message: "Mobile number can contain digits, spaces, and dialing symbols only.",
  })
  mobile?: string;

  @Transform(trimString)
  @IsOptional()
  @IsEmail()
  @MaxLength(160)
  email?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  posting?: string;

  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  address?: string;
}
