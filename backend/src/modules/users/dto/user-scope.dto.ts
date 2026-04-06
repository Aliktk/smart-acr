import { IsOptional, IsString } from "class-validator";

export class UserScopeDto {
  @IsOptional()
  @IsString()
  wingId?: string;

  @IsOptional()
  @IsString()
  zoneId?: string;

  @IsOptional()
  @IsString()
  officeId?: string;

  @IsOptional()
  @IsString()
  departmentName?: string;
}
