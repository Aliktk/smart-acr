"use client";

import {
  FormA_S121C,
  FormB_S121E,
  FormC_Inspector,
  FormD_Superintendent,
  FormE_CarDriversDespatchRiders,
  FormF_Per1718Officers,
  InteractiveForm,
} from "@/components/forms";
import type { AcrFormData, AcrReplicaState, AcrReviewerContext, TemplateFamilyCode } from "@/types/contracts";

type FormPreviewProps = {
  templateFamily: TemplateFamilyCode;
  editable?: boolean;
  editableScopes?: string[];
  inlineProfileAssetScope?: "reporting" | "countersigning" | null;
  formData?: AcrFormData | null;
  acrRecordId?: string;
  reviewerContext?: AcrReviewerContext | null;
  onReplicaStateChange?: (replicaState: AcrReplicaState) => void;
};

function renderTemplate(templateFamily: TemplateFamilyCode) {
  switch (templateFamily) {
    case "APS_STENOTYPIST":
      return <FormB_S121E />;
    case "INSPECTOR_SI_ASI":
      return <FormC_Inspector />;
    case "SUPERINTENDENT_AINCHARGE":
      return <FormD_Superintendent />;
    case "CAR_DRIVERS_DESPATCH_RIDERS":
      return <FormE_CarDriversDespatchRiders />;
    case "PER_17_18_OFFICERS":
      return <FormF_Per1718Officers />;
    case "ASSISTANT_UDC_LDC":
    default:
      return <FormA_S121C />;
  }
}

export function FormPreview({
  templateFamily,
  editable = false,
  editableScopes,
  inlineProfileAssetScope = null,
  formData,
  acrRecordId,
  reviewerContext,
  onReplicaStateChange,
}: FormPreviewProps) {
  const formContent = renderTemplate(templateFamily);

  if (!editable && !formData) {
    return formContent;
  }

  return (
    <InteractiveForm
      editable={editable}
      editableScopes={editableScopes}
      inlineProfileAssetScope={inlineProfileAssetScope}
      formData={formData}
      acrRecordId={acrRecordId}
      reviewerContext={reviewerContext}
      onReplicaStateChange={onReplicaStateChange}
    >
      {formContent}
    </InteractiveForm>
  );
}
