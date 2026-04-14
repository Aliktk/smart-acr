import { AcrWorkflowState, TemplateFamilyCode } from "@prisma/client";
import { getTemplateCatalogEntry, templateFamilyRequiresOfficialStamp } from "../../common/template-catalog";
import type { AcrAction } from "../workflow/workflow.service";

type ReplicaStateLike = {
  textFields?: Record<string, string>;
  checkFields?: Record<string, boolean>;
  assetFields?: Record<string, unknown>;
};

type ClerkSectionLike = {
  periodFrom?: string;
  periodTo?: string;
};

type AcrFormDataLike = {
  clerkSection?: ClerkSectionLike;
  replicaState?: ReplicaStateLike | null;
};

const REVIEWER_IGNORED_TEXT_BINDINGS = ["signature-date", "officer-name", "officer-designation"];

function readFormData(value: Record<string, unknown> | null | undefined): AcrFormDataLike {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as AcrFormDataLike;
}

function readReplicaState(value: Record<string, unknown> | null | undefined) {
  return readFormData(value).replicaState ?? {};
}

function hasReplicaTextValue(
  replicaState: ReplicaStateLike,
  scope: "reporting" | "countersigning",
  binding: string,
) {
  return Object.entries(replicaState.textFields ?? {}).some(
    ([key, value]) => key.startsWith(`text:${scope}:`) && key.includes(binding) && value.trim().length > 0,
  );
}

function hasReplicaAssetValue(
  replicaState: ReplicaStateLike,
  scope: "reporting" | "countersigning",
  binding: string,
) {
  return Object.entries(replicaState.assetFields ?? {}).some(
    ([key, value]) => key.startsWith(`asset:${scope}:`) && key.includes(binding) && Boolean(value),
  );
}

function hasReplicaContribution(replicaState: ReplicaStateLike, scope: "reporting" | "countersigning") {
  const hasMeaningfulText = Object.entries(replicaState.textFields ?? {}).some(([key, value]) => {
    if (!key.startsWith(`text:${scope}:`) || value.trim().length === 0) {
      return false;
    }

    return !REVIEWER_IGNORED_TEXT_BINDINGS.some((binding) => key.includes(binding));
  });

  const hasCheckedRating = Object.entries(replicaState.checkFields ?? {}).some(
    ([key, value]) => key.startsWith(`check:${scope}:`) && Boolean(value),
  );

  return hasMeaningfulText || hasCheckedRating;
}

export function getClerkSubmissionValidationMessage(formData: Record<string, unknown> | null | undefined) {
  const clerkSection = readFormData(formData).clerkSection;

  if (!clerkSection?.periodFrom || !clerkSection.periodTo) {
    return "Please complete the Clerk section before submission. Missing: reporting period.";
  }

  if (clerkSection.periodFrom > clerkSection.periodTo) {
    return "Please complete the Clerk section before submission. The reporting period end date cannot be earlier than the start date.";
  }

  return null;
}

export function getReviewerSubmissionValidationMessage(
  scope: "reporting" | "countersigning",
  templateFamily: TemplateFamilyCode,
  formData: Record<string, unknown> | null | undefined,
) {
  const replicaState = readReplicaState(formData);
  const missing: string[] = [];

  if (!hasReplicaContribution(replicaState, scope)) {
    missing.push("assessment / remarks");
  }

  if (!hasReplicaTextValue(replicaState, scope, "signature-date")) {
    missing.push("date");
  }

  if (!hasReplicaAssetValue(replicaState, scope, "signature")) {
    missing.push("signature");
  }

  if (templateFamilyRequiresOfficialStamp(templateFamily, scope) && !hasReplicaAssetValue(replicaState, scope, "official-stamp")) {
    missing.push("official stamp");
  }

  if (missing.length === 0) {
    return null;
  }

  const scopeLabel = scope === "reporting" ? "Reporting Officer" : "Countersigning Officer";
  return `Please complete the ${scopeLabel} section before submission. Missing: ${missing.join(", ")}.`;
}

export function getActionFormValidationMessage(params: {
  action: AcrAction;
  workflowState: AcrWorkflowState;
  templateFamily: TemplateFamilyCode;
  formData: Record<string, unknown> | null | undefined;
}) {
  const template = getTemplateCatalogEntry(params.templateFamily);

  if (!template) {
    return "No active template configuration was found for this ACR form family.";
  }

  if (params.action === "submit_to_reporting") {
    return getClerkSubmissionValidationMessage(params.formData);
  }

  if (params.action === "forward_to_countersigning") {
    return getReviewerSubmissionValidationMessage("reporting", params.templateFamily, params.formData);
  }

  if (params.action === "submit_to_secret_branch") {
    const scope =
      params.workflowState === AcrWorkflowState.PENDING_COUNTERSIGNING ||
      params.workflowState === AcrWorkflowState.RETURNED_TO_COUNTERSIGNING
        ? "countersigning"
        : "reporting";
    return getReviewerSubmissionValidationMessage(scope, params.templateFamily, params.formData);
  }

  return null;
}
