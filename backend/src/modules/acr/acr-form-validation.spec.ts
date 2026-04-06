import { AcrWorkflowState } from "@prisma/client";
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
      getReviewerSubmissionValidationMessage("reporting", {
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
      getReviewerSubmissionValidationMessage("countersigning", {
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

  it("maps submit-to-secret-branch validation to the current reviewer scope", () => {
    expect(
      getActionFormValidationMessage({
        action: "submit_to_secret_branch",
        workflowState: AcrWorkflowState.PENDING_COUNTERSIGNING,
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
