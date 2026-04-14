import { IsString, MinLength } from "class-validator";

export class DecideRepresentationDto {
  @IsString()
  @MinLength(2)
  decision: string;

  @IsString()
  @MinLength(5)
  decisionNotes: string;
}
