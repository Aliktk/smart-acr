import { IsString, MinLength } from "class-validator";

export class RequestAuthChallengeDto {
  @IsString()
  username!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
