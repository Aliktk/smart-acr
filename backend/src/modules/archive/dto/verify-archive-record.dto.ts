import { IsOptional, IsString, MaxLength } from "class-validator";

export class VerifyArchiveRecordDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  remarks?: string;
}
