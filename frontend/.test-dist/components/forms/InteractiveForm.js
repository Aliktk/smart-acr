"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useRef } from "react";
import { uploadAcrAsset } from "@/api/client";
const EMPTY_REPLICA_STATE = {
    textFields: {},
    checkFields: {},
    assetFields: {},
};
function cloneReplicaState(state) {
    return {
        textFields: { ...(state?.textFields ?? EMPTY_REPLICA_STATE.textFields) },
        checkFields: { ...(state?.checkFields ?? EMPTY_REPLICA_STATE.checkFields) },
        assetFields: { ...(state?.assetFields ?? EMPTY_REPLICA_STATE.assetFields) },
    };
}
function normalizeText(value) {
    return value.toLowerCase().replace(/[^a-z0-9/]+/g, " ").replace(/\s+/g, " ").trim();
}
function slugify(value) {
    return normalizeText(value).replace(/\s+/g, "-").slice(0, 80) || "field";
}
function readRecordString(record, key) {
    if (!record || typeof record !== "object") {
        return null;
    }
    const value = record[key];
    return typeof value === "string" && value.trim().length > 0 ? value : null;
}
function readRecordNumber(record, key) {
    if (!record || typeof record !== "object") {
        return null;
    }
    const value = record[key];
    return typeof value === "number" ? value : null;
}
function buildElementPath(root, element) {
    const parts = [];
    let current = element;
    while (current && current !== root) {
        const parent = current.parentElement;
        if (!parent) {
            break;
        }
        const index = Array.from(parent.children).indexOf(current);
        parts.unshift(`${current.tagName.toLowerCase()}:${index}`);
        current = parent;
    }
    return parts.join("/");
}
function contextTextForElement(element) {
    const contextualAncestor = element.closest("tr") ??
        element.closest("label") ??
        element.parentElement ??
        element;
    return contextualAncestor.textContent?.replace(/\s+/g, " ").trim() ?? "";
}
function explicitFieldKind(element) {
    const fieldKind = element.dataset.replicaField;
    if (fieldKind === "text" || fieldKind === "check" || fieldKind === "asset") {
        return fieldKind;
    }
    return null;
}
function explicitBinding(element) {
    const binding = element.dataset.replicaBinding?.trim();
    return binding ? binding : null;
}
function isAssetField(element) {
    return explicitFieldKind(element) === "asset" || element.className.includes("signature-block") || element.className.includes("stamp-block");
}
function isCheckboxField(element) {
    if (explicitFieldKind(element) === "check") {
        return true;
    }
    const className = element.className;
    return ((element.tagName === "DIV" || element.tagName === "SPAN") &&
        (className.includes("w-8 h-8") || className.includes("w-6 h-6") || className.includes("w-4 h-4")) &&
        (className.includes("border-2") || className.includes("border-black")) &&
        !isAssetField(element));
}
function isRatingCell(element) {
    if (explicitFieldKind(element) === "check") {
        return true;
    }
    const text = element.textContent?.trim() ?? "";
    return element.tagName === "TD" && element.children.length === 0 && (text === "" || text === "✓");
}
function isTextField(element) {
    return explicitFieldKind(element) === "text";
}
function makeFieldKey(kind, root, element) {
    const scope = resolveFieldScope(element);
    const binding = explicitBinding(element);
    if (binding) {
        return `${kind}:${scope}:${binding}`;
    }
    return `${kind}:${slugify(contextTextForElement(element))}:${buildElementPath(root, element)}`;
}
function makeLegacyFieldKey(kind, root, element) {
    return `${kind}:${slugify(contextTextForElement(element))}:${buildElementPath(root, element)}`;
}
function resolveFieldScope(element) {
    return element.dataset.replicaScope ?? element.closest("[data-replica-scope]")?.dataset.replicaScope ?? "reporting";
}
function textFieldGroupIndex(element) {
    const parent = element.parentElement;
    if (!parent) {
        return 0;
    }
    const siblings = Array.from(parent.children).filter((candidate) => candidate instanceof HTMLElement && isTextField(candidate));
    return Math.max(0, siblings.indexOf(element));
}
function textFieldGroupSize(element) {
    const parent = element.parentElement;
    if (!parent) {
        return 1;
    }
    return Array.from(parent.children).filter((candidate) => candidate instanceof HTMLElement && isTextField(candidate)).length;
}
function applyTextValue(element, value) {
    if (element.textContent !== value) {
        element.textContent = value;
    }
    element.style.color = "#111827";
}
function resetCheckValue(element) {
    element.textContent = "";
    element.style.color = "";
    element.style.fontSize = "";
    element.style.fontWeight = "";
    element.style.display = "";
    element.style.alignItems = "";
    element.style.justifyContent = "";
}
function applyCheckValue(element, checked) {
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
function ensureAssetPlaceholder(element) {
    if (!element.dataset.placeholderHtml) {
        element.dataset.placeholderHtml = element.innerHTML;
    }
}
function clearAssetValue(element) {
    ensureAssetPlaceholder(element);
    element.innerHTML = element.dataset.placeholderHtml ?? "";
    element.style.borderStyle = "dashed";
    element.style.borderColor = "transparent";
}
function extractAssetUrl(value) {
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
function applyAssetValue(element, value) {
    ensureAssetPlaceholder(element);
    const assetUrl = extractAssetUrl(value);
    if (!assetUrl) {
        clearAssetValue(element);
        return;
    }
    const alt = element.dataset.replicaAssetKind === "STAMP" || element.className.includes("stamp") ? "Official Stamp" : "Signature";
    element.innerHTML = `<img src="${assetUrl}" class="h-full w-full object-contain mix-blend-multiply opacity-90" alt="${alt}" />`;
    element.style.borderStyle = "solid";
    element.style.borderColor = "transparent";
}
function formatScopeLabel(formData) {
    const employee = formData?.employeeSnapshot;
    return readRecordString(employee, "office") ?? null;
}
function formatZoneCircleLabel(formData) {
    const zoneCircle = formData?.clerkSection?.zoneCircle?.trim();
    return zoneCircle && zoneCircle.length > 0 ? zoneCircle : null;
}
function resolveBoundPrefill(binding, formData, reviewerContext) {
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
        default:
            return null;
    }
}
function resolveTextPrefill(element, formData, reviewerContext) {
    const binding = explicitBinding(element);
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
    if (context.includes("report for the period") ||
        context.includes("annual special report for the period from") ||
        context.includes("annual/special report for the period from") ||
        context.includes("for the period from")) {
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
    if ((context.includes(" name ") || context.startsWith("name ") || context.endsWith(" name")) && !context.includes("ministry") && !context.includes("officer")) {
        return readRecordString(employee, "name");
    }
    if (context.includes("s/o") || context.includes("father") || context.includes("spouse")) {
        return clerkSection?.fatherName ?? null;
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
function getSiblingCheckElements(container, element) {
    const row = element.closest("tr");
    if (row) {
        return Array.from(row.querySelectorAll("[data-replica-kind='check']"));
    }
    let current = element.parentElement;
    while (current && current !== container) {
        const candidates = Array.from(current.querySelectorAll("[data-replica-kind='check']"));
        if (candidates.length > 1 && candidates.length <= 8) {
            return candidates;
        }
        current = current.parentElement;
    }
    return [element];
}
async function readImageAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Unable to read the selected image."));
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.readAsDataURL(file);
    });
}
async function dataUrlToBlob(dataUrl) {
    const response = await fetch(dataUrl);
    return response.blob();
}
function assetKindForElement(element) {
    if (element.dataset.replicaAssetKind === "STAMP" || element.className.includes("stamp-block")) {
        return "STAMP";
    }
    return "SIGNATURE";
}
function findCompatibleAssetValue(binding, state) {
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
export async function upgradeInlineReplicaAssets(replicaState, acrRecordId) {
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
export function InteractiveForm({ children, editable = false, editableScopes, formData, acrRecordId, reviewerContext, onReplicaStateChange, }) {
    const containerRef = useRef(null);
    const stateRef = useRef(cloneReplicaState(formData?.replicaState));
    useEffect(() => {
        stateRef.current = cloneReplicaState(formData?.replicaState);
    }, [formData?.replicaState]);
    useEffect(() => {
        const container = containerRef.current;
        if (!container) {
            return;
        }
        const emitReplicaState = () => onReplicaStateChange?.(cloneReplicaState(stateRef.current));
        Array.from(container.querySelectorAll("span,div,td")).forEach((element) => {
            if (isTextField(element)) {
                const key = makeFieldKey("text", container, element);
                const legacyKey = explicitBinding(element) ? makeLegacyFieldKey("text", container, element) : null;
                const fieldEditable = editable && (!editableScopes || editableScopes.includes(resolveFieldScope(element)));
                element.dataset.replicaKind = "text";
                element.dataset.replicaKey = key;
                const savedValue = stateRef.current.textFields[key] ?? (legacyKey ? stateRef.current.textFields[legacyKey] : undefined);
                const prefillValue = savedValue !== undefined ? savedValue : resolveTextPrefill(element, formData, reviewerContext);
                if (prefillValue) {
                    applyTextValue(element, prefillValue);
                }
                else if (savedValue === "") {
                    element.textContent = "";
                }
                if (fieldEditable) {
                    element.contentEditable = "true";
                    element.style.outline = "none";
                    element.style.cursor = "text";
                    element.style.backgroundColor = "rgba(4, 157, 217, 0.05)";
                    element.oninput = () => {
                        stateRef.current.textFields[key] = element.textContent ?? "";
                        emitReplicaState();
                    };
                    element.onfocus = () => {
                        element.style.backgroundColor = "rgba(4, 157, 217, 0.14)";
                    };
                    element.onblur = () => {
                        element.style.backgroundColor = "rgba(4, 157, 217, 0.05)";
                        stateRef.current.textFields[key] = element.textContent ?? "";
                        emitReplicaState();
                    };
                }
                else {
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
                const legacyKey = explicitBinding(element) ? makeLegacyFieldKey("check", container, element) : null;
                const fieldEditable = editable && (!editableScopes || editableScopes.includes(resolveFieldScope(element)));
                element.dataset.replicaKind = "check";
                element.dataset.replicaKey = key;
                element.style.cursor = fieldEditable ? "pointer" : "default";
                element.style.backgroundColor = fieldEditable ? "rgba(4, 157, 217, 0.05)" : "transparent";
                applyCheckValue(element, Boolean(stateRef.current.checkFields[key] ?? (legacyKey ? stateRef.current.checkFields[legacyKey] : undefined)));
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
                const legacyKey = explicitBinding(element) ? makeLegacyFieldKey("asset", container, element) : null;
                const currentAssetValue = stateRef.current.assetFields[key] ??
                    (legacyKey ? stateRef.current.assetFields[legacyKey] : undefined) ??
                    findCompatibleAssetValue(binding, stateRef.current);
                const fieldEditable = editable && (!editableScopes || editableScopes.includes(resolveFieldScope(element)));
                element.dataset.replicaKind = "asset";
                element.dataset.replicaKey = key;
                element.style.cursor = fieldEditable ? "pointer" : "default";
                element.style.backgroundColor = fieldEditable ? "rgba(4, 157, 217, 0.05)" : "transparent";
                applyAssetValue(element, currentAssetValue);
                element.onclick = fieldEditable
                    ? async () => {
                        const latestAssetValue = stateRef.current.assetFields[key] ??
                            (legacyKey ? stateRef.current.assetFields[legacyKey] : undefined) ??
                            findCompatibleAssetValue(binding, stateRef.current);
                        if (latestAssetValue) {
                            delete stateRef.current.assetFields[key];
                            if (legacyKey) {
                                delete stateRef.current.assetFields[legacyKey];
                            }
                            applyAssetValue(element);
                            emitReplicaState();
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
                                if (acrRecordId) {
                                    const uploaded = await uploadAcrAsset(acrRecordId, assetKindForElement(element), file, file.name);
                                    stateRef.current.assetFields[key] = {
                                        fileId: uploaded.id,
                                        url: uploaded.contentUrl,
                                        fileName: uploaded.fileName,
                                        mimeType: uploaded.mimeType,
                                        kind: uploaded.kind,
                                    };
                                }
                                else {
                                    stateRef.current.assetFields[key] = await readImageAsDataUrl(file);
                                }
                                applyAssetValue(element, stateRef.current.assetFields[key]);
                                emitReplicaState();
                            }
                            catch (error) {
                                window.alert(error instanceof Error ? error.message : "Unable to upload the selected file.");
                            }
                        };
                        fileInput.click();
                    }
                    : null;
            }
        });
    }, [acrRecordId, editable, editableScopes, formData?.clerkSection, formData?.employeeSnapshot, onReplicaStateChange, reviewerContext]);
    return (_jsx("div", { ref: containerRef, className: "interactive-form-wrapper", children: children }));
}
