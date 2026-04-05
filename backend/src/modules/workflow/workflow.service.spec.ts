import { BadRequestException } from "@nestjs/common";
import { AcrWorkflowState, TemplateFamilyCode } from "@prisma/client";
import { WorkflowService } from "./workflow.service";

describe("WorkflowService", () => {
  const service = new WorkflowService();

  it("allows APS / Stenotypist records to skip countersigning", () => {
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
        "submit_to_secret_branch",
        TemplateFamilyCode.INSPECTOR_SI_ASI,
      ),
    ).toThrow(BadRequestException);
  });

  it("calculates the next state for countersigning-aware flows", () => {
    expect(
      service.nextStateForAction(
        "forward_to_countersigning",
        TemplateFamilyCode.SUPERINTENDENT_AINCHARGE,
      ),
    ).toEqual({
      workflowState: AcrWorkflowState.PENDING_COUNTERSIGNING,
      statusLabel: "Pending Countersigning",
    });
  });

  it("archives the record immediately when submitted to secret branch", () => {
    expect(
      service.nextStateForAction(
        "submit_to_secret_branch",
        TemplateFamilyCode.INSPECTOR_SI_ASI,
      ),
    ).toEqual({
      workflowState: AcrWorkflowState.ARCHIVED,
      statusLabel: "Archived",
    });
  });

  it("marks only active unfinished records as overdue", () => {
    const overdueDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);

    expect(service.isOverdue(overdueDate, AcrWorkflowState.PENDING_REPORTING)).toBe(true);
    expect(service.isOverdue(overdueDate, AcrWorkflowState.ARCHIVED)).toBe(false);
    expect(service.isOverdue(overdueDate, AcrWorkflowState.RETURNED)).toBe(false);
    expect(service.overdueDays(overdueDate)).toBeGreaterThanOrEqual(3);
  });
});
