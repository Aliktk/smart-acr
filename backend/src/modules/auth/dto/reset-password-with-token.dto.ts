import { IsString, MinLength } from "class-validator";

export class ResetPasswordWithTokenDto {
  @IsString()
  token!: string;

  @IsString()
  @MinLength(8)
  nextPassword!: string;
}
