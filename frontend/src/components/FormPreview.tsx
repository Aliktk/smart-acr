"use client";

import {
  FormA_S121C,
  FormB_S121E,
  FormC_Inspector,
  FormD_Superintendent,
  InteractiveForm,
} from "@/components/forms";
import type { AcrFormData, AcrReplicaState, AcrReviewerContext, TemplateFamilyCode } from "@/types/contracts";

type FormPreviewProps = {
  templateFamily: TemplateFamilyCode;
  editable?: boolean;
  editableScopes?: string[];
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
    case "ASSISTANT_UDC_LDC":
    default:
      return <FormA_S121C />;
  }
}

export function FormPreview({
  templateFamily,
  editable = false,
  editableScopes,
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
      formData={formData}
      acrRecordId={acrRecordId}
      reviewerContext={reviewerContext}
      onReplicaStateChange={onReplicaStateChange}
    >
      {formContent}
    </InteractiveForm>
  );
}
