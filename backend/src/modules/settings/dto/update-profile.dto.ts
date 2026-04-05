import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class UpdateProfileDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  displayName!: string;

  @IsEmail()
  @MaxLength(160)
  email!: string;
}
