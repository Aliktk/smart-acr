import { IsEnum, IsOptional, IsString } from "class-validator";
import { EmployeeStatus } from "@prisma/client";

export class UpdateEmployeeStatusDto {
  @IsEnum(EmployeeStatus)
  status: EmployeeStatus;

  @IsOptional()
  @IsString()
  retirementDate?: string;
}
