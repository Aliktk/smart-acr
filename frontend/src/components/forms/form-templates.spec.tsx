import React from "react";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import FormB_S121E from "./FormB_S121E.js";
import FormC_Inspector from "./FormC_Inspector.js";
import FormD_Superintendent from "./FormD_Superintendent.js";
import FormE_CarDriversDespatchRiders from "./FormE_CarDriversDespatchRiders.js";
import FormF_Per1718Officers from "./FormF_Per1718Officers.js";
import { getActionFormValidationMessage, getReviewerSubmissionValidationMessage, hasReusableReviewerAsset } from "../../utils/acr-form-validation.js";

function runAssertion(name: string, assertion: () => void) {
  try {
    assertion();
  } catch (error) {
    throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

runAssertion("APS / Stenotypist template preserves bilingual headings without a countersigning section", () => {
  const markup = renderToStaticMarkup(<FormB_S121E />);

  assert.ok(markup.includes("FOR ASSISTANT PRIVATE SECRETARY / STENOTYPISTS"));
  assert.ok(markup.includes("اسسٹنٹ پرائیویٹ سیکریٹری / اسٹینوٹائپسٹ"));
  assert.equal(markup.includes("REMARKS OF THE COUNTERSIGNING OFFICER"), false);
});

runAssertion("Superintendent template includes the countersigning officer section", () => {
  const markup = renderToStaticMarkup(<FormD_Superintendent />);

  assert.ok(markup.includes("for Superintendent / Assistant Incharge"));
  assert.ok(markup.includes("REMARKS OF THE COUNTERSIGNING OFFICER"));
  assert.ok(markup.includes("کاؤنٹر سائننگ افسر کے ریمارکس"));
});

runAssertion("Inspector template uses the shared signature and stamp layout", () => {
  const markup = renderToStaticMarkup(<FormC_Inspector />);

  assert.ok(markup.includes("Official Stamp"));
  assert.ok(markup.includes("Signature, Name &amp; Designation of Reporting Officer"));
  assert.equal(markup.includes("Click to Sign"), false);
});

runAssertion("Car drivers template preserves the yes / no checklist and instruction appendix", () => {
  const markup = renderToStaticMarkup(<FormE_CarDriversDespatchRiders />);

  assert.ok(markup.includes("Annual Restricted Report Form for"));
  assert.ok(markup.includes("Car Drivers / Despatch Riders"));
  assert.ok(markup.includes("STANDARD OF PERFORMANCE / PERSONAL TRAITS"));
  assert.equal((markup.match(/General Remarks of the Reporting Officer:/g) ?? []).length, 2);
  assert.equal(markup.includes("General Remarks of the Countersigning Officer:"), false);
  assert.ok(markup.includes("*For dispatch riders only"));
  assert.ok(markup.includes("/form-assets/car-drivers/page-3.jpg"));
});

runAssertion("PER 17-18 template preserves the reporting and countersigning sections without official stamps", () => {
  const markup = renderToStaticMarkup(<FormF_Per1718Officers />);

  assert.ok(markup.includes("FOR OFFICERS IN BPS 17 &amp; 18"));
  assert.ok(markup.includes("REMARKS OF THE SECOND COUNTERSIGNING OFFICER"));
  assert.ok(markup.includes("PER Submission Certificate from Officer Reported Upon"));
  assert.equal(markup.includes("Official Stamp"), false);
});

runAssertion("Reusable reviewer assets satisfy reviewer validation without manual per-ACR upload", () => {
  const reviewerContext = {
    reporting: {
      name: "DSP Khalid Mehmood",
      designation: "Deputy Director",
      signatureAsset: {
        id: "asset-signature-1",
        assetType: "SIGNATURE" as const,
        storageType: "LOCAL" as const,
        fileName: "signature.png",
        mimeType: "image/png",
        fileSize: 1024,
        updatedAt: "2026-04-08T10:00:00.000Z",
      },
      stampAsset: {
        id: "asset-stamp-1",
        assetType: "STAMP" as const,
        storageType: "LOCAL" as const,
        fileName: "stamp.png",
        mimeType: "image/png",
        fileSize: 2048,
        updatedAt: "2026-04-08T10:00:00.000Z",
      },
    },
    countersigning: null,
  };

  const message = getReviewerSubmissionValidationMessage({
    scope: "reporting",
    templateFamily: "ASSISTANT_UDC_LDC",
    reviewerContext,
    replicaState: {
      textFields: {
        "text:reporting:assessment": "Assessment entered.",
        "text:reporting:signature-date": "2026-04-08",
      },
      checkFields: {},
      assetFields: {},
    },
  });

  assert.equal(message, null);
  assert.equal(hasReusableReviewerAsset(reviewerContext, "reporting", "signature"), true);
  assert.equal(hasReusableReviewerAsset(reviewerContext, "reporting", "official-stamp"), true);
});

runAssertion("Non-countersigning templates do not demand countersigning assets during reporting submission", () => {
  const message = getActionFormValidationMessage({
    action: "submit_to_secret_branch",
    workflowState: "Pending Reporting",
    templateFamily: "APS_STENOTYPIST",
    formData: {
      clerkSection: {
        periodFrom: "2026-01-01",
        periodTo: "2026-12-31",
        zoneCircle: "",
        directDeputationist: "",
        fatherName: "",
        trainingCourses: "",
        departmentalEnquiry: "",
        punishment: "",
        rewards: "",
        remarks: "",
        isPriority: false,
      },
    },
    reviewerContext: {
      reporting: {
        name: "Reporting Officer",
        designation: "Deputy Director",
        signatureAsset: {
          id: "asset-signature-2",
          assetType: "SIGNATURE",
          storageType: "LOCAL",
          fileName: "signature.png",
          mimeType: "image/png",
          fileSize: 1024,
          updatedAt: "2026-04-08T10:00:00.000Z",
        },
        stampAsset: {
          id: "asset-stamp-2",
          assetType: "STAMP",
          storageType: "LOCAL",
          fileName: "stamp.png",
          mimeType: "image/png",
          fileSize: 2048,
          updatedAt: "2026-04-08T10:00:00.000Z",
        },
      },
      countersigning: {
        name: "Unused Countersigning Officer",
        designation: "Director",
        signatureAsset: null,
        stampAsset: null,
      },
    },
    replicaState: {
      textFields: {
        "text:reporting:assessment": "Assessment entered.",
        "text:reporting:signature-date": "2026-04-08",
      },
      checkFields: {},
      assetFields: {},
    },
  });

  assert.equal(message, null);
});

console.log("Form template checks passed.");
