import type { TemplateFamilyCode } from "@/types/contracts";

export type ReviewerScope = "reporting" | "countersigning";

export type TemplateCatalogEntry = {
  family: TemplateFamilyCode;
  formId: string;
  label: string;
  shortLabel: string;
  helper: string;
  title: string;
  code: string;
  version: string;
  languageMode: "ENGLISH" | "BILINGUAL";
  requiresCountersigning: boolean;
  pageCount: number;
  defaultBps: number;
  rank: string;
  designation: string;
  reviewerRequirements: Record<ReviewerScope, { officialStamp: boolean }>;
};

export type ManualTemplateOption = {
  id: string;
  label: string;
  helper: string;
  rank: string;
  designation: string;
  templateFamily: TemplateFamilyCode;
  defaultBps: number;
};

export const templateCatalog: TemplateCatalogEntry[] = [
  {
    family: "ASSISTANT_UDC_LDC",
    formId: "assistant",
    label: "Assistants / UDC / LDC (Form A)",
    shortLabel: "Form A",
    helper: "For clerical staff including assistants, UDC, and LDC roles.",
    title: "Confidential Report Form for Assistants / UDC / LDC",
    code: "S-121-C-2026",
    version: "2026.1",
    languageMode: "ENGLISH",
    requiresCountersigning: true,
    pageCount: 4,
    rank: "Upper Division Clerk",
    designation: "UDC",
    defaultBps: 9,
    reviewerRequirements: {
      reporting: { officialStamp: true },
      countersigning: { officialStamp: true },
    },
  },
  {
    family: "APS_STENOTYPIST",
    formId: "aps",
    label: "APS / Stenotypist (Form B)",
    shortLabel: "Form B",
    helper: "Bilingual APS and stenotypist form without countersigning stage.",
    title: "Annual Restricted Report Form for APS / Stenotypist",
    code: "S-121-E-2026",
    version: "2026.1",
    languageMode: "BILINGUAL",
    requiresCountersigning: false,
    pageCount: 8,
    rank: "Assistant Private Secretary",
    designation: "APS",
    defaultBps: 14,
    reviewerRequirements: {
      reporting: { officialStamp: true },
      countersigning: { officialStamp: true },
    },
  },
  {
    family: "INSPECTOR_SI_ASI",
    formId: "inspector",
    label: "Inspector / Sub-Inspector (Form C)",
    shortLabel: "Form C",
    helper: "For Inspector, Inspector Legal, SI, and ASI categories.",
    title: "Annual Confidential Report for Inspector / Inspector Legal / SI / ASI",
    code: "FIA-INS-2026",
    version: "2026.1",
    languageMode: "ENGLISH",
    requiresCountersigning: true,
    pageCount: 6,
    rank: "Inspector",
    designation: "Investigation Officer",
    defaultBps: 16,
    reviewerRequirements: {
      reporting: { officialStamp: true },
      countersigning: { officialStamp: true },
    },
  },
  {
    family: "SUPERINTENDENT_AINCHARGE",
    formId: "superintendent",
    label: "Superintendent / Assistant Incharge (Form D)",
    shortLabel: "Form D",
    helper: "Superintendent and Assistant Incharge restricted report form.",
    title: "Annual Restricted Report Form for Superintendent / Assistant Incharge",
    code: "S-121-B-2026",
    version: "2026.1",
    languageMode: "BILINGUAL",
    requiresCountersigning: true,
    pageCount: 4,
    rank: "Superintendent",
    designation: "Superintendent",
    defaultBps: 16,
    reviewerRequirements: {
      reporting: { officialStamp: true },
      countersigning: { officialStamp: true },
    },
  },
  {
    family: "CAR_DRIVERS_DESPATCH_RIDERS",
    formId: "drivers",
    label: "Car Drivers / Despatch Riders (Form E)",
    shortLabel: "Form E",
    helper: "Bilingual annual restricted report for car drivers and despatch riders up to BPS 16.",
    title: "Annual Restricted Report Form for Car Drivers / Despatch Riders",
    code: "S-121-F-2026",
    version: "2026.1",
    languageMode: "BILINGUAL",
    requiresCountersigning: true,
    pageCount: 7,
    rank: "Car Driver",
    designation: "Car Driver",
    defaultBps: 5,
    reviewerRequirements: {
      reporting: { officialStamp: true },
      countersigning: { officialStamp: true },
    },
  },
  {
    family: "PER_17_18_OFFICERS",
    formId: "per1718",
    label: "BPS 17 & 18 Officers PER (Form F)",
    shortLabel: "Form F",
    helper: "Print-first PER replica for BPS 17 & 18 officers with submission certificate and multi-stage assessment.",
    title: "Revised PER Form for BPS 17 & 18 Officers",
    code: "PER-17-18-2026",
    version: "2026.1",
    languageMode: "BILINGUAL",
    requiresCountersigning: true,
    pageCount: 11,
    rank: "Assistant Director",
    designation: "Officer",
    defaultBps: 17,
    reviewerRequirements: {
      reporting: { officialStamp: false },
      countersigning: { officialStamp: false },
    },
  },
];

export const templateFamilies = templateCatalog.map((entry) => entry.family);

export const manualTemplateOptions: ManualTemplateOption[] = templateCatalog.map((entry) => ({
  id: entry.formId,
  label: entry.label,
  helper: entry.helper,
  rank: entry.rank,
  designation: entry.designation,
  templateFamily: entry.family,
  defaultBps: entry.defaultBps,
}));

export const templateLabels = Object.fromEntries(
  templateCatalog.map((entry) => [entry.family, entry.label]),
) as Record<TemplateFamilyCode, string>;

export function getTemplateCatalogEntry(templateFamily: TemplateFamilyCode) {
  return templateCatalog.find((entry) => entry.family === templateFamily) ?? null;
}

export function templateRequiresCountersigning(templateFamily: TemplateFamilyCode) {
  return getTemplateCatalogEntry(templateFamily)?.requiresCountersigning ?? true;
}

export function templateRequiresOfficialStamp(templateFamily: TemplateFamilyCode, scope: ReviewerScope) {
  return getTemplateCatalogEntry(templateFamily)?.reviewerRequirements[scope].officialStamp ?? true;
}

export function getTemplateOptionByFamily(templateFamily: TemplateFamilyCode) {
  return manualTemplateOptions.find((option) => option.templateFamily === templateFamily);
}

export function suggestTemplateByBps(bps: number): TemplateFamilyCode {
  if (bps >= 17 && bps <= 18) return "PER_17_18_OFFICERS";
  if (bps >= 14 && bps <= 16) return "INSPECTOR_SI_ASI";
  if (bps >= 11 && bps <= 13) return "SUPERINTENDENT_AINCHARGE";
  if (bps >= 1 && bps <= 10) return "ASSISTANT_UDC_LDC";
  return "ASSISTANT_UDC_LDC";
}
