"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const strict_1 = __importDefault(require("node:assert/strict"));
const server_1 = require("react-dom/server");
const FormB_S121E_js_1 = __importDefault(require("./FormB_S121E.js"));
const FormC_Inspector_js_1 = __importDefault(require("./FormC_Inspector.js"));
const FormD_Superintendent_js_1 = __importDefault(require("./FormD_Superintendent.js"));
const FormE_CarDriversDespatchRiders_js_1 = __importDefault(require("./FormE_CarDriversDespatchRiders.js"));
const FormF_Per1718Officers_js_1 = __importDefault(require("./FormF_Per1718Officers.js"));
const acr_form_validation_js_1 = require("../../utils/acr-form-validation.js");
function runAssertion(name, assertion) {
    try {
        assertion();
    }
    catch (error) {
        throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
}
runAssertion("APS / Stenotypist template preserves bilingual headings without a countersigning section", () => {
    const markup = (0, server_1.renderToStaticMarkup)((0, jsx_runtime_1.jsx)(FormB_S121E_js_1.default, {}));
    strict_1.default.ok(markup.includes("FOR ASSISTANT PRIVATE SECRETARY / STENOTYPISTS"));
    strict_1.default.ok(markup.includes("اسسٹنٹ پرائیویٹ سیکریٹری / اسٹینوٹائپسٹ"));
    strict_1.default.equal(markup.includes("REMARKS OF THE COUNTERSIGNING OFFICER"), false);
});
runAssertion("Superintendent template includes the countersigning officer section", () => {
    const markup = (0, server_1.renderToStaticMarkup)((0, jsx_runtime_1.jsx)(FormD_Superintendent_js_1.default, {}));
    strict_1.default.ok(markup.includes("for Superintendent / Assistant Incharge"));
    strict_1.default.ok(markup.includes("REMARKS OF THE COUNTERSIGNING OFFICER"));
    strict_1.default.ok(markup.includes("کاؤنٹر سائننگ افسر کے ریمارکس"));
});
runAssertion("Inspector template uses the shared signature and stamp layout", () => {
    const markup = (0, server_1.renderToStaticMarkup)((0, jsx_runtime_1.jsx)(FormC_Inspector_js_1.default, {}));
    strict_1.default.ok(markup.includes("Official Stamp"));
    strict_1.default.ok(markup.includes("Signature, Name &amp; Designation of Reporting Officer"));
    strict_1.default.equal(markup.includes("Click to Sign"), false);
});
runAssertion("Car drivers template preserves the yes / no checklist and instruction appendix", () => {
    const markup = (0, server_1.renderToStaticMarkup)((0, jsx_runtime_1.jsx)(FormE_CarDriversDespatchRiders_js_1.default, {}));
    strict_1.default.ok(markup.includes("Annual Restricted Report Form for"));
    strict_1.default.ok(markup.includes("Car Drivers / Despatch Riders"));
    strict_1.default.ok(markup.includes("STANDARD OF PERFORMANCE / PERSONAL TRAITS"));
    strict_1.default.equal((markup.match(/General Remarks of the Reporting Officer:/g) ?? []).length, 2);
    strict_1.default.equal(markup.includes("General Remarks of the Countersigning Officer:"), false);
    strict_1.default.ok(markup.includes("*For dispatch riders only"));
    strict_1.default.ok(markup.includes("/form-assets/car-drivers/page-3.jpg"));
});
runAssertion("PER 17-18 template preserves the reporting and countersigning sections without official stamps", () => {
    const markup = (0, server_1.renderToStaticMarkup)((0, jsx_runtime_1.jsx)(FormF_Per1718Officers_js_1.default, {}));
    strict_1.default.ok(markup.includes("FOR OFFICERS IN BPS 17 &amp; 18"));
    strict_1.default.ok(markup.includes("REMARKS OF THE SECOND COUNTERSIGNING OFFICER"));
    strict_1.default.ok(markup.includes("PER Submission Certificate from Officer Reported Upon"));
    strict_1.default.equal(markup.includes("Official Stamp"), false);
});
runAssertion("Reusable reviewer assets satisfy reviewer validation without manual per-ACR upload", () => {
    const reviewerContext = {
        reporting: {
            name: "DSP Khalid Mehmood",
            designation: "Deputy Director",
            signatureAsset: {
                id: "asset-signature-1",
                assetType: "SIGNATURE",
                storageType: "LOCAL",
                fileName: "signature.png",
                mimeType: "image/png",
                fileSize: 1024,
                updatedAt: "2026-04-08T10:00:00.000Z",
            },
            stampAsset: {
                id: "asset-stamp-1",
                assetType: "STAMP",
                storageType: "LOCAL",
                fileName: "stamp.png",
                mimeType: "image/png",
                fileSize: 2048,
                updatedAt: "2026-04-08T10:00:00.000Z",
            },
        },
        countersigning: null,
    };
    const message = (0, acr_form_validation_js_1.getReviewerSubmissionValidationMessage)({
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
    strict_1.default.equal(message, null);
    strict_1.default.equal((0, acr_form_validation_js_1.hasReusableReviewerAsset)(reviewerContext, "reporting", "signature"), true);
    strict_1.default.equal((0, acr_form_validation_js_1.hasReusableReviewerAsset)(reviewerContext, "reporting", "official-stamp"), true);
});
runAssertion("Non-countersigning templates do not demand countersigning assets during reporting submission", () => {
    const message = (0, acr_form_validation_js_1.getActionFormValidationMessage)({
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
    strict_1.default.equal(message, null);
});
console.log("Form template checks passed.");
