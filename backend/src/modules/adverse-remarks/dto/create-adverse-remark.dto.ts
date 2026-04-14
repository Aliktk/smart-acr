import { IsDateString, IsOptional, IsString, MinLength } from "class-validator";

export class CreateAdverseRemarkDto {
  @IsString()
  @MinLength(5)
  remarkText: string;

  @IsOptional()
  @IsDateString()
  counsellingDate?: string;

  @IsOptional()
  @IsString()
  counsellingNotes?: string;
}
