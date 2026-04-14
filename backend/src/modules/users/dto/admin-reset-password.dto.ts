import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class AdminResetPasswordDto {
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{}|;:,.<>?])/, {
    message: "Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character.",
  })
  nextPassword!: string;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}
