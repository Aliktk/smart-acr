import { IsOptional, IsString, MaxLength } from "class-validator";
import { Transform } from "class-transformer";

export class ListAcrDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @IsOptional()
  @Transform(({ value }) => value === "true")
  priority?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  query?: string;
}
