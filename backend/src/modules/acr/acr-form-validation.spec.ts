import { AcrWorkflowState, TemplateFamilyCode } from "@prisma/client";
import {
  getActionFormValidationMessage,
  getClerkSubmissionValidationMessage,
  getReviewerSubmissionValidationMessage,
} from "./acr-form-validation";

describe("acr form validation", () => {
  it("requires the clerk reporting period before submission", () => {
    expect(getClerkSubmissionValidationMessage({ clerkSection: { periodFrom: "", periodTo: "" } })).toBe(
      "Please complete the Clerk section before submission. Missing: reporting period.",
    );
  });

  it("requires reviewer remarks, date, signature, and stamp", () => {
    expect(
      getReviewerSubmissionValidationMessage("reporting", TemplateFamilyCode.ASSISTANT_UDC_LDC, {
        replicaState: {
          textFields: {},
          checkFields: {},
          assetFields: {},
        },
      }),
    ).toBe(
      "Please complete the Reporting Officer section before submission. Missing: assessment / remarks, date, signature, official stamp.",
    );
  });

  it("accepts a fully completed countersigning section", () => {
    expect(
      getReviewerSubmissionValidationMessage("countersigning", TemplateFamilyCode.ASSISTANT_UDC_LDC, {
        replicaState: {
          textFields: {
            "text:countersigning:pen-picture-line-1": "Reviewed and found satisfactory.",
            "text:countersigning:countersigning-signature-date": "2026-04-05",
          },
          checkFields: {},
          assetFields: {
            "asset:countersigning:countersigning-signature": { fileId: "sig-1" },
            "asset:countersigning:countersigning-official-stamp": { fileId: "stamp-1" },
          },
        },
      }),
    ).toBeNull();
  });

  it("does not require an official stamp for the BPS 17-18 PER reviewer sections", () => {
    expect(
      getReviewerSubmissionValidationMessage("reporting", TemplateFamilyCode.PER_17_18_OFFICERS, {
        replicaState: {
          textFields: {
            "text:reporting:per1718-reporting-narrative-1": "Performance reviewed.",
            "text:reporting:reporting-signature-date": "2026-04-05",
          },
          checkFields: {
            "check:reporting:intelligence-a": true,
          },
          assetFields: {
            "asset:reporting:reporting-signature": { fileId: "sig-17-18" },
          },
        },
      }),
    ).toBeNull();
  });

  it("maps submit-to-secret-branch validation to the current reviewer scope", () => {
    expect(
      getActionFormValidationMessage({
        action: "submit_to_secret_branch",
        workflowState: AcrWorkflowState.PENDING_COUNTERSIGNING,
        templateFamily: TemplateFamilyCode.ASSISTANT_UDC_LDC,
        formData: {
          replicaState: {
            textFields: {},
            checkFields: {},
            assetFields: {},
          },
        },
      }),
    ).toContain("Countersigning Officer");
  });
});
