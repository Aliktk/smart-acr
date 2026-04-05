"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, FileText, Send } from "lucide-react";
import { getAcrDetail, transitionAcr, updateAcrFormData } from "@/api/client";
import { upgradeInlineReplicaAssets } from "@/components/forms";
import { FormPreview } from "@/components/FormPreview";
import { useShell } from "@/hooks/useShell";
import { FloatingToast, OverdueBadge, PriorityBadge, StatusChip, Timeline } from "@/components/ui";
import type { AcrFormData, AcrReplicaState, AcrReviewerContext } from "@/types/contracts";

function createEmptyReplicaState(): AcrReplicaState {
  return {
    textFields: {},
    checkFields: {},
    assetFields: {},
  };
}

const actionButtonBase =
  "group inline-flex cursor-pointer items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 [&_svg]:transition-transform hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] hover:[&_svg]:scale-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none";
const actionButtonSecondary = `${actionButtonBase} border border-[#D8DEE8] bg-white text-[#475569]`;
const actionButtonPrimary = `${actionButtonBase} bg-[#1A1C6E] text-white hover:bg-[#2D308F]`;
const actionButtonDanger = `${actionButtonBase} border border-[#FECACA] bg-[#FFF1F2] text-[#BE123C]`;

export default function AcrDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useShell();
  const { data, error, isLoading } = useQuery({
    queryKey: ["acr-detail", params.id],
    queryFn: () => getAcrDetail(params.id),
    retry: false,
  });
  const [replicaStateSeed, setReplicaStateSeed] = useState<AcrReplicaState>(() => createEmptyReplicaState());
  const replicaStateRef = useRef<AcrReplicaState>(createEmptyReplicaState());
  const [formDirty, setFormDirty] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pageToast, setPageToast] = useState<{ title: string; message?: string; tone?: "success" | "info" | "warning" | "danger" } | null>(null);

  useEffect(() => {
    if (data?.formData?.replicaState) {
      replicaStateRef.current = data.formData.replicaState;
      setReplicaStateSeed(data.formData.replicaState);
      setFormDirty(false);
      return;
    }

    const nextReplicaState = createEmptyReplicaState();
    replicaStateRef.current = nextReplicaState;
    setReplicaStateSeed(nextReplicaState);
    setFormDirty(false);
  }, [data?.formData?.replicaState]);

  useEffect(() => {
    if (!pageToast) {
      return;
    }

    const timer = window.setTimeout(() => setPageToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pageToast]);

  const saveFormMutation = useMutation({
    mutationFn: (formData: AcrFormData) => updateAcrFormData(params.id, formData),
    onSuccess: () => {
      setFormDirty(false);
      setActionError(null);
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
    mutationFn: (payload: { action: string; remarks?: string }) => transitionAcr(params.id, payload),
    onSuccess: (_result, variables) => {
      setActionError(null);
      queryClient.invalidateQueries({ queryKey: ["acrs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      const nextTitle =
        variables.action === "submit_to_secret_branch"
          ? "Submitted to Secret Branch"
          : variables.action === "submit_to_reporting" && data?.workflowState === "Returned"
            ? "Resubmitted to Reporting Officer"
          : variables.action === "return_to_clerk"
            ? "Returned to Clerk"
            : variables.action === "forward_to_countersigning"
              ? "Sent to Countersigning Officer"
              : "Submitted to Reporting Officer";
      const nextMessage =
        variables.action === "submit_to_secret_branch"
          ? "The finalized record has moved out of your desk and into the final branch workflow."
          : variables.action === "submit_to_reporting" && data?.workflowState === "Returned"
            ? "The corrected ACR has been sent back into the workflow for reporting review."
          : variables.action === "return_to_clerk"
            ? "The record has been returned for correction."
            : "The workflow owner has been updated successfully.";
      sessionStorage.setItem(
        "fia-smart-acr-flash",
        JSON.stringify({ title: nextTitle, message: nextMessage, tone: "success" }),
      );
      router.replace("/queue");
    },
    onError: (error: Error) => {
      setActionError(error.message);
    },
  });

  const workflowProgress = useMemo(() => {
    if (!data) {
      return [];
    }

    const requiresCountersigning = data.templateFamily !== "APS_STENOTYPIST";
    const activeState = data.workflowState;
    const completedActions = data.timeline.map((entry) => entry.action.toLowerCase());
    const touchedRoles = new Set(data.timeline.map((entry) => entry.role.toLowerCase()));
    const reportingTouched =
      activeState === "Pending Countersigning" ||
      activeState === "Archived" ||
      activeState === "Submitted to Secret Branch" ||
      touchedRoles.has("reporting officer") ||
      completedActions.some((action) => action.includes("forward to countersigning") || action.includes("submit to secret branch"));
    const countersigningTouched = requiresCountersigning
      ? activeState === "Submitted to Secret Branch" ||
        activeState === "Archived" ||
        touchedRoles.has("countersigning officer") ||
        completedActions.some((action) => action.includes("submit to secret branch"))
      : false;
    const secretBranchTouched =
      activeState === "Submitted to Secret Branch" ||
      activeState === "Archived" ||
      completedActions.some((action) => action.includes("secret branch") || action.includes("archived"));
    const steps = [
      { label: "Clerk Initiation", done: true },
      { label: "Reporting Officer", done: reportingTouched },
      ...(requiresCountersigning ? [{ label: "Countersigning", done: countersigningTouched }] : []),
      { label: "Secret Branch", done: secretBranchTouched },
    ];

    return steps;
  }, [data]);

  const requiresCountersigning = data?.templateFamily !== "APS_STENOTYPIST";
  const activeRoleCode = user?.activeRoleCode;
  const canSubmitDraft =
    activeRoleCode === "CLERK" && (data?.workflowState === "Draft" || data?.workflowState === "Returned");
  const canReviewAsReportingOfficer = activeRoleCode === "REPORTING_OFFICER" && data?.workflowState === "Pending Reporting";
  const canReviewAsCountersigningOfficer =
    activeRoleCode === "COUNTERSIGNING_OFFICER" && data?.workflowState === "Pending Countersigning";
  const canReturnToClerk = canReviewAsReportingOfficer || canReviewAsCountersigningOfficer;

  if (error instanceof Error) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 p-5">
        <div className="rounded-[24px] border border-[#FECACA] bg-[#FFF1F2] px-5 py-4">
          <p className="text-base font-semibold text-[#991B1B]">This ACR is no longer available in your current workflow access.</p>
          <p className="mt-1 text-sm text-[#B91C1C]">{error.message}</p>
        </div>
        <div>
          <Link href="/queue" className="inline-flex items-center gap-2 rounded-2xl border border-[#D8DEE8] bg-white px-4 py-2.5 text-sm font-semibold text-[#475569]">
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

  const isFinalizedRecord = data.workflowState === "Archived" || data.workflowState === "Submitted to Secret Branch";
  const isSecretBranchView = activeRoleCode === "SECRET_BRANCH";
  const isExecutiveView = activeRoleCode === "DG" || activeRoleCode === "EXECUTIVE_VIEWER";
  const compactFinalView = isFinalizedRecord && (isSecretBranchView || isExecutiveView);
  const finalizedAt = data.completedDate ?? data.timeline.at(-1)?.timestamp ?? null;
  const finalStateLabel =
    data.workflowState === "Archived" ? "Archived in Secret Branch" : "Received by Secret Branch";

  const canEditForm =
    (activeRoleCode === "SUPER_ADMIN" || activeRoleCode === "IT_OPS") ||
    (activeRoleCode === "CLERK" && (data.workflowState === "Draft" || data.workflowState === "Returned")) ||
    (activeRoleCode === "REPORTING_OFFICER" && data.workflowState === "Pending Reporting") ||
    (activeRoleCode === "COUNTERSIGNING_OFFICER" && data.workflowState === "Pending Countersigning");
  const editableScopes =
    activeRoleCode === "SUPER_ADMIN" || activeRoleCode === "IT_OPS"
      ? ["clerk", "reporting", "countersigning"]
      : activeRoleCode === "CLERK" && (data.workflowState === "Draft" || data.workflowState === "Returned")
        ? ["clerk"]
        : activeRoleCode === "REPORTING_OFFICER" && data.workflowState === "Pending Reporting"
          ? ["reporting"]
        : activeRoleCode === "COUNTERSIGNING_OFFICER" && data.workflowState === "Pending Countersigning"
          ? ["countersigning"]
          : [];
  const reviewerContext: AcrReviewerContext = {
    reporting: {
      name: data.reportingOfficer,
      designation: data.reportingOfficerDesignation,
    },
    countersigning: data.countersigningOfficer
      ? {
          name: data.countersigningOfficer,
          designation: data.countersigningOfficerDesignation ?? "Countersigning Officer",
        }
      : null,
  };
  const formBusy = mutation.isPending || saveFormMutation.isPending;
  const workflowMeta = data?.formData?.workflowMeta;
  const currentOwnerLabel = data.currentHolderName
    ? data.currentHolderRole
      ? `${data.currentHolderName} · ${data.currentHolderRole}`
      : data.currentHolderName
    : "Unassigned";
  const latestReturnEntry = [...data.timeline]
    .reverse()
    .find((entry) => entry.status === "returned" || entry.action.toLowerCase().includes("return to clerk"));

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
        throw new Error((await response.text()) || "Unable to export this ACR as PDF.");
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
      setActionError(error instanceof Error ? error.message : "Unable to export this ACR as PDF.");
    }
  }

  function buildFormData(replicaState = replicaStateRef.current): AcrFormData {
    return {
      ...(data?.formData ?? {}),
      replicaState,
    };
  }

  async function persistFormIfNeeded() {
    if (!canEditForm || !formDirty) {
      return;
    }

    const normalizedReplicaState = await upgradeInlineReplicaAssets(replicaStateRef.current, params.id);
    replicaStateRef.current = normalizedReplicaState;
    setReplicaStateSeed(normalizedReplicaState);
    await saveFormMutation.mutateAsync(buildFormData(normalizedReplicaState));
  }

  async function handleWorkflowAction(payload: { action: string; remarks?: string }) {
    try {
      setActionError(null);
      await persistFormIfNeeded();
      await mutation.mutateAsync(payload);
    } catch (error) {
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
          <Link href="/queue" className="flex h-9 w-9 items-center justify-center rounded-full border border-[#E5E7EB] bg-white text-[#6B7280] shadow-sm">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[1.75rem] font-semibold leading-tight text-[#111827]">{data.acrNo}</h1>
              <StatusChip status={data.status} />
              {data.isPriority ? <PriorityBadge priority /> : null}
              {data.isOverdue ? <OverdueBadge days={data.overdueDays} /> : null}
            </div>
            <p className="mt-0.5 text-sm text-[#6B7280]">
              {data.employee.name} · {data.employee.rank} · {data.reportingPeriod}
            </p>
          </div>
        </div>

      </div>
      <div className="contents">
      {!compactFinalView ? (
      <div id="acr-overview" className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_340px]">
        <section className="space-y-4">
          <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-[1.15rem] font-semibold text-[#111827]">Employee Information</h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1A1C6E] text-lg font-semibold text-white">
                {data.employee.name.charAt(0)}
              </div>
              <div>
                <p className="text-[1.3rem] font-semibold text-[#111827]">{data.employee.name}</p>
                <p className="text-sm text-[#6B7280]">
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
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">{field.label}</p>
                  <p className="mt-1.5 text-base font-medium text-[#111827]">{field.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#4B498C]">
                <FileText size={18} />
              </div>
              <h2 className="text-[1.15rem] font-semibold text-[#111827]">ACR Details</h2>
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
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">{field.label}</p>
                  <p className={`mt-1.5 text-base font-medium ${field.label === "Performance Score" ? "text-[#0095D9]" : "text-[#111827]"}`}>{field.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <h2 className="mb-4 text-[1.15rem] font-semibold text-[#111827]">Workflow Timeline</h2>
            <Timeline items={data.timeline} />
          </div>

          <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B7280]">Due Date</p>
            <p className="mt-2 text-[1.7rem] font-semibold text-[#111827]">{data.dueDate}</p>
          </div>

          <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B7280]">Workflow Progress</p>
            <div className="mt-3 space-y-2.5">
              {workflowProgress.map((step) => (
                <div key={step.label} className="flex items-center gap-3 text-sm">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full ${step.done ? "bg-green-100 text-green-600" : "bg-[#F4F6FB] text-[#9CA3AF]"}`}>
                    {step.done ? "✓" : ""}
                  </span>
                  <span className={step.done ? "font-medium text-[#15803D]" : "text-[#6B7280]"}>{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
      ) : (
      <div id="acr-overview" className="space-y-4">
        <section className="space-y-4">
          <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#64748B]">
                  {isSecretBranchView ? "Secret Branch Final Record" : "Executive Record Summary"}
                </p>
                <h2 className="mt-2 text-[1.35rem] font-semibold text-[#111827]">{data.employee.name}</h2>
                <p className="mt-1 text-sm text-[#64748B]">
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
                <div key={field.label} className="rounded-2xl bg-[#F8FAFC] px-3 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">{field.label}</p>
                  <p className="mt-2 text-sm font-medium text-[#111827]">{field.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="rounded-2xl bg-[#F8FAFC] px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B7280]">Workflow Progress</p>
                <div className="mt-3 space-y-2">
                  {workflowProgress.map((step) => (
                    <div key={step.label} className="flex items-center gap-3 text-sm">
                      <span className={`flex h-5 w-5 items-center justify-center rounded-full ${step.done ? "bg-green-100 text-green-600" : "bg-[#E2E8F0] text-[#94A3B8]"}`}>
                        {step.done ? "✓" : ""}
                      </span>
                      <span className={step.done ? "font-medium text-[#15803D]" : "text-[#64748B]"}>{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-[#F8FAFC] px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6B7280]">Workflow History</p>
                    <p className="mt-1 text-sm text-[#64748B]">Final movement and archival history from the live backend record.</p>
                  </div>
                  <StatusChip status={data.status} />
                </div>
                <Timeline items={data.timeline} />
              </div>
            </div>
          </div>
        </section>
      </div>
      )}

      {actionError ? (
        <div className="rounded-[18px] border border-[#FECACA] bg-[#FFF1F2] px-4 py-3 text-sm text-[#BE123C]">
          {actionError}
        </div>
      ) : null}

      {data.workflowState === "Returned" && (latestReturnEntry?.remarks || data.remarks) ? (
        <div className="rounded-[20px] border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3.5 text-sm text-[#92400E]">
          <p className="font-semibold text-[#78350F]">Returned for correction</p>
          <p className="mt-1 leading-6">{latestReturnEntry?.remarks ?? data.remarks}</p>
          <p className="mt-2 text-xs text-[#A16207]">
            Returned by {latestReturnEntry?.actor ?? "Workflow reviewer"} · {latestReturnEntry?.role ?? "Reviewer"} · {latestReturnEntry?.timestamp ?? "Recorded in workflow history"}
          </p>
        </div>
      ) : null}

      {compactFinalView ? (
      <details id="digital-form-replica" className="rounded-[24px] border border-[#E5E7EB] bg-white shadow-sm">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#111827]">
          Digital Form Replica
        </summary>
        <div className="border-t border-[#EEF2F7] p-4">
          <div className="overflow-x-auto rounded-[20px] bg-[#EDF2F7] p-3">
            <div className="mx-auto w-full max-w-[1120px]">
              <FormPreview
                templateFamily={data.templateFamily}
                editable={canEditForm}
                editableScopes={editableScopes}
                acrRecordId={data.id}
                reviewerContext={reviewerContext}
                formData={buildFormData(replicaStateSeed)}
                onReplicaStateChange={(nextReplicaState) => {
                  replicaStateRef.current = nextReplicaState;
                  setFormDirty((current) => (current ? current : true));
                }}
              />
            </div>
          </div>
        </div>
      </details>
      ) : (
      <section id="digital-form-replica" className="rounded-[24px] border border-[#E5E7EB] bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#EEF2F7] pb-3.5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-[1.15rem] font-semibold text-[#111827]">Digital Form Replica</h2>
          </div>
          {workflowMeta?.lastEditedAt ? (
            <div className="rounded-2xl bg-[#F8FAFC] px-4 py-2.5 text-sm text-[#475569]">
              <p className="font-semibold text-[#111827]">Last saved</p>
              <p className="mt-1">
                {workflowMeta.lastEditedBy ?? "System"}{workflowMeta.lastEditedRole ? ` • ${workflowMeta.lastEditedRole}` : ""}
              </p>
              <p className="text-xs text-[#64748B]">{new Date(workflowMeta.lastEditedAt).toLocaleString("en-PK")}</p>
            </div>
          ) : null}
        </div>

        <div className="mt-4 overflow-x-auto rounded-[20px] bg-[#EDF2F7] p-3 sm:p-4 lg:p-5">
          <div className="mx-auto w-full max-w-[1120px]">
            <FormPreview
              templateFamily={data.templateFamily}
              editable={canEditForm}
              editableScopes={editableScopes}
              acrRecordId={data.id}
              reviewerContext={reviewerContext}
              formData={buildFormData(replicaStateSeed)}
              onReplicaStateChange={(nextReplicaState) => {
                replicaStateRef.current = nextReplicaState;
                setFormDirty((current) => (current ? current : true));
              }}
            />
          </div>
        </div>
      </section>
      )}
      </div>

      <section className="portal-floating-action-bar">
        <div className="rounded-[24px] border border-[#D8DEE8] bg-white/96 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="min-w-0 rounded-2xl bg-[#F8FAFC] px-4 py-2.5 text-sm text-[#475569]">
            <p className="font-semibold text-[#111827]">{canEditForm ? "Editable workflow stage" : "Read-only record view"}</p>
            <p className="mt-1">
              Current owner: <span className="font-medium text-[#111827]">{currentOwnerLabel}</span>
            </p>
          </div>

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
                className={`${actionButtonSecondary} text-[#1A1C6E]`}
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
                {data.workflowState === "Returned" ? "Resubmit to Reporting Officer" : "Submit to Reporting Officer"}
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
            {canReturnToClerk ? (
              <button
                type="button"
                disabled={formBusy}
                onClick={() =>
                  void handleWorkflowAction({
                    action: "return_to_clerk",
                    remarks: "Please review and correct the clerk section before resubmission.",
                  })
                }
                className={actionButtonDanger}
              >
                Return to Clerk
              </button>
            ) : null}
            </div>
          </div>
        </div>
        </div>
      </section>
      <div className="h-28" />
    </div>
  );
}
