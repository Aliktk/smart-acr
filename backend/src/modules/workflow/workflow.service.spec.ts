import { BadRequestException } from "@nestjs/common";
import { AcrWorkflowState, TemplateFamilyCode } from "@prisma/client";
import { WorkflowService } from "./workflow.service";

describe("WorkflowService", () => {
  const service = new WorkflowService();

  it("allows APS / Stenotypist records to skip countersigning and enter Secret Branch review", () => {
    expect(
      service.canTransition(
        AcrWorkflowState.PENDING_REPORTING,
        "submit_to_secret_branch",
        TemplateFamilyCode.APS_STENOTYPIST,
      ),
    ).toBe(true);

    expect(
      service.canTransition(
        AcrWorkflowState.PENDING_REPORTING,
        "forward_to_countersigning",
        TemplateFamilyCode.APS_STENOTYPIST,
      ),
    ).toBe(false);
  });

  it("requires countersigning for non-APS templates", () => {
    expect(
      service.canTransition(
        AcrWorkflowState.PENDING_REPORTING,
        "forward_to_countersigning",
        TemplateFamilyCode.ASSISTANT_UDC_LDC,
      ),
    ).toBe(true);

    expect(
      service.canTransition(
        AcrWorkflowState.PENDING_REPORTING,
        "submit_to_secret_branch",
        TemplateFamilyCode.ASSISTANT_UDC_LDC,
      ),
    ).toBe(false);
  });

  it("throws for invalid transitions", () => {
    expect(() =>
      service.assertTransition(
        AcrWorkflowState.DRAFT,
        "verify_secret_branch",
        TemplateFamilyCode.INSPECTOR_SI_ASI,
      ),
    ).toThrow(BadRequestException);
  });

  it("moves records into Secret Branch review and verification before archiving", () => {
    expect(
      service.nextStateForAction(
        "submit_to_secret_branch",
        TemplateFamilyCode.INSPECTOR_SI_ASI,
      ),
    ).toEqual({
      workflowState: AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW,
      statusLabel: "Pending Secret Branch Review",
    });

    expect(
      service.nextStateForAction(
        "complete_secret_branch_review",
        TemplateFamilyCode.INSPECTOR_SI_ASI,
      ),
    ).toEqual({
      workflowState: AcrWorkflowState.PENDING_SECRET_BRANCH_VERIFICATION,
      statusLabel: "Pending Secret Branch Verification",
    });

    expect(
      service.nextStateForAction(
        "verify_secret_branch",
        TemplateFamilyCode.INSPECTOR_SI_ASI,
      ),
    ).toEqual({
      workflowState: AcrWorkflowState.ARCHIVED,
      statusLabel: "Archived",
    });
  });

  it("supports full lifecycle: Draft → RO → CSO → SB Review → SB Verify → Archive", () => {
    const family = TemplateFamilyCode.INSPECTOR_SI_ASI;

    // Draft → submit_to_reporting → PENDING_REPORTING
    expect(service.canTransition(AcrWorkflowState.DRAFT, "submit_to_reporting", family)).toBe(true);
    const s1 = service.nextStateForAction("submit_to_reporting", family);
    expect(s1.workflowState).toBe(AcrWorkflowState.PENDING_REPORTING);

    // PENDING_REPORTING → forward_to_countersigning → PENDING_COUNTERSIGNING
    expect(service.canTransition(AcrWorkflowState.PENDING_REPORTING, "forward_to_countersigning", family)).toBe(true);
    const s2 = service.nextStateForAction("forward_to_countersigning", family);
    expect(s2.workflowState).toBe(AcrWorkflowState.PENDING_COUNTERSIGNING);

    // PENDING_COUNTERSIGNING → submit_to_secret_branch → PENDING_SECRET_BRANCH_REVIEW
    expect(service.canTransition(AcrWorkflowState.PENDING_COUNTERSIGNING, "submit_to_secret_branch", family)).toBe(true);
    const s3 = service.nextStateForAction("submit_to_secret_branch", family);
    expect(s3.workflowState).toBe(AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW);

    // PENDING_SECRET_BRANCH_REVIEW → complete_secret_branch_review → PENDING_SECRET_BRANCH_VERIFICATION
    expect(service.canTransition(AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW, "complete_secret_branch_review", family)).toBe(true);
    const s4 = service.nextStateForAction("complete_secret_branch_review", family);
    expect(s4.workflowState).toBe(AcrWorkflowState.PENDING_SECRET_BRANCH_VERIFICATION);

    // PENDING_SECRET_BRANCH_VERIFICATION → verify_secret_branch → ARCHIVED
    expect(service.canTransition(AcrWorkflowState.PENDING_SECRET_BRANCH_VERIFICATION, "verify_secret_branch", family)).toBe(true);
    const s5 = service.nextStateForAction("verify_secret_branch", family);
    expect(s5.workflowState).toBe(AcrWorkflowState.ARCHIVED);
  });

  it("supports return flows at each stage", () => {
    const family = TemplateFamilyCode.ASSISTANT_UDC_LDC;

    expect(service.canTransition(AcrWorkflowState.PENDING_REPORTING, "return_to_clerk", family)).toBe(true);
    expect(service.nextStateForAction("return_to_clerk", family).workflowState).toBe(AcrWorkflowState.RETURNED_TO_CLERK);

    expect(service.canTransition(AcrWorkflowState.PENDING_COUNTERSIGNING, "return_to_reporting", family)).toBe(true);
    expect(service.nextStateForAction("return_to_reporting", family).workflowState).toBe(AcrWorkflowState.RETURNED_TO_REPORTING);

    expect(service.canTransition(AcrWorkflowState.PENDING_SECRET_BRANCH_REVIEW, "return_to_countersigning", family)).toBe(true);
    expect(service.nextStateForAction("return_to_countersigning", family).workflowState).toBe(AcrWorkflowState.RETURNED_TO_COUNTERSIGNING);
  });

  it("blocks invalid transitions at every stage", () => {
    const family = TemplateFamilyCode.INSPECTOR_SI_ASI;

    // Cannot archive directly from draft
    expect(service.canTransition(AcrWorkflowState.DRAFT, "verify_secret_branch", family)).toBe(false);
    // Cannot return from draft
    expect(service.canTransition(AcrWorkflowState.DRAFT, "return_to_clerk", family)).toBe(false);
    // Cannot skip countersigning for non-APS
    expect(service.canTransition(AcrWorkflowState.PENDING_REPORTING, "submit_to_secret_branch", family)).toBe(false);
    // Cannot go backward from archived
    expect(service.canTransition(AcrWorkflowState.ARCHIVED, "submit_to_reporting", family)).toBe(false);
  });

  it("marks only active unfinished records as overdue", () => {
    const overdueDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    expect(service.isOverdue(overdueDate, AcrWorkflowState.PENDING_REPORTING)).toBe(true);
    expect(service.isOverdue(overdueDate, AcrWorkflowState.ARCHIVED)).toBe(false);
    expect(service.isOverdue(overdueDate, AcrWorkflowState.RETURNED_TO_CLERK)).toBe(false);
    expect(service.overdueDays(overdueDate)).toBeGreaterThanOrEqual(3);
  });
});
