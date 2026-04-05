import type { TemplateFamilyCode } from "@/types/contracts";

export type ManualTemplateOption = {
  id: string;
  label: string;
  helper: string;
  rank: string;
  designation: string;
  templateFamily: TemplateFamilyCode;
  defaultBps: number;
};

export const manualTemplateOptions: ManualTemplateOption[] = [
  {
    id: "assistant",
    label: "Assistants / UDC / LDC (Form A)",
    helper: "For clerical staff including assistants, UDC, and LDC roles.",
    rank: "Upper Division Clerk",
    designation: "UDC",
    templateFamily: "ASSISTANT_UDC_LDC",
    defaultBps: 9,
  },
  {
    id: "aps",
    label: "APS / Stenotypist (Form B)",
    helper: "Bilingual APS and stenotypist form without countersigning stage.",
    rank: "Assistant Private Secretary",
    designation: "APS",
    templateFamily: "APS_STENOTYPIST",
    defaultBps: 14,
  },
  {
    id: "inspector",
    label: "Inspector / Sub-Inspector (Form C)",
    helper: "For Inspector, Inspector Legal, SI, and ASI categories.",
    rank: "Inspector",
    designation: "Investigation Officer",
    templateFamily: "INSPECTOR_SI_ASI",
    defaultBps: 16,
  },
  {
    id: "superintendent",
    label: "Superintendent / Assistant Incharge (Form D)",
    helper: "Superintendent and Assistant Incharge restricted report form.",
    rank: "Superintendent",
    designation: "Superintendent",
    templateFamily: "SUPERINTENDENT_AINCHARGE",
    defaultBps: 16,
  },
];

export function getTemplateOptionByFamily(templateFamily: TemplateFamilyCode) {
  return manualTemplateOptions.find((option) => option.templateFamily === templateFamily);
}
