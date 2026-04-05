import { IsString } from "class-validator";

export class ResendAuthChallengeDto {
  @IsString()
  challengeId!: string;
}
