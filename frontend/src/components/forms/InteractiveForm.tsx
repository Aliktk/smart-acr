"use client";

import { useEffect, useRef, useState } from "react";
import { getUserAssetContentUrl, uploadAcrAsset, uploadUserProfileAsset } from "@/api/client";
import type {
  AcrAssetKind,
  AcrAssetReference,
  AcrFormData,
  AcrReplicaState,
  AcrReviewerContext,
  UserAssetType,
} from "@/types/contracts";

type InteractiveFormProps = {
  children: React.ReactNode;
  editable?: boolean;
  formData?: AcrFormData | null;
  editableScopes?: string[];
  inlineProfileAssetScope?: "reporting" | "countersigning" | null;
  acrRecordId?: string;
  reviewerContext?: AcrReviewerContext | null;
  onReplicaStateChange?: (replicaState: AcrReplicaState) => void;
};

const EMPTY_REPLICA_STATE: AcrReplicaState = {
  textFields: {},
  checkFields: {},
  assetFields: {},
};

type ReplicaFieldKind = "text" | "check" | "asset";
type ReviewerScope = "reporting" | "countersigning";
type AssetFieldDescriptor = {
  key: string;
  scope: string;
  kind: AcrAssetKind;
  element: HTMLElement;
};
type RuntimeReviewerAssetMap = Partial<Record<ReviewerScope, Partial<Record<AcrAssetKind, AcrAssetReference>>>>;

const SUPPORTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const MAX_REUSABLE_ASSET_SIZE_BYTES = 2 * 1024 * 1024;

function readErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "The request could not be completed.";
  }

  try {
    const parsed = JSON.parse(error.message) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join(" ");
    }
    return parsed.message ?? error.message;
  } catch {
    return error.message;
  }
}

function toUserAssetType(kind: AcrAssetKind): UserAssetType {
  return kind === "STAMP" ? "STAMP" : "SIGNATURE";
}

function buildAssetReference(asset: {
  id: string;
  fileName: string;
  mimeType: string;
}, kind: AcrAssetKind, acrRecordId?: string) {
  return {
    url: getUserAssetContentUrl(asset.id, { acrId: acrRecordId ?? null }),
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    kind,
  } satisfies AcrAssetReference;
}

function validateReusableAssetFile(file: File) {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number])) {
    return "Please upload a JPG, PNG, or WEBP image.";
  }

  if (file.size > MAX_REUSABLE_ASSET_SIZE_BYTES) {
    return "Reusable signature and stamp files must be 2 MB or smaller.";
  }

  return null;
}

function cloneReplicaState(state?: AcrReplicaState | null): AcrReplicaState {
  return {
    textFields: { ...(state?.textFields ?? EMPTY_REPLICA_STATE.textFields) },
    checkFields: { ...(state?.checkFields ?? EMPTY_REPLICA_STATE.checkFields) },
    assetFields: { ...(state?.assetFields ?? EMPTY_REPLICA_STATE.assetFields) },
  };
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9/]+/g, " ").replace(/\s+/g, " ").trim();
}

function slugify(value: string) {
  return normalizeText(value).replace(/\s+/g, "-").slice(0, 80) || "field";
}

