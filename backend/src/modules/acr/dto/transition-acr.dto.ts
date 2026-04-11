import { IsEnum, IsIn, IsObject, IsOptional, IsString, MaxLength } from "class-validator";
import { SecretBranchDeskCode } from "@prisma/client";
import type { AcrAction } from "../../workflow/workflow.service";

export class TransitionAcrDto {
  @IsIn([
    "save_draft",
    "forward_to_admin_office",
    "admin_forward_to_piab",
    "intake_accept",
    "intake_return",
    "resubmit_after_rectification",
    "submit_to_reporting",
    "forward_to_countersigning",
    "submit_to_secret_branch",
    "complete_secret_branch_review",
    "verify_secret_branch",
    "return_to_clerk",
    "return_to_reporting",
    "return_to_countersigning",
  ])
  action!: AcrAction;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  remarks?: string;

  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;

  @IsOptional()
  @IsEnum(SecretBranchDeskCode)
  targetDeskCode?: SecretBranchDeskCode;
}
