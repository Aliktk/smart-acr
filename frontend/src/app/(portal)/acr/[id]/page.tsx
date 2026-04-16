"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, FileText, RotateCcw, Send, ShieldCheck, X } from "lucide-react";
import { getAcrDetail, getEmployeeAcrDetail, transitionAcr, updateAcrFormData } from "@/api/client";
import { upgradeInlineReplicaAssets } from "@/components/forms";
import { AdverseRemarksPanel } from "@/components/AdverseRemarksPanel";
import { FormPreview } from "@/components/FormPreview";
import { useShell } from "@/hooks/useShell";
import { FloatingToast, OverdueBadge, PriorityBadge, StatusChip, Timeline } from "@/components/ui";
import type { AcrFormData, AcrReplicaState, AcrReviewerContext, SecretBranchDeskCode } from "@/types/contracts";
import { syncAcrSummaryCaches } from "@/utils/acr-cache";
import { getActionFormValidationMessage, getReviewerSubmissionValidationMessage } from "@/utils/acr-form-validation";
import { templateRequiresCountersigning } from "@/utils/templates";

function createEmptyReplicaState(): AcrReplicaState {
  return {
    textFields: {},
    checkFields: {},
    assetFields: {},
  };
}

const actionButtonBase =
  "group inline-flex cursor-pointer items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 [&_svg]:transition-transform hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] hover:[&_svg]:scale-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none";
const actionButtonSecondary = `${actionButtonBase} border border-[var(--fia-border,#D8DEE8)] bg-white dark:bg-slate-800 dark:border-slate-700 text-[var(--fia-text-secondary,#475569)] dark:text-slate-300`;
const actionButtonPrimary = `${actionButtonBase} bg-gradient-to-r from-[#1A1C6E] to-[#2D308F] text-white shadow-[0_4px_14px_rgba(26,28,110,0.30)] hover:shadow-[0_6px_20px_rgba(26,28,110,0.40)] hover:from-[#2D308F] hover:to-[#3D40B0]`;
const actionButtonDanger = `${actionButtonBase} bg-gradient-to-r from-[#BE123C] to-[#9F1239] text-white shadow-[0_4px_14px_rgba(190,18,60,0.28)] hover:shadow-[0_6px_20px_rgba(190,18,60,0.38)] hover:from-[#9F1239] hover:to-[#881337]`;

function sanitizePdfFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]+/g, "-").trim();
}

function getAvatarColor(name: string): string {
  const palette = ["#1A1C6E","#0095D9","#7C3AED","#BE185D","#059669","#D97706","#0891B2","#DC2626","#7E22CE","#0369A1"];
  const sum = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return palette[sum % palette.length];
}

