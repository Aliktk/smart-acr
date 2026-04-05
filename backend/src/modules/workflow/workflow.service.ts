import { BadRequestException, Injectable } from "@nestjs/common";
import { AcrWorkflowState, TemplateFamilyCode } from "@prisma/client";

export type AcrAction =
  | "save_draft"
  | "submit_to_reporting"
  | "forward_to_countersigning"
  | "submit_to_secret_branch"
  | "return_to_clerk";

@Injectable()
export class WorkflowService {
  canTransition(state: AcrWorkflowState, action: AcrAction, templateFamily: TemplateFamilyCode) {
    const transitions: Record<AcrWorkflowState, AcrAction[]> = {
      DRAFT: ["save_draft", "submit_to_reporting"],
      PENDING_REPORTING: templateFamily === "APS_STENOTYPIST" ? ["submit_to_secret_branch", "return_to_clerk"] : ["forward_to_countersigning", "return_to_clerk"],
      PENDING_COUNTERSIGNING: ["submit_to_secret_branch", "return_to_clerk"],
      SUBMITTED_TO_SECRET_BRANCH: [],
      ARCHIVED: [],
      RETURNED: ["save_draft", "submit_to_reporting"],
    };

    return transitions[state].includes(action);
  }

  assertTransition(state: AcrWorkflowState, action: AcrAction, templateFamily: TemplateFamilyCode) {
    if (!this.canTransition(state, action, templateFamily)) {
      throw new BadRequestException(`Action '${action}' is not allowed from state '${state}'.`);
    }
  }

  nextStateForAction(action: AcrAction, templateFamily: TemplateFamilyCode) {
    switch (action) {
      case "save_draft":
        return { workflowState: AcrWorkflowState.DRAFT, statusLabel: "Draft" };
      case "submit_to_reporting":
        return { workflowState: AcrWorkflowState.PENDING_REPORTING, statusLabel: "Pending Reporting Officer" };
      case "forward_to_countersigning":
        if (templateFamily === "APS_STENOTYPIST") {
          return { workflowState: AcrWorkflowState.ARCHIVED, statusLabel: "Archived" };
        }
        return { workflowState: AcrWorkflowState.PENDING_COUNTERSIGNING, statusLabel: "Pending Countersigning" };
      case "submit_to_secret_branch":
        return { workflowState: AcrWorkflowState.ARCHIVED, statusLabel: "Archived" };
      case "return_to_clerk":
        return { workflowState: AcrWorkflowState.RETURNED, statusLabel: "Returned" };
      default:
        return { workflowState: AcrWorkflowState.DRAFT, statusLabel: "Draft" };
    }
  }

  getDueDate(baseDate: Date, stageDays: number) {
    return new Date(baseDate.getTime() + stageDays * 24 * 60 * 60 * 1000);
  }

  isOverdue(dueDate: Date, state: AcrWorkflowState) {
    if (state === AcrWorkflowState.ARCHIVED || state === AcrWorkflowState.RETURNED) {
      return false;
    }

    return dueDate.getTime() < Date.now();
  }

  overdueDays(dueDate: Date) {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / msPerDay));
  }
}