function readRecordString(record: unknown, key: string) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const value = (record as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function readRecordNumber(record: unknown, key: string) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const value = (record as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

function buildElementPath(root: HTMLElement, element: HTMLElement) {
  const parts: string[] = [];
  let current: HTMLElement | null = element;

  while (current && current !== root) {
    const parent: HTMLElement | null = current.parentElement;

    if (!parent) {
      break;
    }

    const index = Array.from(parent.children).indexOf(current);
    parts.unshift(`${current.tagName.toLowerCase()}:${index}`);
    current = parent;
  }

  return parts.join("/");
}

function contextTextForElement(element: HTMLElement) {
  const contextualAncestor =
    element.closest("tr") ??
    element.closest("label") ??
    element.parentElement ??
    element;

  return contextualAncestor.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function explicitFieldKind(element: HTMLElement): ReplicaFieldKind | null {
  const fieldKind = element.dataset.replicaField;

  if (fieldKind === "text" || fieldKind === "check" || fieldKind === "asset") {
    return fieldKind;
  }

  return null;
}

function explicitBinding(element: HTMLElement) {
  const binding = element.dataset.replicaBinding?.trim();
  return binding ? binding : null;
}

function explicitPrefillBinding(element: HTMLElement) {
  const binding = element.dataset.replicaPrefill?.trim();
  return binding ? binding : null;
}

function explicitCheckGroup(element: HTMLElement) {
  const group = element.dataset.replicaGroup?.trim();
  return group ? group : null;
}

function isAssetField(element: HTMLElement) {
  return explicitFieldKind(element) === "asset" || element.className.includes("signature-block") || element.className.includes("stamp-block");
}

function isCheckboxField(element: HTMLElement) {
  if (explicitFieldKind(element) === "check") {
    return true;
  }

  const className = element.className;
  return (
    (element.tagName === "DIV" || element.tagName === "SPAN") &&
    (className.includes("w-8 h-8") || className.includes("w-6 h-6") || className.includes("w-4 h-4")) &&
    (className.includes("border-2") || className.includes("border-black")) &&
    !isAssetField(element)
  );
}

function isRatingCell(element: HTMLElement) {
  if (explicitFieldKind(element) === "check") {
    return true;
  }

  const text = element.textContent?.trim() ?? "";
  return element.tagName === "TD" && element.children.length === 0 && (text === "" || text === "✓");
}

function isTextField(element: HTMLElement) {
  return explicitFieldKind(element) === "text";
}

function makeFieldKey(kind: ReplicaFieldKind, root: HTMLElement, element: HTMLElement) {
  const scope = resolveFieldScope(element);
  const binding = explicitBinding(element);

  if (binding) {
    return `${kind}:${scope}:${binding}`;
  }

  return `${kind}:${scope}:${slugify(contextTextForElement(element))}:${buildElementPath(root, element)}`;
}

function makeLegacyFieldKey(kind: ReplicaFieldKind, root: HTMLElement, element: HTMLElement) {
  return `${kind}:${slugify(contextTextForElement(element))}:${buildElementPath(root, element)}`;
}

function resolveFieldScope(element: HTMLElement) {
  return element.dataset.replicaScope ?? element.closest<HTMLElement>("[data-replica-scope]")?.dataset.replicaScope ?? "reporting";
}

function textFieldGroupIndex(element: HTMLElement) {
  const parent = element.parentElement;

  if (!parent) {
    return 0;
  }

  const siblings = Array.from(parent.children).filter((candidate): candidate is HTMLElement => candidate instanceof HTMLElement && isTextField(candidate));
  return Math.max(0, siblings.indexOf(element));
}

function textFieldGroupSize(element: HTMLElement) {
  const parent = element.parentElement;

  if (!parent) {
    return 1;
  }

  return Array.from(parent.children).filter((candidate): candidate is HTMLElement => candidate instanceof HTMLElement && isTextField(candidate)).length;
}

function applyTextValue(element: HTMLElement, value: string) {
  if (element.textContent !== value) {
    element.textContent = value;
  }

  element.style.color = "#111827";
}

function resetCheckValue(element: HTMLElement) {
  element.textContent = "";
  element.style.color = "";
  element.style.fontSize = "";
  element.style.fontWeight = "";
  element.style.display = "";
  element.style.alignItems = "";
  element.style.justifyContent = "";
}

function applyCheckValue(element: HTMLElement, checked: boolean) {
  if (!checked) {
    resetCheckValue(element);
    return;
  }

  element.textContent = "✓";
  element.style.color = "#16A34A";
  element.style.fontWeight = "700";
  element.style.display = "flex";
  element.style.alignItems = "center";
  element.style.justifyContent = "center";
  element.style.fontSize = element.className.includes("w-8") ? "20px" : element.className.includes("w-4") ? "12px" : "16px";
}

function ensureAssetPlaceholder(element: HTMLElement) {
  if (!element.dataset.placeholderHtml) {
    element.dataset.placeholderHtml = element.innerHTML;
  }
}

function clearAssetValue(element: HTMLElement) {
  ensureAssetPlaceholder(element);
  element.innerHTML = element.dataset.placeholderHtml ?? "";
  element.style.borderStyle = "dashed";
  element.style.borderColor = "transparent";
}

function extractAssetUrl(value?: AcrAssetReference | string) {
  if (!value) {
    return null;
  }

  if (typeof value !== "string" && value.fileId) {
    return `/api/file-assets/${value.fileId}`;
  }

  const rawUrl = typeof value === "string" ? value : value.url;
  const proxyMatch = rawUrl.match(/\/files\/([^/]+)\/content$/i);
  if (proxyMatch?.[1]) {
    return `/api/file-assets/${proxyMatch[1]}`;
  }

  if (/^https?:\/\//i.test(rawUrl) || rawUrl.startsWith("data:")) {
    return rawUrl;
  }

  return rawUrl;
}

function applyAssetValue(element: HTMLElement, value?: AcrAssetReference | string) {
  ensureAssetPlaceholder(element);

  const assetUrl = extractAssetUrl(value);
  if (!assetUrl) {
    clearAssetValue(element);
    return;
  }

  const alt = element.dataset.replicaAssetKind === "STAMP" || element.className.includes("stamp") ? "Official Stamp" : "Signature";
  element.textContent = "";
  const img = document.createElement("img");
  img.src = assetUrl;
  img.alt = alt;
  img.className = "h-full w-full object-contain mix-blend-multiply opacity-90";
  element.appendChild(img);
  element.style.borderStyle = "solid";
  element.style.borderColor = "transparent";
}

function formatScopeLabel(formData?: AcrFormData | null) {
  const employee = formData?.employeeSnapshot;
  return readRecordString(employee, "office") ?? null;
}

function formatZoneCircleLabel(formData?: AcrFormData | null) {
  const zoneCircle = formData?.clerkSection?.zoneCircle?.trim();
  return zoneCircle && zoneCircle.length > 0 ? zoneCircle : null;
}

function resolveBoundPrefill(binding: string, formData?: AcrFormData | null, reviewerContext?: AcrReviewerContext | null) {
  const employee = formData?.employeeSnapshot;
  const clerkSection = formData?.clerkSection;
  const normalizedBinding = normalizeText(binding).replace(/\s+/g, "-");

  switch (normalizedBinding) {
    case "office-scope-label":
      return formatScopeLabel(formData);
    case "zone-circle-sub-circle":
    case "zone-circle-subcircle":
    case "zone/circle/sub-circle":
      return formatZoneCircleLabel(formData);
    case "direct-deputationist":
      return clerkSection?.directDeputationist ?? null;
    case "reporting-period-from":
      return clerkSection?.periodFrom ?? null;
    case "reporting-period-from-year":
      return clerkSection?.periodFrom?.slice(2, 4) ?? null;
    case "reporting-period-to":
      return clerkSection?.periodTo ?? null;
    case "reporting-period-to-year":
      return clerkSection?.periodTo?.slice(2, 4) ?? null;
    case "employee-name":
      return readRecordString(employee, "name");
    case "father-name":
      return clerkSection?.fatherName ?? null;
    case "employee-designation":
      return readRecordString(employee, "designation");
    case "employee-post-held":
      return readRecordString(employee, "designation") ?? readRecordString(employee, "posting");
    case "employee-rank-grade": {
      const rank = readRecordString(employee, "rank");
      const bps = readRecordNumber(employee, "bps");
      return rank ? `${rank}${bps ? ` / BPS-${bps}` : ""}` : null;
    }
    case "employee-bps": {
      const bps = readRecordNumber(employee, "bps");
      return typeof bps === "number" ? String(bps) : null;
    }
    case "employee-joining-date":
      return readRecordString(employee, "joiningDate");
    case "training-courses":
      return clerkSection?.trainingCourses ?? null;
    case "nature-of-duties":
      return readRecordString(employee, "posting");
    case "departmental-enquiry":
      return clerkSection?.departmentalEnquiry ?? null;
    case "punishment":
      return clerkSection?.punishment ?? null;
    case "rewards":
      return clerkSection?.rewards ?? null;
    case "reporting-officer-name":
      return reviewerContext?.reporting.name ?? null;
    case "reporting-officer-designation":
      return reviewerContext?.reporting.designation ?? "Reporting Officer";
    case "countersigning-officer-name":
      return reviewerContext?.countersigning?.name ?? null;
    case "countersigning-officer-designation":
      return reviewerContext?.countersigning?.designation ?? "Countersigning Officer";
    case "reporting-date":
    case "reporting-officer-date":
    case "reporting-signature-date":
      return new Date().toISOString().slice(0, 10);
    case "countersigning-date":
    case "countersigning-officer-date":
    case "countersigning-signature-date":
    case "second-countersigning-signature-date":
    case "per1718-submission-certificate-date":
      return new Date().toISOString().slice(0, 10);
    case "drivers-date-of-birth":
      return readRecordString(employee, "dateOfBirth");
    case "per1718-personnel-number":
      return readRecordString(employee, "personnelNumber");
    case "per1718-date-of-birth":
      return readRecordString(employee, "dateOfBirth");
    case "per1718-academic-qualifications":
      return readRecordString(employee, "qualifications");
    case "per1718-service-group":
      return readRecordString(employee, "serviceGroup");
    case "reporting-period-from-day-month": {
      const from = clerkSection?.periodFrom;
      if (!from) return null;
      const parts = from.split("-");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${parts[2] ?? ""} ${monthNames[(parseInt(parts[1] ?? "0", 10) - 1)] ?? ""}`;
    }
    case "reporting-period-to-day-month": {
      const to = clerkSection?.periodTo;
      if (!to) return null;
      const parts = to.split("-");
      const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      return `${parts[2] ?? ""} ${monthNames[(parseInt(parts[1] ?? "0", 10) - 1)] ?? ""}`;
    }
    default:
      return null;
  }
}

function resolveTextPrefill(element: HTMLElement, formData?: AcrFormData | null, reviewerContext?: AcrReviewerContext | null) {
  const binding = explicitPrefillBinding(element) ?? explicitBinding(element);
  if (binding) {
    return resolveBoundPrefill(binding, formData, reviewerContext);
  }

  const employee = formData?.employeeSnapshot;
  const clerkSection = formData?.clerkSection;
  const context = normalizeText(contextTextForElement(element));
  const groupIndex = textFieldGroupIndex(element);
  const groupSize = textFieldGroupSize(element);

  if (!employee && !clerkSection) {
    return null;
  }

  if (
    context.includes("report for the period") ||
    context.includes("annual special report for the period from") ||
    context.includes("annual/special report for the period from") ||
    context.includes("for the period from")
  ) {
    if (!clerkSection?.periodFrom || !clerkSection.periodTo) {
      return null;
    }

    if (groupSize <= 2) {
      return [clerkSection.periodFrom, clerkSection.periodTo][groupIndex] ?? null;
    }

    const fromYear = clerkSection.periodFrom.slice(2, 4);
    const toYear = clerkSection.periodTo.slice(2, 4);
    return [clerkSection.periodFrom, fromYear, clerkSection.periodTo, toYear][groupIndex] ?? null;
  }

  if (context.includes("name of ministry/division/department/office")) {
    return formatScopeLabel(formData);
  }

  if (context.includes("zone/circle/sub-circle") || context.includes("zone / circle / sub circle") || context.includes("zone/circle/sub circle")) {
    return formatZoneCircleLabel(formData);
  }

  if (context.includes("direct/deputationist") || context.includes("direct / deputationist")) {
    return clerkSection?.directDeputationist ?? null;
  }

  if ((context === "name" || context.includes(" name ") || context.startsWith("name ") || context.endsWith(" name")) && !context.includes("ministry") && !context.includes("officer")) {
    return readRecordString(employee, "name");
  }

  if (context.includes("s/o") || context.includes("father") || context.includes("spouse")) {
    return clerkSection?.fatherName ?? null;
  }

  if (context.includes("date of birth")) {
    return readRecordString(employee, "dateOfBirth");
  }

  if (context.includes("designation")) {
    return readRecordString(employee, "designation");
  }

  if (context.includes("post held")) {
    return readRecordString(employee, "designation") ?? readRecordString(employee, "posting");
  }

  if (context.includes("rank/grade")) {
    const rank = readRecordString(employee, "rank");
    const bps = readRecordNumber(employee, "bps");
    return rank ? `${rank}${bps ? ` / BPS-${bps}` : ""}` : null;
  }

  if (context === "bps" || context.includes(" bs ")) {
    const bps = readRecordNumber(employee, "bps");
    return typeof bps === "number" ? String(bps) : null;
  }

  if (context.includes("date of entry into government service") || context.includes("date of entry into govt service")) {
    return readRecordString(employee, "joiningDate");
  }

  if (context.includes("qualification")) {
    return readRecordString(employee, "qualifications");
  }

  if (context.includes("training course")) {
    return clerkSection?.trainingCourses ?? null;
  }

  if (context.includes("nature of duties")) {
    return readRecordString(employee, "posting");
  }

  if (context.includes("departmental enquiry")) {
    return clerkSection?.departmentalEnquiry ?? null;
  }

  if (context.includes("punishment")) {
    return clerkSection?.punishment ?? null;
  }

  if (context.includes("reward") || context.includes("commendation") || context.includes("appreciation")) {
    return clerkSection?.rewards ?? null;
  }

  return null;
}

function getSiblingCheckElements(container: HTMLElement, element: HTMLElement) {
  const explicitGroup = explicitCheckGroup(element);

  if (explicitGroup) {
    return Array.from(container.querySelectorAll<HTMLElement>("[data-replica-kind='check']")).filter(
      (candidate) => candidate.dataset.replicaGroup === explicitGroup,
    );
  }

  const row = element.closest("tr");

  if (row) {
    return Array.from(row.querySelectorAll<HTMLElement>("[data-replica-kind='check']"));
  }

  let current: HTMLElement | null = element.parentElement;

  while (current && current !== container) {
    const candidates = Array.from(current.querySelectorAll<HTMLElement>("[data-replica-kind='check']"));

    if (candidates.length > 1 && candidates.length <= 8) {
      return candidates;
    }

    current = current.parentElement;
  }

  return [element];
}

async function readImageAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Unable to read the selected image."));
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.readAsDataURL(file);
  });
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

function assetKindForElement(element: HTMLElement): AcrAssetKind {
  if (element.dataset.replicaAssetKind === "STAMP" || element.className.includes("stamp-block")) {
    return "STAMP";
  }

  return "SIGNATURE";
}

function resolveReusableReviewerAssetValue(
  element: HTMLElement,
  reviewerContext?: AcrReviewerContext | null,
  acrRecordId?: string,
  runtimeAssets?: RuntimeReviewerAssetMap,
) {
  const scope = resolveFieldScope(element);
  const kind = assetKindForElement(element);

  if (scope === "reporting" || scope === "countersigning") {
    const runtimeAsset = runtimeAssets?.[scope]?.[kind];
    if (runtimeAsset) {
      return runtimeAsset;
    }
  }

  const reviewer = scope === "countersigning" ? reviewerContext?.countersigning : reviewerContext?.reporting;

  if (!reviewer) {
    return undefined;
  }

  const asset = kind === "STAMP" ? reviewer.stampAsset : reviewer.signatureAsset;

  if (!asset) {
    return undefined;
  }

  return buildAssetReference(asset, kind, acrRecordId);
}

function findCompatibleAssetValue(binding: string | null, state: AcrReplicaState) {
  if (!binding) {
    return undefined;
  }

  const wantsStamp = binding.includes("stamp");
  const wantsCountersigning = binding.includes("countersigning");
  const wantsReporting = binding.includes("reporting");
  const entries = Object.entries(state.assetFields);
  const compatible = entries.find(([key]) => {
    const loweredKey = key.toLowerCase();
    const assetMatches = wantsStamp ? loweredKey.includes("stamp") : loweredKey.includes("signature");
    const roleMatches = wantsCountersigning
      ? loweredKey.includes("countersigning")
      : wantsReporting
        ? loweredKey.includes("reporting")
        : true;
    return assetMatches && roleMatches;
  });

  if (compatible) {
    return compatible[1];
  }

  if (wantsCountersigning || wantsReporting) {
    return undefined;
  }

  return entries.find(([key]) => (wantsStamp ? key.toLowerCase().includes("stamp") : key.toLowerCase().includes("signature")))?.[1];
}

export async function upgradeInlineReplicaAssets(replicaState: AcrReplicaState, acrRecordId: string) {
  const nextState = cloneReplicaState(replicaState);
  const entries = Object.entries(nextState.assetFields);

  for (const [key, value] of entries) {
    if (typeof value !== "string" || !value.startsWith("data:")) {
      continue;
    }

    const kind = key.toLowerCase().includes("stamp") ? "STAMP" : "SIGNATURE";
    const uploaded = await uploadAcrAsset(acrRecordId, kind, await dataUrlToBlob(value), `${kind.toLowerCase()}-${Date.now()}.png`);
    nextState.assetFields[key] = {
      fileId: uploaded.id,
      url: uploaded.contentUrl,
      fileName: uploaded.fileName,
      mimeType: uploaded.mimeType,
      kind: uploaded.kind,
    };
  }

  return nextState;
}

export function InteractiveForm({
  children,
  editable = false,
  editableScopes,
  inlineProfileAssetScope = null,
  formData,
  acrRecordId,
  reviewerContext,
  onReplicaStateChange,
}: InteractiveFormProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<AcrReplicaState>(cloneReplicaState(formData?.replicaState));
  const onReplicaStateChangeRef = useRef(onReplicaStateChange);
  const assetFieldRegistryRef = useRef<AssetFieldDescriptor[]>([]);
  const [runtimeReviewerAssets, setRuntimeReviewerAssets] = useState<RuntimeReviewerAssetMap>({});
  const [inlineUploadBusy, setInlineUploadBusy] = useState<{
    kind: AcrAssetKind;
    mode: "profile" | "acr";
  } | null>(null);
  const [inlineUploadError, setInlineUploadError] = useState<string | null>(null);
  const [inlineUploadMessage, setInlineUploadMessage] = useState<string | null>(null);
  const [assetUiVersion, setAssetUiVersion] = useState(0);

  const editableScopesKey = editableScopes?.join("|") ?? "";
  const reviewerContextKey = [
    reviewerContext?.reporting.name ?? "",
    reviewerContext?.reporting.designation ?? "",
    reviewerContext?.reporting.signatureAsset?.id ?? "",
    reviewerContext?.reporting.stampAsset?.id ?? "",
    reviewerContext?.countersigning?.name ?? "",
    reviewerContext?.countersigning?.designation ?? "",
    reviewerContext?.countersigning?.signatureAsset?.id ?? "",
    reviewerContext?.countersigning?.stampAsset?.id ?? "",
  ].join("|");
  const runtimeReviewerAssetsKey = [
    runtimeReviewerAssets.reporting?.SIGNATURE?.url ?? "",
    runtimeReviewerAssets.reporting?.STAMP?.url ?? "",
    runtimeReviewerAssets.countersigning?.SIGNATURE?.url ?? "",
    runtimeReviewerAssets.countersigning?.STAMP?.url ?? "",
  ].join("|");
  const effectiveInlineScope =
    editable && inlineProfileAssetScope && (!editableScopes || editableScopes.includes(inlineProfileAssetScope))
      ? inlineProfileAssetScope
      : null;

  function emitReplicaState() {
    onReplicaStateChangeRef.current?.(cloneReplicaState(stateRef.current));
  }

  function bumpAssetUiVersion() {
    setAssetUiVersion((current) => current + 1);
  }

  function getAssetDescriptors(scope: ReviewerScope, kind: AcrAssetKind) {
    return assetFieldRegistryRef.current.filter((descriptor) => descriptor.scope === scope && descriptor.kind === kind);
  }

  function hasAcrAssetOverride(scope: ReviewerScope, kind: AcrAssetKind) {
    return getAssetDescriptors(scope, kind).some((descriptor) => stateRef.current.assetFields[descriptor.key] !== undefined);
  }

  function applyScopedAssetOverride(scope: ReviewerScope, kind: AcrAssetKind, value: AcrAssetReference | string) {
    const descriptors = getAssetDescriptors(scope, kind);

    descriptors.forEach((descriptor) => {
      stateRef.current.assetFields[descriptor.key] = value;
      applyAssetValue(descriptor.element, value);
    });

    emitReplicaState();
    bumpAssetUiVersion();
  }

  function clearScopedAssetOverride(scope: ReviewerScope, kind: AcrAssetKind) {
    const descriptors = getAssetDescriptors(scope, kind);

    descriptors.forEach((descriptor) => {
      delete stateRef.current.assetFields[descriptor.key];
      applyAssetValue(descriptor.element, resolveReusableReviewerAssetValue(descriptor.element, reviewerContext, acrRecordId, runtimeReviewerAssets));
    });

    emitReplicaState();
    bumpAssetUiVersion();
  }

  function resolveAssetAvailability(scope: ReviewerScope, kind: AcrAssetKind) {
    if (hasAcrAssetOverride(scope, kind)) {
      return "acr" as const;
    }

    if (runtimeReviewerAssets[scope]?.[kind]) {
      return "profile" as const;
    }

    const reviewer = scope === "countersigning" ? reviewerContext?.countersigning : reviewerContext?.reporting;
    const reusableAsset = kind === "STAMP" ? reviewer?.stampAsset : reviewer?.signatureAsset;
    return reusableAsset ? ("profile" as const) : ("missing" as const);
  }

  async function pickImageFile() {
    return new Promise<File | null>((resolve) => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = SUPPORTED_IMAGE_TYPES.join(",");
      fileInput.onchange = () => resolve(fileInput.files?.[0] ?? null);
      fileInput.click();
    });
  }

  async function handleProfileAssetUpload(kind: AcrAssetKind) {
    if (!effectiveInlineScope || kind === "DOCUMENT") {
      return;
    }

    setInlineUploadError(null);
    setInlineUploadMessage(null);

    const file = await pickImageFile();
    if (!file) {
      return;
    }

    const validationError = validateReusableAssetFile(file);
    if (validationError) {
      setInlineUploadError(validationError);
      return;
    }

    setInlineUploadBusy({ kind, mode: "profile" });

    try {
      const settings = await uploadUserProfileAsset(toUserAssetType(kind), file);
      const profileAsset = kind === "STAMP" ? settings.profile.stampAsset : settings.profile.signatureAsset;

      if (!profileAsset) {
        throw new Error("The profile asset could not be saved.");
      }

      const reusableReference = buildAssetReference(profileAsset, kind, acrRecordId);
      setRuntimeReviewerAssets((current) => ({
        ...current,
        [effectiveInlineScope]: {
          ...(current[effectiveInlineScope] ?? {}),
          [kind]: reusableReference,
        },
      }));
      applyScopedAssetOverride(effectiveInlineScope, kind, reusableReference);
      setInlineUploadMessage(
        `${kind === "STAMP" ? "Official stamp" : "Signature"} saved to profile and applied to this form.`,
      );
    } catch (error) {
      setInlineUploadError(readErrorMessage(error));
    } finally {
      setInlineUploadBusy(null);
    }
  }

  async function handleAcrOnlyAssetUpload(kind: AcrAssetKind) {
    if (!effectiveInlineScope || kind === "DOCUMENT") {
      return;
    }

    setInlineUploadError(null);
    setInlineUploadMessage(null);

    const file = await pickImageFile();
    if (!file) {
      return;
    }

    const validationError = validateReusableAssetFile(file);
    if (validationError) {
      setInlineUploadError(validationError);
      return;
    }

    setInlineUploadBusy({ kind, mode: "acr" });

    try {
      if (acrRecordId) {
        const uploaded = await uploadAcrAsset(acrRecordId, kind, file, file.name);
        applyScopedAssetOverride(effectiveInlineScope, kind, {
          fileId: uploaded.id,
          url: uploaded.contentUrl,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          kind: uploaded.kind,
        });
      } else {
        applyScopedAssetOverride(effectiveInlineScope, kind, await readImageAsDataUrl(file));
      }

      setInlineUploadMessage(`${kind === "STAMP" ? "Official stamp" : "Signature"} attached to this ACR.`);
    } catch (error) {
      setInlineUploadError(readErrorMessage(error));
    } finally {
      setInlineUploadBusy(null);
    }
  }

  useEffect(() => {
    stateRef.current = cloneReplicaState(formData?.replicaState);
    bumpAssetUiVersion();
  }, [formData?.replicaState]);

  useEffect(() => {
    onReplicaStateChangeRef.current = onReplicaStateChange;
  }, [onReplicaStateChange]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let didMigrateLegacyKeys = false;
    let didPersistPrefill = false;
    const nextAssetFieldRegistry: AssetFieldDescriptor[] = [];

    Array.from(container.querySelectorAll<HTMLElement>("span,div,td")).forEach((element) => {
      if (isTextField(element)) {
        const key = makeFieldKey("text", container, element);
        const legacyKey = makeLegacyFieldKey("text", container, element);
        const fieldEditable = editable && (!editableScopes || editableScopes.includes(resolveFieldScope(element)));
        element.dataset.replicaKind = "text";
        element.dataset.replicaKey = key;
        const isMultilineField = element.tagName === "DIV" || element.className.includes("min-h-[");

        if (isMultilineField) {
          element.style.whiteSpace = "pre-wrap";
          element.style.overflowWrap = "anywhere";
        } else {
          element.style.whiteSpace = "";
          element.style.overflowWrap = "";
        }

        if (stateRef.current.textFields[key] === undefined && stateRef.current.textFields[legacyKey] !== undefined) {
          stateRef.current.textFields[key] = stateRef.current.textFields[legacyKey];
          delete stateRef.current.textFields[legacyKey];
          didMigrateLegacyKeys = true;
        }

        const savedValue = stateRef.current.textFields[key];
        const prefillValue = savedValue !== undefined ? savedValue : resolveTextPrefill(element, formData, reviewerContext);

        if (prefillValue) {
          applyTextValue(element, prefillValue);
          if (savedValue === undefined) {
            stateRef.current.textFields[key] = prefillValue;
            didPersistPrefill = true;
          }
        } else if (savedValue === "") {
          element.textContent = "";
        }

        if (fieldEditable) {
          element.contentEditable = "true";
          element.style.outline = "none";
          element.style.cursor = "text";
          element.style.backgroundColor = "rgba(4, 157, 217, 0.05)";
          element.oninput = () => {
            const nextValue = (element.innerText ?? element.textContent ?? "").replace(/\r\n?/g, "\n");
            stateRef.current.textFields[key] = nextValue === "\n" ? "" : nextValue;
            emitReplicaState();
          };
          element.onfocus = () => {
            element.style.backgroundColor = "rgba(4, 157, 217, 0.14)";
          };
          element.onblur = () => {
            element.style.backgroundColor = "rgba(4, 157, 217, 0.05)";
            const nextValue = (element.innerText ?? element.textContent ?? "").replace(/\r\n?/g, "\n");
            stateRef.current.textFields[key] = nextValue === "\n" ? "" : nextValue;
            emitReplicaState();
          };
        } else {
          element.removeAttribute("contenteditable");
          element.style.cursor = "default";
          element.style.backgroundColor = "transparent";
          element.oninput = null;
          element.onfocus = null;
          element.onblur = null;
        }
      }

      if (isCheckboxField(element) || isRatingCell(element)) {
        const key = makeFieldKey("check", container, element);
        const legacyKey = makeLegacyFieldKey("check", container, element);
        const fieldEditable = editable && (!editableScopes || editableScopes.includes(resolveFieldScope(element)));
        element.dataset.replicaKind = "check";
        element.dataset.replicaKey = key;
        element.style.cursor = fieldEditable ? "pointer" : "default";
        element.style.backgroundColor = fieldEditable ? "rgba(4, 157, 217, 0.05)" : "transparent";

        if (stateRef.current.checkFields[key] === undefined && stateRef.current.checkFields[legacyKey] !== undefined) {
          stateRef.current.checkFields[key] = stateRef.current.checkFields[legacyKey];
          delete stateRef.current.checkFields[legacyKey];
          didMigrateLegacyKeys = true;
        }

        applyCheckValue(element, Boolean(stateRef.current.checkFields[key]));
        element.onclick = fieldEditable
          ? () => {
              const group = getSiblingCheckElements(container, element);

              group.forEach((candidate) => {
                const candidateKey = candidate.dataset.replicaKey;

                if (!candidateKey) {
                  return;
                }

                if (candidate === element) {
                  stateRef.current.checkFields[candidateKey] = true;
                  applyCheckValue(candidate, true);
                  return;
                }

                delete stateRef.current.checkFields[candidateKey];
                applyCheckValue(candidate, false);
              });

              emitReplicaState();
            }
          : null;
      }

      if (isAssetField(element)) {
        const key = makeFieldKey("asset", container, element);
        const binding = explicitBinding(element);
        const legacyKey = makeLegacyFieldKey("asset", container, element);

        if (stateRef.current.assetFields[key] === undefined && stateRef.current.assetFields[legacyKey] !== undefined) {
          stateRef.current.assetFields[key] = stateRef.current.assetFields[legacyKey];
          delete stateRef.current.assetFields[legacyKey];
          didMigrateLegacyKeys = true;
        }

        const currentAssetValue =
          stateRef.current.assetFields[key] ??
          findCompatibleAssetValue(binding, stateRef.current) ??
          resolveReusableReviewerAssetValue(element, reviewerContext, acrRecordId, runtimeReviewerAssets);
        const fieldEditable = editable && (!editableScopes || editableScopes.includes(resolveFieldScope(element)));
        const scope = resolveFieldScope(element);
        const kind = assetKindForElement(element);

        nextAssetFieldRegistry.push({ key, scope, kind, element });
        element.dataset.replicaKind = "asset";
        element.dataset.replicaKey = key;
        element.style.cursor = fieldEditable ? "pointer" : "default";
        element.style.backgroundColor = fieldEditable ? "rgba(4, 157, 217, 0.05)" : "transparent";
        applyAssetValue(element, currentAssetValue);
        element.onclick = fieldEditable
          ? async () => {
              const latestExplicitAssetValue =
                stateRef.current.assetFields[key] ??
                stateRef.current.assetFields[legacyKey] ??
                findCompatibleAssetValue(binding, stateRef.current);

              if (latestExplicitAssetValue && stateRef.current.assetFields[key] !== undefined) {
                delete stateRef.current.assetFields[key];
                delete stateRef.current.assetFields[legacyKey];
                applyAssetValue(element, resolveReusableReviewerAssetValue(element, reviewerContext, acrRecordId, runtimeReviewerAssets));
                emitReplicaState();
                bumpAssetUiVersion();
                return;
              }

              const fileInput = document.createElement("input");
              fileInput.type = "file";
              fileInput.accept = "image/png,image/jpeg,image/webp";

              fileInput.onchange = async () => {
                const file = fileInput.files?.[0];

                if (!file) {
                  return;
                }

                try {
                  const validationError = validateReusableAssetFile(file);
                  if (validationError) {
                    throw new Error(validationError);
                  }

                  if (acrRecordId) {
                    const uploaded = await uploadAcrAsset(acrRecordId, assetKindForElement(element), file, file.name);
                    stateRef.current.assetFields[key] = {
                      fileId: uploaded.id,
                      url: uploaded.contentUrl,
                      fileName: uploaded.fileName,
                      mimeType: uploaded.mimeType,
                      kind: uploaded.kind,
                    };
                  } else {
                    stateRef.current.assetFields[key] = await readImageAsDataUrl(file);
                  }

                  applyAssetValue(element, stateRef.current.assetFields[key]);
                  emitReplicaState();
                  bumpAssetUiVersion();
                } catch (error) {
                  window.alert(error instanceof Error ? error.message : "Unable to upload the selected file.");
                }
              };

              fileInput.click();
            }
          : null;
      }
    });

    assetFieldRegistryRef.current = nextAssetFieldRegistry;
    bumpAssetUiVersion();

    if (didMigrateLegacyKeys || didPersistPrefill) {
      emitReplicaState();
    }
  }, [
    acrRecordId,
    editable,
    editableScopesKey,
    formData?.clerkSection,
    formData?.employeeSnapshot,
    formData?.replicaState,
    reviewerContextKey,
    runtimeReviewerAssetsKey,
  ]);

  const signatureFieldCount = effectiveInlineScope ? getAssetDescriptors(effectiveInlineScope, "SIGNATURE").length : 0;
  const stampFieldCount = effectiveInlineScope ? getAssetDescriptors(effectiveInlineScope, "STAMP").length : 0;
  const signatureAvailability = effectiveInlineScope ? resolveAssetAvailability(effectiveInlineScope, "SIGNATURE") : "missing";
  const stampAvailability = effectiveInlineScope ? resolveAssetAvailability(effectiveInlineScope, "STAMP") : "missing";
  const showInlineSetupPanel = Boolean(effectiveInlineScope) && (signatureFieldCount > 0 || stampFieldCount > 0);
  const inlineScopeLabel = effectiveInlineScope === "countersigning" ? "Countersigning Officer" : "Reporting Officer";

  return (
    <div ref={containerRef} className="interactive-form-wrapper">
      {children}
    </div>
  );
}