export default function AcrDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useShell();
  const exportReplicaRef = useRef<HTMLDivElement | null>(null);
  const { data, error, isLoading } = useQuery({
    queryKey: ["acr-detail", params.id, user?.activeRoleCode],
    queryFn: () => user?.activeRoleCode === "EMPLOYEE" ? getEmployeeAcrDetail(params.id) : getAcrDetail(params.id),
    retry: false,
  });
  const [replicaStateSeed, setReplicaStateSeed] = useState<AcrReplicaState>(() => createEmptyReplicaState());
  const [replicaStateSnapshot, setReplicaStateSnapshot] = useState<AcrReplicaState>(() => createEmptyReplicaState());
  const replicaStateRef = useRef<AcrReplicaState>(createEmptyReplicaState());
  const replicaStateSnapshotRef = useRef<AcrReplicaState>(createEmptyReplicaState());
  const [formDirty, setFormDirty] = useState(false);
  const formDirtyRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pageToast, setPageToast] = useState<{ title: string; message?: string; tone?: "success" | "info" | "warning" | "danger" } | null>(null);
  const [workflowActionLocked, setWorkflowActionLocked] = useState(false);
  const [selectedDeskCode, setSelectedDeskCode] = useState<SecretBranchDeskCode | "">("");
  const [showDeskSelector, setShowDeskSelector] = useState(false);
  const [pendingReturnAction, setPendingReturnAction] = useState<{ action: string; targetLabel: string } | null>(null);
  const [returnNoteText, setReturnNoteText] = useState("");

  useEffect(() => {
    if (data?.formData?.replicaState) {
      replicaStateRef.current = data.formData.replicaState;
      replicaStateSnapshotRef.current = data.formData.replicaState;
      setReplicaStateSeed(data.formData.replicaState);
      setReplicaStateSnapshot(data.formData.replicaState);
      formDirtyRef.current = false;
      setFormDirty(false);
      setWorkflowActionLocked(false);
      return;
    }

    const nextReplicaState = createEmptyReplicaState();
    replicaStateRef.current = nextReplicaState;
    replicaStateSnapshotRef.current = nextReplicaState;
    setReplicaStateSeed(nextReplicaState);
    setReplicaStateSnapshot(nextReplicaState);
    formDirtyRef.current = false;
    setFormDirty(false);
    setWorkflowActionLocked(false);
  }, [data?.formData?.replicaState]);

  useEffect(() => {
    if (!pageToast) {
      return;
    }

    const timer = window.setTimeout(() => setPageToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pageToast]);

  useEffect(() => {
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (formDirtyRef.current) {
        event.preventDefault();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const saveFormMutation = useMutation({
    mutationFn: (formData: AcrFormData) => updateAcrFormData(params.id, formData),
    onSuccess: (updated) => {
      formDirtyRef.current = false;
      setFormDirty(false);
      setActionError(null);
      syncAcrSummaryCaches(queryClient, updated);
      setPageToast({
        title: "Form changes saved",
        message: "The latest official form updates are now stored for the next workflow holder.",
        tone: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["acr-detail", params.id] });
      queryClient.invalidateQueries({ queryKey: ["acrs"] });
    },
    onError: (error: Error) => {
      setActionError(error.message);
    },
  });

  const mutation = useMutation({
    mutationFn: (payload: { action: string; remarks?: string; formData?: AcrFormData; targetDeskCode?: SecretBranchDeskCode }) => transitionAcr(params.id, payload),
    onSuccess: (result, variables) => {
      formDirtyRef.current = false;
      setActionError(null);
      syncAcrSummaryCaches(queryClient, result);
      queryClient.invalidateQueries({ queryKey: ["acr-detail", params.id] });
      queryClient.invalidateQueries({ queryKey: ["acrs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      const nextTitle =
        variables.action === "submit_to_secret_branch"
          ? "Submitted to Secret Branch"
          : variables.action === "complete_secret_branch_review"
            ? "Secret Branch Review Completed"
            : variables.action === "verify_secret_branch"
              ? "Archived by Secret Branch"
              : variables.action === "submit_to_reporting" && (data?.workflowState === "Returned" || data?.workflowState === "Returned to Clerk")
                ? "Resubmitted to Reporting Officer"
                : variables.action === "return_to_clerk"
                  ? "Returned to Clerk"
                  : variables.action === "return_to_reporting"
                    ? "Returned to Reporting Officer"
                    : variables.action === "return_to_countersigning"
                      ? "Returned to Countersigning Officer"
                      : variables.action === "forward_to_countersigning"
                        ? "Sent to Countersigning Officer"
                        : "Submitted to Reporting Officer";
      const nextMessage =
        variables.action === "submit_to_secret_branch"
          ? "The ACR has entered the Secret Branch review queue."
          : variables.action === "complete_secret_branch_review"
            ? "The ACR has been reviewed and assigned to the selected desk for completion."
            : variables.action === "verify_secret_branch"
              ? "The record has been archived successfully."
              : variables.action === "submit_to_reporting" && (data?.workflowState === "Returned" || data?.workflowState === "Returned to Clerk")
                ? "The corrected ACR has been sent back into the workflow for reporting review."
                : variables.action === "return_to_clerk"
                  ? "The record has been returned to the clerk for correction."
                  : variables.action === "return_to_reporting"
                    ? "The record has been returned to the reporting officer for correction."
                    : variables.action === "return_to_countersigning"
                      ? "The record has been returned to the countersigning officer for correction."
                      : "The workflow owner has been updated successfully.";
      sessionStorage.setItem(
        "fia-smart-acr-flash",
        JSON.stringify({ title: nextTitle, message: nextMessage, tone: "success" }),
      );
      router.replace("/queue");
    },
    onError: (error: Error) => {
      setWorkflowActionLocked(false);
      setActionError(error.message);
    },
  });

  const workflowProgress = useMemo(() => {
    if (!data) {
      return [];
    }

    const requiresCountersigning = templateRequiresCountersigning(data.templateFamily);
    const activeState = data.workflowState;
    const reportingTouched = [
      "Pending Countersigning",
      "Pending Secret Branch Review",
      "Pending Secret Branch Verification",
      "Archived",
      "Returned to Reporting Officer",
      "Returned to Countersigning Officer",
    ].includes(activeState);
    const countersigningTouched = requiresCountersigning
      ? [
          "Pending Secret Branch Review",
          "Pending Secret Branch Verification",
          "Archived",
          "Returned to Countersigning Officer",
        ].includes(activeState)
      : false;
    const secretBranchReviewTouched = [
      "Pending Secret Branch Review",
      "Pending Secret Branch Verification",
      "Archived",
    ].includes(activeState);
    const secretBranchVerificationTouched = ["Pending Secret Branch Verification", "Archived"].includes(activeState);
    const steps = [
      { label: "Clerk Initiation", done: true },
      { label: "Reporting Officer", done: reportingTouched },
      ...(requiresCountersigning ? [{ label: "Countersigning", done: countersigningTouched }] : []),
      { label: "Secret Branch Review", done: secretBranchReviewTouched },
      { label: "AD Verification", done: secretBranchVerificationTouched },
      { label: "Archive", done: activeState === "Archived" },
    ];

    return steps;
  }, [data]);

  const requiresCountersigning = data ? templateRequiresCountersigning(data.templateFamily) : true;
  const activeRoleCode = user?.activeRoleCode;
  const canSubmitDraft =
    activeRoleCode === "CLERK" && (data?.workflowState === "Draft" || data?.workflowState === "Returned" || data?.workflowState === "Returned to Clerk");
  const canReviewAsReportingOfficer =
    activeRoleCode === "REPORTING_OFFICER" &&
    (data?.workflowState === "Pending Reporting" || data?.workflowState === "Returned to Reporting Officer");
  const canReviewAsCountersigningOfficer =
    activeRoleCode === "COUNTERSIGNING_OFFICER" &&
    (data?.workflowState === "Pending Countersigning" || data?.workflowState === "Returned to Countersigning Officer");
  const canReviewAsSecretBranch =
    activeRoleCode === "SECRET_BRANCH" &&
    data?.workflowState === "Pending Secret Branch Review" &&
    Boolean(user?.secretBranchProfile?.canVerify);
  const canVerifyAsSecretBranch =
    activeRoleCode === "SECRET_BRANCH" &&
    data?.workflowState === "Pending Secret Branch Verification" &&
    !user?.secretBranchProfile?.canVerify;
  const canReturnToClerk = canReviewAsReportingOfficer || canReviewAsCountersigningOfficer || canReviewAsSecretBranch || canVerifyAsSecretBranch;
  const canReturnToReporting = canReviewAsCountersigningOfficer || canReviewAsSecretBranch || canVerifyAsSecretBranch;
  const canReturnToCountersigning = requiresCountersigning && (canReviewAsSecretBranch || canVerifyAsSecretBranch);
  const reviewerContext: AcrReviewerContext | null = data
    ? {
        reporting: {
          name: data.reportingOfficer,
          designation: data.reportingOfficerDesignation,
          signatureAsset: data.reviewerAssets?.reporting.signature ?? null,
          stampAsset: data.reviewerAssets?.reporting.stamp ?? null,
        },
        countersigning: data.countersigningOfficer
          ? {
              name: data.countersigningOfficer,
              designation: data.countersigningOfficerDesignation ?? "Countersigning Officer",
              signatureAsset: data.reviewerAssets?.countersigning?.signature ?? null,
              stampAsset: data.reviewerAssets?.countersigning?.stamp ?? null,
            }
          : null,
      }
    : null;
  const reportingSubmissionValidation =
    canReviewAsReportingOfficer
      ? getReviewerSubmissionValidationMessage({
          scope: "reporting",
          templateFamily: data.templateFamily,
          replicaState: replicaStateSnapshot,
          reviewerContext,
        })
      : null;
  const countersigningSubmissionValidation =
    canReviewAsCountersigningOfficer
      ? getReviewerSubmissionValidationMessage({
          scope: "countersigning",
          templateFamily: data.templateFamily,
          replicaState: replicaStateSnapshot,
          reviewerContext,
        })
      : null;
  const stageValidationMessage =
    canSubmitDraft
        ? getActionFormValidationMessage({
          action: "submit_to_reporting",
          workflowState: data?.workflowState ?? "Draft",
          formData: data?.formData,
          templateFamily: data.templateFamily,
          replicaState: replicaStateSnapshot,
          reviewerContext,
        })
      : canReviewAsReportingOfficer
        ? reportingSubmissionValidation
        : canReviewAsCountersigningOfficer
          ? countersigningSubmissionValidation
          : null;

  if (error instanceof Error) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-5">
        <div className="rounded-[24px] border border-[var(--fia-danger-bg)] bg-[var(--fia-danger-bg)] px-5 py-4">
          <p className="text-base font-semibold text-[var(--fia-danger)]">This ACR is no longer available in your current workflow access.</p>
          <p className="mt-1 text-sm text-[var(--fia-danger)]">{error.message}</p>
        </div>
        <div>
          <Link href="/queue" className="inline-flex items-center gap-2 rounded-2xl border border-[var(--fia-border)] bg-[var(--card)] px-4 py-2.5 text-sm font-semibold text-[var(--fia-text-secondary)]">
            <ArrowLeft size={16} />
            Back to Queue
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return <div className="p-6 text-sm text-gray-500">Loading ACR record...</div>;
  }

  const timeline = Array.isArray(data.timeline) ? data.timeline : [];
  const isEmployeeSafeView = activeRoleCode === "EMPLOYEE";
  const isFinalizedRecord = data.workflowState === "Archived";
  const isSecretBranchView = activeRoleCode === "SECRET_BRANCH";
  const isExecutiveView = activeRoleCode === "DG" || activeRoleCode === "EXECUTIVE_VIEWER";
  const compactFinalView = isFinalizedRecord && (isSecretBranchView || isExecutiveView);
  const finalizedAt = data.completedDate ?? timeline.at(-1)?.timestamp ?? null;
  const finalStateLabel = data.workflowState === "Archived" ? "Archived in Secret Branch" : data.workflowState;

  const canEditForm =
    (activeRoleCode === "SUPER_ADMIN" || activeRoleCode === "IT_OPS") ||
    (activeRoleCode === "CLERK" && (data.workflowState === "Draft" || data.workflowState === "Returned" || data.workflowState === "Returned to Clerk")) ||
    (activeRoleCode === "REPORTING_OFFICER" && (data.workflowState === "Pending Reporting" || data.workflowState === "Returned to Reporting Officer")) ||
    (activeRoleCode === "COUNTERSIGNING_OFFICER" && (data.workflowState === "Pending Countersigning" || data.workflowState === "Returned to Countersigning Officer"));
  const editableScopes =
    activeRoleCode === "SUPER_ADMIN" || activeRoleCode === "IT_OPS"
      ? ["clerk", "reporting", "countersigning"]
      : activeRoleCode === "CLERK" && (data.workflowState === "Draft" || data.workflowState === "Returned" || data.workflowState === "Returned to Clerk")
        ? ["clerk"]
        : activeRoleCode === "REPORTING_OFFICER" && (data.workflowState === "Pending Reporting" || data.workflowState === "Returned to Reporting Officer")
          ? ["reporting"]
        : activeRoleCode === "COUNTERSIGNING_OFFICER" && (data.workflowState === "Pending Countersigning" || data.workflowState === "Returned to Countersigning Officer")
          ? ["countersigning"]
          : [];
  const inlineProfileAssetScope =
    canReviewAsReportingOfficer
      ? "reporting"
      : canReviewAsCountersigningOfficer
        ? "countersigning"
        : null;
  const formBusy = mutation.isPending || saveFormMutation.isPending || workflowActionLocked;
  const workflowMeta = data?.formData?.workflowMeta;
  const currentOwnerLabel = data.currentHolderName
    ? data.currentHolderRole
      ? `${data.currentHolderName} · ${data.currentHolderRole}`
      : data.currentHolderName
    : "Unassigned";
  const latestReturnEntry = [...timeline]
    .reverse()
    .find((entry) => entry.status === "returned" || entry.action.toLowerCase().includes("returned to"));

  if (isEmployeeSafeView) {
    return (
      <div className="mx-auto flex max-w-screen-xl flex-col gap-5 p-5">
        <div className="flex items-start gap-3">
          <Link href="/queue" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--fia-gray-200)] bg-[var(--card)] text-[var(--fia-gray-500)] shadow-sm">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[1.6rem] font-semibold text-[var(--fia-gray-900)]">{data.acrNo}</h1>
              <StatusChip status={data.status} />
            </div>
            <p className="mt-1 text-sm text-[var(--fia-text-secondary)]">{data.reportingPeriod}</p>
          </div>
        </div>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[24px] border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--fia-gray-900)]">ACR metadata</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                { label: "Name", value: data.employee.name },
                { label: "ACR number", value: data.acrNo },
                { label: "Service Number", value: data.employee.serviceNumber ?? "Not available" },
                { label: "Template family", value: data.templateFamily ?? "Not recorded" },
                { label: "Service period", value: data.servicePeriodLabel ?? data.reportingPeriod },
                { label: "Current stage", value: data.workflowState },
                { label: "Reporting officer", value: data.reportingOfficer },
                { label: "Countersigning officer", value: data.countersigningOfficer ?? "Not applicable" },
                { label: "Secret Branch", value: data.secretBranch?.status ?? "Not yet submitted" },
                { label: "Submitted to RO", value: data.submittedToReportingAt ? new Date(data.submittedToReportingAt).toLocaleDateString("en-PK") : "Pending" },
                { label: "Submitted to Secret Branch", value: data.secretBranch?.submittedAt ? new Date(data.secretBranch.submittedAt).toLocaleDateString("en-PK") : "Not yet" },
                { label: "Completed / archived", value: data.completedDate ?? data.archivedAt ?? "In progress" },
                { label: "Restricted PDF retained", value: data.hasHistoricalPdf ? "Yes" : "No" },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-[var(--fia-gray-50)] px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-text-secondary)]">{item.label}</p>
                  <p className="mt-2 text-sm font-medium text-[var(--fia-gray-900)]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--fia-gray-900)]">Workflow history</h2>
            <p className="mt-1 text-sm text-[var(--fia-text-secondary)]">Only non-confidential workflow metadata is visible here. Form contents, reporting remarks, and restricted internal comments remain hidden.</p>
            <div className="mt-4">
              <Timeline items={timeline} />
            </div>
          </div>
        </section>
      </div>
    );
  }

  async function exportReplicaAsPdf(fileName: string) {
    const exportTarget = exportReplicaRef.current;
    if (!exportTarget) {
      throw new Error("The official form replica is not ready for PDF export.");
    }

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);

    const canvas = await html2canvas(exportTarget, {
      scale: Math.min(window.devicePixelRatio || 1.5, 2),
      useCORS: true,
      backgroundColor: "#EDF2F7",
      logging: false,
      windowWidth: exportTarget.scrollWidth,
      windowHeight: exportTarget.scrollHeight,
    });

    const imageData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 6;
    const printableWidth = pageWidth - margin * 2;
    const printableHeight = pageHeight - margin * 2;
    const imageHeight = (canvas.height * printableWidth) / canvas.width;
    let remainingHeight = imageHeight;
    let offsetY = margin;

    pdf.addImage(imageData, "PNG", margin, offsetY, printableWidth, imageHeight, undefined, "FAST");
    remainingHeight -= printableHeight;

    while (remainingHeight > 0) {
      offsetY = remainingHeight - imageHeight + margin;
      pdf.addPage();
      pdf.addImage(imageData, "PNG", margin, offsetY, printableWidth, imageHeight, undefined, "FAST");
      remainingHeight -= printableHeight;
    }

    pdf.save(`${sanitizePdfFileName(fileName)}.pdf`);
  }

  async function handleExport() {
    if (!data) {
      return;
    }

    try {
      setActionError(null);
      await persistFormIfNeeded();
      const response = await fetch(`/api/acr/${params.id}/pdf`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error((await response.text()) || "Server-side PDF export is unavailable.");
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${data.acrNo.replaceAll("/", "-")}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
      setPageToast({
        title: "PDF exported",
        message: "The filled ACR form has been downloaded as a PDF.",
        tone: "success",
      });
    } catch (error) {
      try {
        await exportReplicaAsPdf(data.acrNo);
        setActionError(null);
        setPageToast({
          title: "PDF exported",
          message: "The current official form view was exported successfully.",
          tone: "success",
        });
      } catch (fallbackError) {
        const primaryMessage = error instanceof Error ? error.message : "Unable to export this ACR as PDF.";
        const fallbackMessage =
          fallbackError instanceof Error && fallbackError.message !== primaryMessage
            ? ` ${fallbackError.message}`
            : "";
        setActionError(`${primaryMessage}${fallbackMessage}`.trim());
      }
    }
  }

  function buildFormData(replicaState = replicaStateRef.current): AcrFormData {
    return {
      ...(data?.formData ?? {}),
      employeeSnapshot: data?.formData?.employeeSnapshot ?? (data?.employeeMetadataSnapshot as unknown as AcrFormData["employeeSnapshot"]) ?? null,
      replicaState,
    };
  }

  async function persistFormIfNeeded() {
    if (!canEditForm || !formDirtyRef.current) {
      return;
    }

    const normalizedReplicaState = await upgradeInlineReplicaAssets(replicaStateRef.current, params.id);
    replicaStateRef.current = normalizedReplicaState;
    replicaStateSnapshotRef.current = normalizedReplicaState;
    setReplicaStateSeed(normalizedReplicaState);
    setReplicaStateSnapshot(normalizedReplicaState);
    await saveFormMutation.mutateAsync(buildFormData(normalizedReplicaState));
  }

  async function handleWorkflowAction(payload: { action: string; remarks?: string; targetDeskCode?: SecretBranchDeskCode }) {
    try {
      if (workflowActionLocked) {
        return;
      }

      if (!data) {
        return;
      }

      setActionError(null);
      let nextReplicaState = replicaStateSnapshotRef.current;

      if (canEditForm) {
        nextReplicaState = await upgradeInlineReplicaAssets(replicaStateRef.current, params.id);
        replicaStateRef.current = nextReplicaState;
        replicaStateSnapshotRef.current = nextReplicaState;
        setReplicaStateSeed(nextReplicaState);
        setReplicaStateSnapshot(nextReplicaState);
      }

      const nextFormData = buildFormData(nextReplicaState);
      const validationMessage = getActionFormValidationMessage({
        action: payload.action,
        workflowState: data.workflowState,
        formData: nextFormData,
        templateFamily: data.templateFamily,
        replicaState: nextReplicaState,
        reviewerContext,
      });

      if (validationMessage) {
        setActionError(validationMessage);
        setPageToast({
          title: "Complete the form first",
          message: validationMessage,
          tone: "danger",
        });
        return;
      }

      setWorkflowActionLocked(true);
      await mutation.mutateAsync({
        ...payload,
        formData: canEditForm ? nextFormData : undefined,
      });
    } catch (error) {
      setWorkflowActionLocked(false);
      setActionError(error instanceof Error ? error.message : "Unable to complete this workflow action.");
    }
  }

  return (
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 p-5">
      <FloatingToast
        visible={Boolean(pageToast)}
        title={pageToast?.title ?? ""}
        message={pageToast?.message}
        tone={pageToast?.tone}
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Link href="/queue" className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--fia-gray-200)] bg-[var(--card)] text-[var(--fia-gray-500)] shadow-sm">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <span className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-[var(--fia-navy-50)] px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--fia-navy-500)] dark:text-[var(--fia-cyan)]">
              ACR Record
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[1.75rem] font-semibold leading-tight text-[var(--fia-gray-900)]">{data.acrNo}</h1>
              <StatusChip status={data.status} />
              {data.isPriority ? <PriorityBadge priority /> : null}
              {data.isOverdue ? <OverdueBadge days={data.overdueDays} /> : null}
            </div>
            <p className="mt-0.5 text-sm text-[var(--fia-text-secondary)]">
              {data.employee.name} · {data.employee.rank} · {data.reportingPeriod}
            </p>
          </div>
        </div>

      </div>
      <div className="contents">
      {!compactFinalView ? (
      <div id="acr-overview" className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_340px]">
        <section className="space-y-4">
          <div className="rounded-[24px] border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
            <div className="mb-4 -mx-4 -mt-4 rounded-t-[24px] px-4 py-3 bg-gradient-to-r from-[var(--fia-navy-50)] via-[var(--fia-gray-50)] to-transparent">
              <h2 className="text-[1.15rem] font-semibold text-[var(--fia-gray-900)]">Employee Information</h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-white shadow-md" style={{ background: getAvatarColor(data.employee.name) }}>
                {data.employee.name.charAt(0)}
              </div>
              <div>
                <p className="text-[1.3rem] font-semibold text-[var(--fia-gray-900)]">{data.employee.name}</p>
                <p className="text-sm text-[var(--fia-text-secondary)]">
                  {data.employee.rank} · BPS-{data.employee.bps} · {data.employee.serviceYears} yrs service
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-3">
              {[
                { label: "CNIC", value: data.employee.cnic },
                { label: "Mobile", value: data.employee.mobile },
                { label: "Wing", value: data.employee.wing },
                { label: "Zone", value: data.employee.zone },
                { label: "Office", value: data.employee.office },
                { label: "Posting", value: data.employee.posting },
              ].map((field) => (
                <div key={field.label}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--fia-gray-400)]">{field.label}</p>
                  <p className="mt-1.5 text-base font-medium text-[var(--fia-gray-900)]">{field.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
            <div className="mb-4 -mx-4 -mt-4 rounded-t-[24px] px-4 py-3 bg-gradient-to-r from-[var(--fia-navy-100)] via-[var(--fia-gray-50)] to-transparent flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--fia-navy-100)] text-[var(--fia-navy-500)]">
                <FileText size={18} />
              </div>
              <h2 className="text-[1.15rem] font-semibold text-[var(--fia-gray-900)]">ACR Details</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {[
                { label: "Initiated By", value: data.initiatedBy },
                { label: "Initiation Date", value: data.initiatedDate },
                { label: "Current Owner", value: currentOwnerLabel },
                { label: "Reporting Officer", value: data.reportingOfficer },
                { label: "Countersigning Officer", value: data.countersigningOfficer ?? "Not applicable" },
                { label: "Due Date", value: data.dueDate },
                { label: "Wing", value: data.wing },
                { label: "Reporting Period", value: data.reportingPeriod },
                { label: "Performance Score", value: data.performanceScore ? `${data.performanceScore}/100` : "Pending" },
              ].map((field) => (
                <div key={field.label}>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--fia-gray-400)]">{field.label}</p>
                  <p className={`mt-1.5 text-base font-medium ${field.label === "Performance Score" ? "text-[var(--fia-cyan)]" : "text-[var(--fia-gray-900)]"}`}>{field.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[24px] border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
            <h2 className="mb-4 text-[1.15rem] font-semibold text-[var(--fia-gray-900)]">Workflow Timeline</h2>
            <Timeline items={timeline} />
          </div>

          <div className="rounded-[24px] border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--fia-gray-500)]">Due Date</p>
            <p className={`mt-2 text-[1.7rem] font-semibold ${data.isOverdue ? "text-[var(--fia-danger)]" : "text-[var(--fia-gray-900)]"}`}>{data.dueDate}</p>
          </div>

          <div className="rounded-[24px] border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--fia-gray-500)]">Workflow Progress</p>
            <div className="mt-3 space-y-2.5">
              {workflowProgress.map((step) => (
                <div key={step.label} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full ${step.done ? "text-white" : "bg-[var(--fia-gray-100)] text-[var(--fia-gray-400)]"}`}
                    style={step.done ? { background: "linear-gradient(135deg,#22C55E,#16A34A)", boxShadow: "0 2px 8px rgba(34,197,94,0.3)" } : undefined}
                  >
                    {step.done ? "✓" : ""}
                  </span>
                  <span className={step.done ? "font-medium text-[var(--fia-success)]" : "text-[var(--fia-gray-500)]"}>{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      ) : (
      <div id="acr-overview" className="space-y-4">
        <section className="space-y-4">
          <div className="rounded-[24px] border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--fia-text-secondary)]">
                  {isSecretBranchView ? "Secret Branch Final Record" : "Executive Record Summary"}
                </p>
                <h2 className="mt-2 text-[1.35rem] font-semibold text-[var(--fia-gray-900)]">{data.employee.name}</h2>
                <p className="mt-1 text-sm text-[var(--fia-text-secondary)]">
                  {data.employee.rank} · {data.employee.office} · {data.reportingPeriod}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusChip status={data.status} />
                {data.isPriority ? <PriorityBadge priority /> : null}
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Final State", value: finalStateLabel },
                { label: "Finalized On", value: finalizedAt ?? "Final timeline recorded" },
                { label: "ACR No", value: data.acrNo },
                { label: "Period", value: data.reportingPeriod },
                { label: "Current Owner", value: currentOwnerLabel },
                { label: "Initiated By", value: data.initiatedBy },
                { label: "Reporting Officer", value: data.reportingOfficer },
                { label: "Countersigning Officer", value: data.countersigningOfficer ?? "Not applicable" },
                { label: "Archive Ref", value: data.archiveReference ?? "Archive snapshot stored with record" },
                { label: "Office", value: data.employee.office },
                { label: "Wing", value: data.employee.wing },
                { label: "Zone", value: data.employee.zone },
              ].map((field) => (
                <div key={field.label} className="rounded-2xl bg-[var(--fia-gray-50)] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--fia-gray-400)]">{field.label}</p>
                  <p className="mt-2 text-sm font-medium text-[var(--fia-gray-900)]">{field.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="rounded-2xl bg-[var(--fia-gray-50)] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--fia-gray-500)]">Workflow Progress</p>
                <div className="mt-3 space-y-2">
                  {workflowProgress.map((step) => (
                    <div key={step.label} className="flex items-center gap-3 text-sm">
                      <span
                        className={`flex h-5 w-5 items-center justify-center rounded-full ${step.done ? "text-white" : "bg-[var(--fia-gray-100)] text-[var(--fia-gray-400)]"}`}
                        style={step.done ? { background: "linear-gradient(135deg,#22C55E,#16A34A)", boxShadow: "0 2px 8px rgba(34,197,94,0.3)" } : undefined}
                      >
                        {step.done ? "✓" : ""}
                      </span>
                      <span className={step.done ? "font-medium text-[var(--fia-success)]" : "text-[var(--fia-text-secondary)]"}>{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-[var(--fia-gray-50)] px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--fia-gray-500)]">Workflow History</p>
                    <p className="mt-1 text-sm text-[var(--fia-text-secondary)]">Final movement and archival history from the live backend record.</p>
                  </div>
                  <StatusChip status={data.status} />
                </div>
                <Timeline items={timeline} />
              </div>
            </div>
          </div>
        </section>
      </div>
      )}

      {actionError ? (
        <div className="rounded-[18px] border border-[var(--fia-danger-bg)] bg-[var(--fia-danger-bg)] px-4 py-3 text-sm text-[var(--fia-danger)]">
          {actionError}
        </div>
      ) : null}

      {(latestReturnEntry?.remarks || data.remarks) ? (
        <div className={`rounded-[20px] px-4 py-3.5 text-sm ${
          data.workflowState.startsWith("Returned")
            ? "border border-[var(--fia-warning-bg)] bg-[var(--fia-warning-bg)] text-[var(--fia-warning)]"
            : "border border-[var(--fia-navy-100)] bg-[var(--fia-navy-50)] text-[var(--fia-text-primary)]"
        }`}>
          <div className="flex items-start gap-2">
            <RotateCcw size={15} className="mt-0.5 shrink-0" />
            <div>
              <p className={`font-semibold ${data.workflowState.startsWith("Returned") ? "text-[var(--fia-warning)]" : "text-[var(--fia-navy-500)]"}`}>
                {data.workflowState.startsWith("Returned") ? "Returned for correction" : "Previously returned — correction note"}
              </p>
              <p className="mt-1 leading-6">{latestReturnEntry?.remarks ?? data.remarks}</p>
              <p className={`mt-2 text-xs ${data.workflowState.startsWith("Returned") ? "text-[var(--fia-gray-600)]" : "text-[var(--fia-gray-600)]"}`}>
                Returned by {latestReturnEntry?.actor ?? "Workflow reviewer"} · {latestReturnEntry?.role ?? "Reviewer"} · {latestReturnEntry?.timestamp ?? "Recorded in workflow history"}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {data.hasAdverseRemarks || canReviewAsReportingOfficer ? (
        <AdverseRemarksPanel
          acrId={data.id}
          activeRoleCode={activeRoleCode ?? "EMPLOYEE"}
          workflowState={data.workflowState}
        />
      ) : null}

      {/* Secret Branch Verification Card */}
      {(data.secretBranch?.verifiedBy || data.secretBranch?.reviewedAt || canReviewAsSecretBranch || canVerifyAsSecretBranch) ? (
        <div className="rounded-[24px] border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--fia-warning-bg)] text-[var(--fia-warning)]">
              <ShieldCheck size={18} />
            </div>
            <h2 className="text-[1.15rem] font-semibold text-[var(--fia-gray-900)]">Secret Branch Verification</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              { label: "Desk Reviewer", value: data.secretBranch?.allocatedTo ?? "Pending" },
              { label: "Desk Code", value: data.secretBranch?.deskCode ?? "—" },
              { label: "Review Date", value: data.secretBranch?.reviewedAt ? new Date(data.secretBranch.reviewedAt).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" }) : "Pending" },
              { label: "Verified by (AD)", value: data.secretBranch?.verifiedBy ?? "Awaiting" },
              { label: "Verification Date", value: data.secretBranch?.verifiedAt ? new Date(data.secretBranch.verifiedAt).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" }) : "—" },
              { label: "Status", value: data.secretBranch?.verifiedBy ? "Verified" : data.secretBranch?.reviewedAt ? "Pending AD Verification" : "Pending Review" },
            ].map((field) => (
              <div key={field.label}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--fia-gray-400)]">{field.label}</p>
                <p className={`mt-1.5 text-base font-medium ${
                  field.label === "Status"
                    ? data.secretBranch?.verifiedBy ? "text-[var(--fia-success)]" : "text-[var(--fia-warning)]"
                    : "text-[var(--fia-gray-900)]"
                }`}>{field.value}</p>
              </div>
            ))}
          </div>
          {data.secretBranch?.verificationNotes ? (
            <div className="mt-3 rounded-2xl border border-[var(--fia-success-bg)] bg-[var(--fia-success-bg)] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Verification Remarks</p>
              <p className="mt-1 text-sm text-[var(--fia-gray-700)]">{data.secretBranch.verificationNotes}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {compactFinalView ? (
      <details id="digital-form-replica" className="rounded-[24px] border border-[var(--fia-gray-200)] bg-[var(--card)] shadow-sm">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[var(--fia-gray-900)]">
          Digital Form Replica
        </summary>
        <div className="border-t border-[var(--fia-gray-100)] p-4">
          <div className="overflow-x-auto rounded-[20px] bg-[#EDF2F7] dark:bg-[#0F1117] p-3">
            <div ref={exportReplicaRef} className="mx-auto w-full max-w-[1120px]">
                <FormPreview
                  templateFamily={data.templateFamily}
                  editable={canEditForm}
                editableScopes={editableScopes}
                inlineProfileAssetScope={inlineProfileAssetScope}
                acrRecordId={data.id}
                reviewerContext={reviewerContext}
                  formData={buildFormData(replicaStateSeed)}
                  onReplicaStateChange={(nextReplicaState) => {
                    replicaStateRef.current = nextReplicaState;
                    replicaStateSnapshotRef.current = nextReplicaState;
                    setReplicaStateSnapshot(nextReplicaState);
                    formDirtyRef.current = true;
                    setFormDirty((current) => (current ? current : true));
                  }}
                />
            </div>
          </div>
        </div>
      </details>
      ) : (
      <section id="digital-form-replica" className="rounded-[24px] border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[var(--fia-gray-100)] pb-3.5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[1.15rem] font-semibold text-[var(--fia-gray-900)]">Digital Form Replica</h2>
          </div>
          {workflowMeta?.lastEditedAt ? (
            <div className="rounded-2xl bg-[var(--fia-gray-50)] px-4 py-2.5 text-sm text-[var(--fia-text-secondary)]">
              <p className="font-semibold text-[var(--fia-gray-900)]">Last saved</p>
              <p className="mt-1">
                {workflowMeta.lastEditedBy ?? "System"}{workflowMeta.lastEditedRole ? ` • ${workflowMeta.lastEditedRole}` : ""}
              </p>
              <p className="text-xs text-[var(--fia-gray-500)]">{new Date(workflowMeta.lastEditedAt).toLocaleString("en-PK")}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-4 overflow-x-auto rounded-[20px] bg-[#EDF2F7] dark:bg-[#0F1117] p-3 sm:p-4 lg:p-5">
          <div ref={exportReplicaRef} className="mx-auto w-full max-w-[1120px]">
              <FormPreview
                templateFamily={data.templateFamily}
                editable={canEditForm}
              editableScopes={editableScopes}
              inlineProfileAssetScope={inlineProfileAssetScope}
              acrRecordId={data.id}
              reviewerContext={reviewerContext}
                formData={buildFormData(replicaStateSeed)}
                onReplicaStateChange={(nextReplicaState) => {
                  replicaStateRef.current = nextReplicaState;
                  replicaStateSnapshotRef.current = nextReplicaState;
                  setReplicaStateSnapshot(nextReplicaState);
                  formDirtyRef.current = true;
                  setFormDirty((current) => (current ? current : true));
                }}
              />
          </div>
        </div>
      </section>
      )}
      </div>

      <section className="portal-floating-action-bar">
        <div className="rounded-[24px] border border-[var(--fia-border)] bg-[var(--card)]/96 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 xl:justify-end">
            <Link
              href="/queue"
              className={actionButtonSecondary}
            >
              <ArrowLeft size={16} />
              Back
            </Link>

            <button
              type="button"
              onClick={handleExport}
              className={actionButtonSecondary}
            >
              <Download size={16} />
              Export PDF
            </button>
            {canEditForm ? (
              <button
                type="button"
                disabled={!formDirty || formBusy}
                onClick={() => void persistFormIfNeeded()}
                className={`${actionButtonSecondary} text-[var(--primary)]`}
              >
                <FileText size={16} />
                Save Form Changes
              </button>
            ) : null}
            {canSubmitDraft ? (
              <button
                type="button"
                disabled={formBusy}
                onClick={() => void handleWorkflowAction({ action: "submit_to_reporting" })}
                className={actionButtonPrimary}
              >
                <Send size={16} />
                {data.workflowState === "Returned" || data.workflowState === "Returned to Clerk" ? "Resubmit to Reporting Officer" : "Submit to Reporting Officer"}
              </button>
            ) : null}
            {canReviewAsReportingOfficer ? (
              <button
                type="button"
                disabled={formBusy}
                onClick={() =>
                  void handleWorkflowAction({
                    action: requiresCountersigning ? "forward_to_countersigning" : "submit_to_secret_branch",
                  })
                }
                className={actionButtonPrimary}
              >
                <Send size={16} />
                {requiresCountersigning ? "Submit to Countersigning Officer" : "Submit to Secret Branch"}
              </button>
            ) : null}
            {canReviewAsCountersigningOfficer ? (
              <button
                type="button"
                disabled={formBusy}
                onClick={() => void handleWorkflowAction({ action: "submit_to_secret_branch" })}
                className={actionButtonPrimary}
              >
                <Send size={16} />
                Submit to Secret Branch
              </button>
            ) : null}
            {canReviewAsSecretBranch ? (
              showDeskSelector ? (
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={selectedDeskCode}
                    onChange={(e) => setSelectedDeskCode(e.target.value as SecretBranchDeskCode | "")}
                    className="rounded-xl border border-[var(--fia-border)] bg-[var(--card)] px-3 py-2 text-sm font-medium text-[var(--fia-gray-900)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  >
                    <option value="">Select DA Desk</option>
                    <option value="DA1">DA1</option>
                    <option value="DA2">DA2</option>
                    <option value="DA3">DA3</option>
                    <option value="DA4">DA4</option>
                  </select>
                  <button
                    type="button"
                    disabled={formBusy || !selectedDeskCode}
                    onClick={() => {
                      if (!selectedDeskCode) return;
                      void handleWorkflowAction({
                        action: "complete_secret_branch_review",
                        targetDeskCode: selectedDeskCode,
                      });
                    }}
                    className={actionButtonPrimary}
                  >
                    <Send size={16} />
                    Verify & Assign
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDeskSelector(false); setSelectedDeskCode(""); }}
                    className={actionButtonSecondary}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={formBusy}
                  onClick={() => setShowDeskSelector(true)}
                  className={actionButtonPrimary}
                >
                  <Send size={16} />
                  Complete Secret Branch Review
                </button>
              )
            ) : null}
            {canVerifyAsSecretBranch ? (
              <button
                type="button"
                disabled={formBusy}
                onClick={() => void handleWorkflowAction({ action: "verify_secret_branch" })}
                className={actionButtonPrimary}
              >
                <Send size={16} />
                Mark Complete & Archive
              </button>
            ) : null}
            {canReturnToClerk ? (
              <button
                type="button"
                disabled={formBusy}
                onClick={() => { setPendingReturnAction({ action: "return_to_clerk", targetLabel: "Clerk" }); setReturnNoteText(""); }}
                className={actionButtonDanger}
              >
                <RotateCcw size={16} />
                Return to Clerk
              </button>
            ) : null}
            {canReturnToReporting ? (
              <button
                type="button"
                disabled={formBusy}
                onClick={() => { setPendingReturnAction({ action: "return_to_reporting", targetLabel: "Reporting Officer" }); setReturnNoteText(""); }}
                className={actionButtonDanger}
              >
                <RotateCcw size={16} />
                Return to Reporting Officer
              </button>
            ) : null}
            {canReturnToCountersigning ? (
              <button
                type="button"
                disabled={formBusy}
                onClick={() => { setPendingReturnAction({ action: "return_to_countersigning", targetLabel: "Countersigning Officer" }); setReturnNoteText(""); }}
                className={actionButtonDanger}
              >
                <RotateCcw size={16} />
                Return to Countersigning Officer
              </button>
            ) : null}
            </div>
          </div>
        </div>
        </div>
      </section>
      <div className="h-28" />

      {/* Return Note Dialog */}
      {pendingReturnAction ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(15,23,42,0.55)", backdropFilter: "blur(2px)" }}>
          <div className="w-full max-w-md rounded-[24px] border border-[var(--fia-gray-200)] bg-[var(--card)] shadow-[0_24px_64px_rgba(15,23,42,0.22)] p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--fia-danger-bg)] text-[var(--fia-danger)]">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <p className="text-[1.05rem] font-semibold text-[var(--fia-gray-900)]">
                    Return to {pendingReturnAction.targetLabel}
                  </p>
                  <p className="text-xs text-[var(--fia-text-secondary)]">
                    {data.acrNo} · {data.employee.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPendingReturnAction(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--fia-gray-400)] hover:bg-[var(--fia-gray-100)]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="rounded-2xl border border-[var(--fia-danger-bg)] bg-[var(--fia-danger-bg)] px-3 py-2.5 text-xs text-[var(--fia-danger)] mb-4">
              This ACR will be sent back to the <strong>{pendingReturnAction.targetLabel}</strong> for correction. All previously filled data will remain intact.
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">
                Return Note <span className="normal-case tracking-normal text-[var(--fia-danger)]">*</span>
              </label>
              <textarea
                value={returnNoteText}
                onChange={(e) => setReturnNoteText(e.target.value)}
                placeholder={`Explain why this ACR is being returned to the ${pendingReturnAction.targetLabel}. This note will be visible to the recipient and recorded in the workflow history.`}
                maxLength={2000}
                rows={4}
                className="w-full rounded-2xl border border-[var(--fia-border)] bg-[var(--fia-gray-50)] px-4 py-3 text-sm text-[var(--fia-gray-900)] placeholder:text-[var(--fia-gray-400)] focus:outline-none focus:ring-2 focus:ring-[var(--fia-danger-bg)] focus:border-[var(--fia-danger)] resize-none"
              />
              <p className="mt-1 text-right text-xs text-[var(--fia-gray-400)]">{returnNoteText.length} / 2000</p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingReturnAction(null)}
                className={actionButtonSecondary}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={returnNoteText.trim().length < 10 || formBusy}
                onClick={() => {
                  const action = pendingReturnAction;
                  setPendingReturnAction(null);
                  void handleWorkflowAction({ action: action.action, remarks: returnNoteText.trim() });
                }}
                className={actionButtonDanger}
              >
                <RotateCcw size={16} />
                Confirm Return
              </button>
            </div>
            {returnNoteText.trim().length > 0 && returnNoteText.trim().length < 10 ? (
              <p className="mt-2 text-center text-xs text-[var(--fia-danger)]">Note must be at least 10 characters.</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
