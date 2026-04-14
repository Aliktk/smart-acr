"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasReusableReviewerAsset = hasReusableReviewerAsset;
exports.getClerkSubmissionValidationMessage = getClerkSubmissionValidationMessage;
exports.getReviewerSubmissionValidationMessage = getReviewerSubmissionValidationMessage;
exports.getActionFormValidationMessage = getActionFormValidationMessage;
const templates_js_1 = require("./templates.js");
const REVIEWER_IGNORED_TEXT_BINDINGS = ["signature-date", "officer-name", "officer-designation"];
function hasReplicaTextValue(replicaState, scope, binding) {
    return Object.entries(replicaState.textFields).some(([key, value]) => key.startsWith(`text:${scope}:`) && key.includes(binding) && value.trim().length > 0);
}
function hasReplicaAssetValue(replicaState, scope, binding) {
    return Object.entries(replicaState.assetFields).some(([key, value]) => key.startsWith(`asset:${scope}:`) && key.includes(binding) && Boolean(value));
}
function hasReplicaContribution(replicaState, scope) {
    const hasMeaningfulText = Object.entries(replicaState.textFields).some(([key, value]) => {
        if (!key.startsWith(`text:${scope}:`) || value.trim().length === 0) {
            return false;
        }
        return !REVIEWER_IGNORED_TEXT_BINDINGS.some((binding) => key.includes(binding));
    });
    const hasCheckedRating = Object.entries(replicaState.checkFields).some(([key, value]) => key.startsWith(`check:${scope}:`) && Boolean(value));
    return hasMeaningfulText || hasCheckedRating;
}
function hasReusableReviewerAsset(reviewerContext, scope, binding) {
    const reviewer = scope === "reporting" ? reviewerContext?.reporting : reviewerContext?.countersigning;
    if (!reviewer) {
        return false;
    }
    return binding === "signature" ? Boolean(reviewer.signatureAsset) : Boolean(reviewer.stampAsset);
}
function getClerkSubmissionValidationMessage(formData) {
    const clerkSection = formData?.clerkSection;
    if (!clerkSection?.periodFrom || !clerkSection.periodTo) {
        return "Please complete the Clerk section before submission. Missing: reporting period.";
    }
    if (clerkSection.periodFrom > clerkSection.periodTo) {
        return "Please complete the Clerk section before submission. The reporting period end date cannot be earlier than the start date.";
    }
    return null;
}
function getReviewerSubmissionValidationMessage(params) {
    const missing = [];
    if (!hasReplicaContribution(params.replicaState, params.scope)) {
        missing.push("assessment / remarks");
    }
    if (!hasReplicaTextValue(params.replicaState, params.scope, "signature-date")) {
        missing.push("date");
    }
    if (!hasReplicaAssetValue(params.replicaState, params.scope, "signature")
        && !hasReusableReviewerAsset(params.reviewerContext, params.scope, "signature")) {
        missing.push("signature");
    }
    if ((0, templates_js_1.templateRequiresOfficialStamp)(params.templateFamily, params.scope)
        && !hasReplicaAssetValue(params.replicaState, params.scope, "official-stamp")
        && !hasReusableReviewerAsset(params.reviewerContext, params.scope, "official-stamp")) {
        missing.push("official stamp");
    }
    if (missing.length === 0) {
        return null;
    }
    const scopeLabel = params.scope === "reporting" ? "Reporting Officer" : "Countersigning Officer";
    return `Please complete the ${scopeLabel} section before submission. Missing: ${missing.join(", ")}.`;
}
function getActionFormValidationMessage(params) {
    if (params.action === "submit_to_reporting") {
        return getClerkSubmissionValidationMessage(params.formData);
    }
    if (params.action === "forward_to_countersigning") {
        return getReviewerSubmissionValidationMessage({
            scope: "reporting",
            templateFamily: params.templateFamily,
            replicaState: params.replicaState,
            reviewerContext: params.reviewerContext,
        });
    }
    if (params.action === "submit_to_secret_branch") {
        const scope = params.workflowState === "Pending Countersigning" ? "countersigning" : "reporting";
        return getReviewerSubmissionValidationMessage({
            scope,
            templateFamily: params.templateFamily,
            replicaState: params.replicaState,
            reviewerContext: params.reviewerContext,
        });
    }
    return null;
}
