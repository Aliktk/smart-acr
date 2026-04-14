import type { AcrFormData, AcrWorkflowState, AcrReplicaState, AcrReviewerContext, TemplateFamilyCode } from "@/types/contracts";
import { templateRequiresOfficialStamp } from "./templates";

const REVIEWER_IGNORED_TEXT_BINDINGS = ["signature-date", "officer-name", "officer-designation"];

function hasReplicaTextValue(
  replicaState: AcrReplicaState,
  scope: "reporting" | "countersigning",
  binding: string,
) {
  return Object.entries(replicaState.textFields).some(
    ([key, value]) => key.startsWith(`text:${scope}:`) && key.includes(binding) && value.trim().length > 0,
  );
}

function hasReplicaAssetValue(
  replicaState: AcrReplicaState,
  scope: "reporting" | "countersigning",
  binding: string,
) {
  return Object.entries(replicaState.assetFields).some(
    ([key, value]) => key.startsWith(`asset:${scope}:`) && key.includes(binding) && Boolean(value),
  );
}

function hasReplicaContribution(replicaState: AcrReplicaState, scope: "reporting" | "countersigning") {
  const hasMeaningfulText = Object.entries(replicaState.textFields).some(([key, value]) => {
    if (!key.startsWith(`text:${scope}:`) || value.trim().length === 0) {
      return false;
    }

    return !REVIEWER_IGNORED_TEXT_BINDINGS.some((binding) => key.includes(binding));
  });

  const hasCheckedRating = Object.entries(replicaState.checkFields).some(
    ([key, value]) => key.startsWith(`check:${scope}:`) && Boolean(value),
  );

  return hasMeaningfulText || hasCheckedRating;
}

export function hasReusableReviewerAsset(
  reviewerContext: AcrReviewerContext | null | undefined,
  scope: "reporting" | "countersigning",
  binding: "signature" | "official-stamp",
) {
  const reviewer = scope === "reporting" ? reviewerContext?.reporting : reviewerContext?.countersigning;

  if (!reviewer) {
    return false;
  }

  return binding === "signature" ? Boolean(reviewer.signatureAsset) : Boolean(reviewer.stampAsset);
}

export function getClerkSubmissionValidationMessage(formData?: AcrFormData | null) {
  const clerkSection = formData?.clerkSection;

  if (!clerkSection?.periodFrom || !clerkSection.periodTo) {
    return "Please complete the Clerk section before submission. Missing: reporting period.";
  }

  if (clerkSection.periodFrom > clerkSection.periodTo) {
    return "Please complete the Clerk section before submission. The reporting period end date cannot be earlier than the start date.";
  }

  const fromYear = new Date(clerkSection.periodFrom).getFullYear();
  const toYear = new Date(clerkSection.periodTo).getFullYear();
  if (fromYear !== toYear) {
    return "Reporting period cannot span multiple calendar years. Each ACR must cover a single calendar year as per FIA Standing Order No. 02/2023.";
  }

  const from = new Date(clerkSection.periodFrom);
  const to = new Date(clerkSection.periodTo);
  const monthsDiff = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (monthsDiff < 3) {
    return "Reporting period must be at least three (3) months as per FIA Standing Order No. 02/2023.";
  }

  return null;
}

export function getReviewerSubmissionValidationMessage(params: {
  scope: "reporting" | "countersigning";
  templateFamily: TemplateFamilyCode;
  replicaState: AcrReplicaState;
  reviewerContext?: AcrReviewerContext | null;
}) {
  const missing: string[] = [];

  if (!hasReplicaContribution(params.replicaState, params.scope)) {
    missing.push("assessment / remarks");
  }

  if (!hasReplicaTextValue(params.replicaState, params.scope, "signature-date")) {
    missing.push("date");
  }

  if (
    !hasReplicaAssetValue(params.replicaState, params.scope, "signature")
    && !hasReusableReviewerAsset(params.reviewerContext, params.scope, "signature")
  ) {
    missing.push("signature");
  }

  if (
    templateRequiresOfficialStamp(params.templateFamily, params.scope)
    && !hasReplicaAssetValue(params.replicaState, params.scope, "official-stamp")
    && !hasReusableReviewerAsset(params.reviewerContext, params.scope, "official-stamp")
  ) {
    missing.push("official stamp");
  }

  if (missing.length === 0) {
    return null;
  }

  const scopeLabel = params.scope === "reporting" ? "Reporting Officer" : "Countersigning Officer";
  return `Please complete the ${scopeLabel} section before submission. Missing: ${missing.join(", ")}.`;
}

export function getActionFormValidationMessage(params: {
  action: string;
  workflowState: AcrWorkflowState;
  formData?: AcrFormData | null;
  templateFamily: TemplateFamilyCode;
  replicaState: AcrReplicaState;
  reviewerContext?: AcrReviewerContext | null;
}) {
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
