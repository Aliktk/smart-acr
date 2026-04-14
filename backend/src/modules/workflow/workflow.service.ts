import { BadRequestException, Injectable } from "@nestjs/common";
import { AcrWorkflowState, TemplateFamilyCode } from "@prisma/client";
import { templateFamilyRequiresCountersigning } from "../../common/template-catalog";

export type AcrAction =
  | "save_draft"
  | "forward_to_admin_office"
  | "admin_forward_to_piab"
  | "intake_accept"
  | "intake_return"
  | "resubmit_after_rectification"
  | "submit_to_reporting"
  | "forward_to_countersigning"
  | "submit_to_secret_branch"
  | "complete_secret_branch_review"
  | "verify_secret_branch"
  | "return_to_clerk"
  | "return_to_reporting"
  | "return_to_countersigning";

type WorkflowTransition = {
  workflowState: AcrWorkflowState;
  statusLabel: string;
};

@Injectable()
export class WorkflowService {
  canTransition(state: AcrWorkflowState, action: AcrAction, templateFamily: TemplateFamilyCode) {
    const requiresCountersigning = templateFamilyRequiresCountersigning(templateFamily);
    const transitions: Record<AcrWorkflowState, AcrAction[]> = {
      DRAFT: ["save_draft", "forward_to_admin_office", "submit_to_reporting"],
      PENDING_ADMIN_FORWARDING: ["admin_forward_to_piab", "return_to_clerk"],
      PENDING_SECRET_CELL_INTAKE: ["intake_accept", "intake_return"],
      PENDING_REPORTING:
        !requiresCountersigning
          ? ["submit_to_secret_branch", "return_to_clerk"]
          : ["forward_to_countersigning", "return_to_clerk"],
      PENDING_COUNTERSIGNING: ["submit_to_secret_branch", "return_to_clerk", "return_to_reporting"],
      PENDING_SECRET_BRANCH_REVIEW: [
        "complete_secret_branch_review",
        "return_to_clerk",
        "return_to_reporting",
        "return_to_countersigning",
      ],
      PENDING_SECRET_BRANCH_VERIFICATION: [
        "verify_secret_branch",
        "return_to_clerk",
        "return_to_reporting",
        "return_to_countersigning",
      ],
      RETURNED_TO_CLERK: ["save_draft", "forward_to_admin_office", "submit_to_reporting"],
      RETURNED_TO_REPORTING:
        !requiresCountersigning
          ? ["submit_to_secret_branch", "return_to_clerk"]
          : ["forward_to_countersigning", "return_to_clerk"],
      RETURNED_TO_COUNTERSIGNING: ["submit_to_secret_branch", "return_to_clerk", "return_to_reporting"],
      RETURNED_TO_ADMIN_OFFICE: ["resubmit_after_rectification", "return_to_clerk"],
      ARCHIVED: [],
    };

    return transitions[state].includes(action);
  }

  assertTransition(state: AcrWorkflowState, action: AcrAction, templateFamily: TemplateFamilyCode) {
    if (!this.canTransition(state, action, templateFamily)) {
      throw new BadRequestException(`Action '${action}' is not allowed from state '${state}'.`);
    }
  }

  nextStateForAction(action: AcrAction, templateFamily: TemplateFamilyCode): WorkflowTransition {
    switch (action) {
      case "save_draft":
        return { workflowState: AcrWorkflowState.DRAFT, statusLabel: "Draft" };
      case "forward_to_admin_office":
        return { workflowState: AcrWorkflowState.PENDING_ADMIN_FORWARDING, statusLabel: "Pending Admin Office Forwarding" };
      case "admin_forward_to_piab":
        return { workflowState: AcrWorkflowState.PENDING_SECRET_CELL_INTAKE, statusLabel: "Pending Secret Cell Intake" };
      case "intake_accept":
        return { workflowState: AcrWorkflowState.PENDING_REPORTING, statusLabel: "Pending Reporting Officer" };
      case "intake_return":
        return { workflowState: AcrWorkflowState.RETURNED_TO_ADMIN_OFFICE, statusLabel: "Returned to Admin Office" };
      case "resubmit_after_rectification":
        return { workflowState: AcrWorkflowState.PENDING_SECRET_CELL_INTAKE, statusLabel: "Pending Secret Cell Intake" };
      case "submit_to_reporting":
        return { workflowState: AcrWorkflowState.PENDING_REPORTING, statusLabel: "Pending Reporting Officer" };
      case "forward_to_countersigning":
        if (!templateFamilyRequiresCountersigning(templateFamily)) {
          return { workflowState: AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW, statusLabel: "Pending Secret Branch Review" };
        }
        return { workflowState: AcrWorkflowState.PENDING_COUNTERSIGNING, statusLabel: "Pending Countersigning Officer" };
      case "submit_to_secret_branch":
        return { workflowState: AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW, statusLabel: "Pending Secret Branch Review" };
      case "complete_secret_branch_review":
        return { workflowState: AcrWorkflowState.PENDING_SECRET_BRANCH_VERIFICATION, statusLabel: "Pending Secret Branch Verification" };
      case "verify_secret_branch":
        return { workflowState: AcrWorkflowState.ARCHIVED, statusLabel: "Archived" };
      case "return_to_clerk":
        return { workflowState: AcrWorkflowState.RETURNED_TO_CLERK, statusLabel: "Returned to Clerk" };
      case "return_to_reporting":
        return { workflowState: AcrWorkflowState.RETURNED_TO_REPORTING, statusLabel: "Returned to Reporting Officer" };
      case "return_to_countersigning":
        return { workflowState: AcrWorkflowState.RETURNED_TO_COUNTERSIGNING, statusLabel: "Returned to Countersigning Officer" };
      default:
        return { workflowState: AcrWorkflowState.DRAFT, statusLabel: "Draft" };
    }
  }

  getDueDate(baseDate: Date, stageDays: number) {
    return new Date(baseDate.getTime() + stageDays * 24 * 60 * 60 * 1000);
  }

  isReturnedState(state: AcrWorkflowState) {
    return state === AcrWorkflowState.RETURNED_TO_CLERK
      || state === AcrWorkflowState.RETURNED_TO_REPORTING
      || state === AcrWorkflowState.RETURNED_TO_COUNTERSIGNING
      || state === AcrWorkflowState.RETURNED_TO_ADMIN_OFFICE;
  }

  isSecretBranchState(state: AcrWorkflowState) {
    return state === AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW
      || state === AcrWorkflowState.PENDING_SECRET_BRANCH_VERIFICATION
      || state === AcrWorkflowState.ARCHIVED;
  }

  isOverdue(dueDate: Date, state: AcrWorkflowState) {
    if (state === AcrWorkflowState.ARCHIVED || this.isReturnedState(state)) {
      return false;
    }

    return dueDate.getTime() < Date.now();
  }

  overdueDays(dueDate: Date) {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / msPerDay));
  }
}
