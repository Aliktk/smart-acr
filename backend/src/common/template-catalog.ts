import { LanguageMode, SecretBranchDeskCode, TemplateFamilyCode } from "@prisma/client";
import type { PrismaClient } from "@prisma/client";

type TemplateCatalogPrisma = Pick<PrismaClient, "templateVersion" | "secretBranchRoutingRule">;
type ReviewerScope = "reporting" | "countersigning";

export type TemplateCatalogEntry = {
  family: TemplateFamilyCode;
  code: string;
  version: string;
  title: string;
  label: string;
  languageMode: LanguageMode;
  requiresCountersigning: boolean;
  pageCount: number;
  reviewDeskCode: SecretBranchDeskCode;
  verificationDeskCode: SecretBranchDeskCode;
  reviewerRequirements: Record<ReviewerScope, { officialStamp: boolean }>;
};

export const TEMPLATE_CATALOG: TemplateCatalogEntry[] = [
  {
    family: TemplateFamilyCode.ASSISTANT_UDC_LDC,
    code: "S-121-C-2026",
    version: "2026.1",
    title: "Confidential Report Form for Assistants / UDC / LDC",
    label: "Assistant / UDC / LDC",
    languageMode: LanguageMode.ENGLISH,
    requiresCountersigning: true,
    pageCount: 4,
    reviewDeskCode: SecretBranchDeskCode.DA1,
    verificationDeskCode: SecretBranchDeskCode.AD_SECRET_BRANCH,
    reviewerRequirements: {
      reporting: { officialStamp: true },
      countersigning: { officialStamp: true },
    },
  },
  {
    family: TemplateFamilyCode.APS_STENOTYPIST,
    code: "S-121-E-2026",
    version: "2026.1",
    title: "Annual Restricted Report Form for APS / Stenotypist",
    label: "APS / Stenotypist",
    languageMode: LanguageMode.BILINGUAL,
    requiresCountersigning: false,
    pageCount: 8,
    reviewDeskCode: SecretBranchDeskCode.DA2,
    verificationDeskCode: SecretBranchDeskCode.AD_SECRET_BRANCH,
    reviewerRequirements: {
      reporting: { officialStamp: true },
      countersigning: { officialStamp: true },
    },
  },
  {
    family: TemplateFamilyCode.INSPECTOR_SI_ASI,
    code: "FIA-INS-2026",
    version: "2026.1",
    title: "Annual Confidential Report for Inspector / Inspector Legal / SI / ASI",
    label: "Inspector / SI / ASI",
    languageMode: LanguageMode.ENGLISH,
    requiresCountersigning: true,
    pageCount: 6,
    reviewDeskCode: SecretBranchDeskCode.DA3,
    verificationDeskCode: SecretBranchDeskCode.AD_SECRET_BRANCH,
    reviewerRequirements: {
      reporting: { officialStamp: true },
      countersigning: { officialStamp: true },
    },
  },
  {
    family: TemplateFamilyCode.SUPERINTENDENT_AINCHARGE,
    code: "S-121-B-2026",
    version: "2026.1",
    title: "Annual Restricted Report Form for Superintendent / Assistant Incharge",
    label: "Superintendent / A/Incharge",
    languageMode: LanguageMode.BILINGUAL,
    requiresCountersigning: true,
    pageCount: 4,
    reviewDeskCode: SecretBranchDeskCode.DA4,
    verificationDeskCode: SecretBranchDeskCode.AD_SECRET_BRANCH,
    reviewerRequirements: {
      reporting: { officialStamp: true },
      countersigning: { officialStamp: true },
    },
  },
  {
    family: TemplateFamilyCode.CAR_DRIVERS_DESPATCH_RIDERS,
    code: "S-121-F-2026",
    version: "2026.1",
    title: "Annual Restricted Report Form for Car Drivers / Despatch Riders",
    label: "Car Drivers / Despatch Riders",
    languageMode: LanguageMode.BILINGUAL,
    requiresCountersigning: true,
    pageCount: 7,
    reviewDeskCode: SecretBranchDeskCode.DA2,
    verificationDeskCode: SecretBranchDeskCode.AD_SECRET_BRANCH,
    reviewerRequirements: {
      reporting: { officialStamp: true },
      countersigning: { officialStamp: true },
    },
  },
  {
    family: TemplateFamilyCode.PER_17_18_OFFICERS,
    code: "PER-17-18-2026",
    version: "2026.1",
    title: "Revised PER Form for BPS 17 & 18 Officers",
    label: "BPS 17 & 18 Officers PER",
    languageMode: LanguageMode.BILINGUAL,
    requiresCountersigning: true,
    pageCount: 11,
    reviewDeskCode: SecretBranchDeskCode.DA4,
    verificationDeskCode: SecretBranchDeskCode.AD_SECRET_BRANCH,
    reviewerRequirements: {
      reporting: { officialStamp: false },
      countersigning: { officialStamp: false },
    },
  },
];

const TEMPLATE_ORDER = new Map(
  TEMPLATE_CATALOG.map((entry, index) => [entry.family, index]),
);

export function getTemplateCatalogEntry(family: TemplateFamilyCode) {
  return TEMPLATE_CATALOG.find((entry) => entry.family === family) ?? null;
}

export function templateFamilyLabel(family: TemplateFamilyCode) {
  return getTemplateCatalogEntry(family)?.label ?? family;
}

export function templateFamilyRequiresCountersigning(family: TemplateFamilyCode) {
  return getTemplateCatalogEntry(family)?.requiresCountersigning ?? true;
}

export function templateFamilyRequiresOfficialStamp(
  family: TemplateFamilyCode,
  scope: ReviewerScope,
) {
  return getTemplateCatalogEntry(family)?.reviewerRequirements[scope].officialStamp ?? true;
}

export function templateFamilySortValue(family: TemplateFamilyCode) {
  return TEMPLATE_ORDER.get(family) ?? Number.MAX_SAFE_INTEGER;
}

export async function ensureTemplateCatalog(prisma: TemplateCatalogPrisma) {
  for (const entry of TEMPLATE_CATALOG) {
    await prisma.templateVersion.upsert({
      where: { code: entry.code },
      update: {
        family: entry.family,
        version: entry.version,
        title: entry.title,
        languageMode: entry.languageMode,
        requiresCountersigning: entry.requiresCountersigning,
        pageCount: entry.pageCount,
        isActive: true,
      },
      create: {
        family: entry.family,
        code: entry.code,
        version: entry.version,
        title: entry.title,
        languageMode: entry.languageMode,
        requiresCountersigning: entry.requiresCountersigning,
        pageCount: entry.pageCount,
        isActive: true,
      },
    });

    await prisma.secretBranchRoutingRule.upsert({
      where: { templateFamily: entry.family },
      update: {
        reviewDeskCode: entry.reviewDeskCode,
        verificationDeskCode: entry.verificationDeskCode,
        isActive: true,
      },
      create: {
        templateFamily: entry.family,
        reviewDeskCode: entry.reviewDeskCode,
        verificationDeskCode: entry.verificationDeskCode,
        isActive: true,
      },
    });
  }
}
