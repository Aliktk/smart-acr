import { IsString, MinLength } from "class-validator";

export class SubmitRepresentationDto {
  @IsString()
  @MinLength(10)
  representationText: string;
}
