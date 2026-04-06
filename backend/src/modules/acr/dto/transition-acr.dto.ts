import { IsIn, IsObject, IsOptional, IsString } from "class-validator";
import type { AcrAction } from "../../workflow/workflow.service";

export class TransitionAcrDto {
  @IsIn(["save_draft", "submit_to_reporting", "forward_to_countersigning", "submit_to_secret_branch", "return_to_clerk"])
  action!: AcrAction;

  @IsOptional()
  @IsString()
  remarks?: string;

  @IsOptional()
  @IsObject()
  formData?: Record<string, unknown>;
}
