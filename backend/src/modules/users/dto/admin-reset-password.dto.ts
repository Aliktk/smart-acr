import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class AdminResetPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  nextPassword!: string;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}
