"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Building2, CalendarRange, ChevronDown, ExternalLink, FilePenLine, FileUp, Hash, History, Layers3, MapPin, MessageSquare, RefreshCw, Search, ShieldCheck, SlidersHorizontal, Tag, Trash2, UserSearch, X } from "lucide-react";
import {
  deleteHistoricalArchive,
  getArchiveRecords,
  getEmployees,
  getOrganizationMasterData,
  toAbsoluteApiUrl,
  updateHistoricalArchiveMetadata,
  uploadHistoricalArchive,
  verifyHistoricalArchive,
} from "@/api/client";
import { EmptyState, PortalPageHeader, PortalSurface } from "@/components/portal/PortalPrimitives";
import { FloatingToast, StatCard } from "@/components/ui";
import { useShell } from "@/hooks/useShell";
import type { ArchiveRecordSource, ArchiveRecordSummary, OrgScopeTrack, TemplateFamilyCode } from "@/types/contracts";
import { getTemplateOptionByFamily, templateFamilies } from "@/utils/templates";

const MAX_ARCHIVE_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function sourceLabel(source: ArchiveRecordSource) {
  return source === "HISTORICAL_UPLOAD" ? "Historical upload" : "Workflow final";
}

type HistoricalUploadForm = {
  employeeId: string;
  templateFamily: TemplateFamilyCode;
  reportingPeriodFrom: string;
  reportingPeriodTo: string;
  archiveReference: string;
  remarks: string;
  file: File | null;
};

type HistoricalMetadataForm = {
  templateFamily: TemplateFamilyCode;
  reportingPeriodFrom: string;
  reportingPeriodTo: string;
  archiveReference: string;
  remarks: string;
};

type PageToast = {
  title: string;
  message?: string;
  tone?: "success" | "info" | "warning" | "danger";
};

const initialUploadForm = (): HistoricalUploadForm => ({
  employeeId: "",
  templateFamily: "ASSISTANT_UDC_LDC",
  reportingPeriodFrom: "",
  reportingPeriodTo: "",
  archiveReference: "",
  remarks: "",
  file: null,
});

const initialMetadataForm = (): HistoricalMetadataForm => ({
  templateFamily: "ASSISTANT_UDC_LDC",
  reportingPeriodFrom: "",
  reportingPeriodTo: "",
  archiveReference: "",
  remarks: "",
});

function templateLabel(templateFamily?: TemplateFamilyCode | null) {
  if (!templateFamily) {
    return "Not recorded";
  }

  return getTemplateOptionByFamily(templateFamily)?.label ?? templateFamily;
}

function buildMetadataForm(record: ArchiveRecordSummary): HistoricalMetadataForm {
  return {
    templateFamily: record.templateFamily ?? "ASSISTANT_UDC_LDC",
    reportingPeriodFrom: record.reportingPeriodFrom ?? "",
    reportingPeriodTo: record.reportingPeriodTo ?? "",
    archiveReference: record.archiveReference ?? "",
    remarks: record.remarks ?? "",
  };
}

function validateHistoricalInput(form: {
  reportingPeriodFrom?: string;
  reportingPeriodTo?: string;
  file?: File | null;
}) {
  if (form.reportingPeriodFrom && form.reportingPeriodTo && form.reportingPeriodFrom > form.reportingPeriodTo) {
    return "Reporting period start date cannot be later than the end date.";
  }

  if (!form.file) {
    return null;
  }

  if (form.file.type && form.file.type !== "application/pdf") {
    return "Only PDF files can be uploaded as historical ACRs.";
  }

  if (form.file.size > MAX_ARCHIVE_FILE_SIZE_BYTES) {
    return "Historical PDFs must be 10 MB or smaller.";
  }

  return null;
}

export default function ArchivePage() {
  const queryClient = useQueryClient();
  const { user } = useShell();
  const [query, setQuery] = useState("");
  const [source, setSource] = useState<"" | ArchiveRecordSource>("");
  const [templateFamilyFilter, setTemplateFamilyFilter] = useState<"" | TemplateFamilyCode>("");
  const [scopeTrack, setScopeTrack] = useState<"" | OrgScopeTrack>("");
  const [regionId, setRegionId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [uploadForm, setUploadForm] = useState<HistoricalUploadForm>(initialUploadForm);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<HistoricalMetadataForm>(initialMetadataForm);
  const [pageToast, setPageToast] = useState<PageToast | null>(null);
  const deferredQuery = useDeferredValue(query.trim());
  const deferredEmployeeQuery = useDeferredValue(employeeQuery.trim());

  const canManageArchive = user?.activeRoleCode === "SECRET_BRANCH" || user?.activeRoleCode === "SUPER_ADMIN" || user?.activeRoleCode === "IT_OPS";
  const isEmployee = user?.activeRoleCode === "EMPLOYEE";

  useEffect(() => {
    if (!pageToast) {
      return;
    }

    const timer = window.setTimeout(() => setPageToast(null), 4500);
    return () => window.clearTimeout(timer);
  }, [pageToast]);

  const organizationQuery = useQuery({
    queryKey: ["archive-org-master-data"],
    queryFn: getOrganizationMasterData,
  });

  const archiveQuery = useQuery({
    queryKey: ["archive-records", deferredQuery, source, templateFamilyFilter, scopeTrack, regionId, zoneId, officeId],
    queryFn: () => getArchiveRecords({
      query: deferredQuery || undefined,
      source: source || undefined,
      templateFamily: templateFamilyFilter || undefined,
      scopeTrack: scopeTrack || undefined,
      regionId: regionId || undefined,
      zoneId: zoneId || undefined,
      officeId: officeId || undefined,
    }),
  });

  const employeesQuery = useQuery({
    queryKey: ["archive-upload-employees", deferredEmployeeQuery],
    queryFn: () => getEmployees(deferredEmployeeQuery || undefined),
    enabled: canManageArchive,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const validationError = validateHistoricalInput(uploadForm);
      if (validationError) {
        throw new Error(validationError);
      }

      if (!uploadForm.file) {
        throw new Error("Please attach a PDF file.");
      }

      return uploadHistoricalArchive({
        employeeId: uploadForm.employeeId,
        templateFamily: uploadForm.templateFamily,
        reportingPeriodFrom: uploadForm.reportingPeriodFrom || undefined,
        reportingPeriodTo: uploadForm.reportingPeriodTo || undefined,
        archiveReference: uploadForm.archiveReference || undefined,
        remarks: uploadForm.remarks || undefined,
        file: uploadForm.file,
        fileName: uploadForm.file.name,
      });
    },
    onSuccess: async (record) => {
      setUploadForm(initialUploadForm());
      setPageToast({
        title: "Historical record uploaded",
        message: `${record.employeeName} is now linked to the uploaded legacy PDF.`,
        tone: "success",
      });
      await queryClient.invalidateQueries({ queryKey: ["archive-records"] });
    },
    onError: (error: Error) => {
      setPageToast({
        title: "Upload could not be completed",
        message: error.message,
        tone: "danger",
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: HistoricalMetadataForm }) =>
      updateHistoricalArchiveMetadata(id, {
        templateFamily: payload.templateFamily,
        reportingPeriodFrom: payload.reportingPeriodFrom || undefined,
        reportingPeriodTo: payload.reportingPeriodTo || undefined,
        archiveReference: payload.archiveReference || undefined,
        remarks: payload.remarks || undefined,
      }),
    onSuccess: async (record) => {
      setEditingRecordId(null);
      setEditForm(initialMetadataForm());
      setPageToast({
        title: "Historical metadata updated",
        message: `${record.employeeName}'s archive record was updated successfully.`,
        tone: "success",
      });
      await queryClient.invalidateQueries({ queryKey: ["archive-records"] });
    },
    onError: (error: Error) => {
      setPageToast({
        title: "Metadata update failed",
        message: error.message,
        tone: "danger",
      });
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => verifyHistoricalArchive(id, "Historical record verified by Secret Branch."),
    onSuccess: async (record) => {
      setPageToast({
        title: "Historical record verified",
        message: `${record.employeeName}'s uploaded archive record is now marked as verified.`,
        tone: "success",
      });
      await queryClient.invalidateQueries({ queryKey: ["archive-records"] });
    },
    onError: (error: Error) => {
      setPageToast({
        title: "Verification failed",
        message: error.message,
        tone: "danger",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }: { id: string }) => deleteHistoricalArchive(id),
    onSuccess: async () => {
      setEditingRecordId(null);
      setEditForm(initialMetadataForm());
      setPageToast({
        title: "Historical record deleted",
        message: "The uploaded legacy PDF and its historical archive index entry were removed.",
        tone: "success",
      });
      await queryClient.invalidateQueries({ queryKey: ["archive-records"] });
    },
    onError: (error: Error) => {
      setPageToast({
        title: "Delete failed",
        message: error.message,
        tone: "danger",
      });
    },
  });

  const items = archiveQuery.data?.items ?? [];
  const stats = useMemo(() => ({
    total: items.length,
    workflowFinal: items.filter((item) => item.source === "WORKFLOW_FINAL").length,
    historical: items.filter((item) => item.source === "HISTORICAL_UPLOAD").length,
    verified: items.filter((item) => item.isVerified).length,
  }), [items]);

  const regionOptions = useMemo(() => organizationQuery.data?.regions ?? [], [organizationQuery.data]);
  const zoneOptions = useMemo(
    () => (organizationQuery.data?.zones ?? []).filter((zone) => (regionId ? zone.regionId === regionId : true)),
    [organizationQuery.data, regionId],
  );
  const officeOptions = useMemo(
    () => (organizationQuery.data?.offices ?? []).filter((office) => {
      if (scopeTrack && office.scopeTrack !== scopeTrack) return false;
      if (zoneId) return office.zoneId === zoneId;
      if (regionId) return office.regionId === regionId;
      return true;
    }),
    [organizationQuery.data, regionId, scopeTrack, zoneId],
  );

  const startEditing = (record: ArchiveRecordSummary) => {
    setEditingRecordId(record.id);
    setEditForm(buildMetadataForm(record));
  };

  const cancelEditing = () => {
    setEditingRecordId(null);
    setEditForm(initialMetadataForm());
  };

  const saveMetadata = (id: string) => {
    const validationError = validateHistoricalInput(editForm);
    if (validationError) {
      setPageToast({
        title: "Metadata update blocked",
        message: validationError,
        tone: "warning",
      });
      return;
    }

    editMutation.mutate({ id, payload: editForm });
  };

  const removeHistoricalRecord = (record: ArchiveRecordSummary) => {
    const shouldDelete = window.confirm(
      `Delete the historical archive record for ${record.employeeName}? This will also remove the stored PDF from managed storage.`,
    );

    if (!shouldDelete) {
      return;
    }

    deleteMutation.mutate({ id: record.id });
  };

  return (
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-5 p-5">
      <FloatingToast
        visible={Boolean(pageToast)}
        title={pageToast?.title ?? ""}
        message={pageToast?.message}
        tone={pageToast?.tone}
      />

      <PortalPageHeader
        eyebrow={isEmployee ? "Employee history" : "Secret Branch archive"}
        title={isEmployee ? "Archive History" : "Archive & History"}
        description={isEmployee
          ? "Metadata-only history for your archived and historical ACR records. Historical PDFs remain restricted unless Secret Branch explicitly grants access."
          : "Unified archive index for workflow-final records and historical ACR uploads, with secure document handling and historical metadata management."}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Visible Records" value={stats.total} subtitle="Archive records in your scope" icon={<Archive size={18} />} accent="green" />
        <StatCard title="Workflow Final" value={stats.workflowFinal} subtitle="Archived from live workflow" icon={<ShieldCheck size={18} />} accent="navy" />
        <StatCard title="Historical Uploads" value={stats.historical} subtitle="Legacy PDFs linked to employees" icon={<History size={18} />} accent="cyan" />
        <StatCard title="Verified" value={stats.verified} subtitle="Archive records verified by Secret Branch" icon={<Archive size={18} />} accent="amber" />
      </div>

      {canManageArchive ? (
        <div className="rounded-[24px] border border-[var(--fia-gray-200)] bg-[var(--card)] shadow-[0_8px_22px_rgba(15,23,42,0.05)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-[var(--fia-gray-200)] bg-gradient-to-r from-[var(--fia-navy)]/[0.04] to-transparent px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--fia-navy)]/10">
              <FileUp size={16} className="text-[var(--fia-navy)]" />
            </div>
            <div>
              <h2 className="text-[1.02rem] font-semibold text-[var(--fia-gray-950)]">Historical Upload</h2>
              <p className="text-sm text-[var(--fia-gray-500)]">Register previous-year PDFs against employees and service periods. PDF only · up to 10 MB.</p>
            </div>
          </div>

          <div className="px-5 py-5 space-y-5">
            {/* Section: Employee lookup */}
            <div>
              <p className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">
                <UserSearch size={11} />
                Employee lookup
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--fia-gray-600)]">Search by name / CNIC</label>
                  <div className="relative">
                    <Search size={14} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fia-gray-400)]" />
                    <input
                      value={employeeQuery}
                      onChange={(event) => setEmployeeQuery(event.target.value)}
                      placeholder="Type name or service number…"
                      className="w-full rounded-xl border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] py-2.5 pl-9 pr-3.5 text-sm text-[var(--fia-gray-900)] outline-none transition-all placeholder:text-[var(--fia-gray-400)] focus:border-[var(--fia-navy)]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(26,28,110,0.07)]"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--fia-gray-600)]">Select employee</label>
                  <div className="relative">
                    <select
                      value={uploadForm.employeeId}
                      onChange={(event) => setUploadForm((current) => ({ ...current, employeeId: event.target.value }))}
                      className="w-full appearance-none rounded-xl border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] px-3.5 py-2.5 pr-9 text-sm text-[var(--fia-gray-900)] outline-none transition-all focus:border-[var(--fia-navy)]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(26,28,110,0.07)] cursor-pointer"
                    >
                      <option value="">— Select employee —</option>
                      {(employeesQuery.data?.items ?? []).map((employee) => (
                        <option key={employee.id} value={employee.id}>
                          {employee.name} · {employee.serviceNumber ?? employee.cnic}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fia-gray-400)]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="h-px bg-[var(--fia-gray-100)]" />

            {/* Section: ACR details */}
            <div>
              <p className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">
                <Tag size={11} />
                ACR details
              </p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1.5 xl:col-span-2">
                  <label className="text-xs font-semibold text-[var(--fia-gray-600)]">Template family</label>
                  <div className="relative">
                    <select
                      value={uploadForm.templateFamily}
                      onChange={(event) => setUploadForm((current) => ({ ...current, templateFamily: event.target.value as TemplateFamilyCode }))}
                      className="w-full appearance-none rounded-xl border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] px-3.5 py-2.5 pr-9 text-sm text-[var(--fia-gray-900)] outline-none transition-all focus:border-[var(--fia-navy)]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(26,28,110,0.07)] cursor-pointer"
                    >
                      {templateFamilies.map((family) => (
                        <option key={family} value={family}>{templateLabel(family)}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fia-gray-400)]" />
                  </div>
                </div>
                <div className="space-y-1.5 xl:col-span-2">
                  <label className="flex items-center gap-1 text-xs font-semibold text-[var(--fia-gray-600)]">
                    <Hash size={10} />
                    Archive reference <span className="font-normal text-[var(--fia-gray-400)]">(optional)</span>
                  </label>
                  <input
                    value={uploadForm.archiveReference}
                    onChange={(event) => setUploadForm((current) => ({ ...current, archiveReference: event.target.value }))}
                    placeholder="e.g. HQ/2023/ACR/441"
                    className="w-full rounded-xl border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] px-3.5 py-2.5 text-sm text-[var(--fia-gray-900)] outline-none transition-all placeholder:text-[var(--fia-gray-400)] focus:border-[var(--fia-navy)]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(26,28,110,0.07)]"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-[var(--fia-gray-100)]" />

            {/* Section: Reporting period + remarks + file */}
            <div>
              <p className="mb-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">
                <CalendarRange size={11} />
                Reporting period &amp; document
              </p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--fia-gray-600)]">Period from</label>
                  <input
                    type="date"
                    value={uploadForm.reportingPeriodFrom}
                    onChange={(event) => setUploadForm((current) => ({ ...current, reportingPeriodFrom: event.target.value }))}
                    className="w-full rounded-xl border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] px-3.5 py-2.5 text-sm text-[var(--fia-gray-900)] outline-none transition-all focus:border-[var(--fia-navy)]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(26,28,110,0.07)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--fia-gray-600)]">Period to</label>
                  <input
                    type="date"
                    value={uploadForm.reportingPeriodTo}
                    onChange={(event) => setUploadForm((current) => ({ ...current, reportingPeriodTo: event.target.value }))}
                    className="w-full rounded-xl border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] px-3.5 py-2.5 text-sm text-[var(--fia-gray-900)] outline-none transition-all focus:border-[var(--fia-navy)]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(26,28,110,0.07)]"
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="flex items-center gap-1 text-xs font-semibold text-[var(--fia-gray-600)]">
                    <MessageSquare size={10} />
                    Remarks <span className="font-normal text-[var(--fia-gray-400)]">(optional)</span>
                  </label>
                  <input
                    value={uploadForm.remarks}
                    onChange={(event) => setUploadForm((current) => ({ ...current, remarks: event.target.value }))}
                    placeholder="Verification note or source reference…"
                    className="w-full rounded-xl border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] px-3.5 py-2.5 text-sm text-[var(--fia-gray-900)] outline-none transition-all placeholder:text-[var(--fia-gray-400)] focus:border-[var(--fia-navy)]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(26,28,110,0.07)]"
                  />
                </div>

                {/* File upload */}
                <div className="space-y-1.5 md:col-span-2 xl:col-span-4">
                  <label className="text-xs font-semibold text-[var(--fia-gray-600)]">Historical PDF document</label>
                  <label className={`group flex cursor-pointer items-center gap-4 rounded-xl border-2 border-dashed px-4 py-4 transition-all ${
                    uploadForm.file
                      ? "border-[var(--fia-navy)]/30 bg-[var(--fia-navy)]/[0.03]"
                      : "border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] hover:border-[var(--fia-navy)]/25 hover:bg-white"
                  }`}>
                    <input
                      type="file"
                      accept="application/pdf"
                      className="sr-only"
                      onChange={(event) => setUploadForm((current) => ({ ...current, file: event.target.files?.[0] ?? null }))}
                    />
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${uploadForm.file ? "bg-[var(--fia-navy)]/10" : "bg-[var(--fia-gray-100)] group-hover:bg-[var(--fia-navy)]/8"}`}>
                      <FileUp size={17} className={uploadForm.file ? "text-[var(--fia-navy)]" : "text-[var(--fia-gray-400)] group-hover:text-[var(--fia-navy)]"} />
                    </div>
                    <div className="min-w-0 flex-1">
                      {uploadForm.file ? (
                        <>
                          <p className="truncate text-sm font-semibold text-[var(--fia-navy)]">{uploadForm.file.name}</p>
                          <p className="text-xs text-[var(--fia-gray-500)]">{(uploadForm.file.size / 1024).toFixed(0)} KB · PDF</p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-semibold text-[var(--fia-gray-700)] group-hover:text-[var(--fia-navy)]">Click to attach a PDF</p>
                          <p className="text-xs text-[var(--fia-gray-400)]">PDF only · maximum 10 MB · stored securely in restricted archive</p>
                        </>
                      )}
                    </div>
                    {uploadForm.file ? (
                      <button
                        type="button"
                        onClick={(event) => { event.preventDefault(); setUploadForm((current) => ({ ...current, file: null })); }}
                        className="shrink-0 rounded-full p-1 text-[var(--fia-gray-400)] hover:bg-red-50 hover:text-red-500"
                      >
                        <X size={14} />
                      </button>
                    ) : null}
                  </label>
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--fia-gray-100)] bg-[var(--fia-gray-50)] px-4 py-3">
              <button
                type="button"
                disabled={uploadMutation.isPending || !uploadForm.employeeId || !uploadForm.file}
                onClick={() => uploadMutation.mutate()}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--fia-navy)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-90"
              >
                <FileUp size={15} />
                {uploadMutation.isPending ? "Uploading…" : "Upload historical record"}
              </button>
              <p className="text-xs text-[var(--fia-gray-500)]">Stored as a restricted historical archive document and audited automatically.</p>
            </div>
          </div>
        </div>
      ) : null}

      <PortalSurface title="Archive history" subtitle="Search by employee, posting, period, template family, archive reference, or organization scope.">
        {/* ── Search + Filter bar ─────────────────────────────────────────── */}
        <div className="mb-4 space-y-2.5">
          {/* Search row */}
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fia-gray-400)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by employee name, service number, archive reference, posting…"
              className="w-full rounded-xl border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] py-2.5 pl-9 pr-9 text-sm text-[var(--fia-gray-900)] outline-none transition-all placeholder:text-[var(--fia-gray-400)] focus:border-[var(--fia-navy)]/40 focus:bg-white focus:shadow-[0_0_0_3px_rgba(26,28,110,0.07)]"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-[var(--fia-gray-400)] hover:text-[var(--fia-gray-600)]"
              >
                <X size={13} />
              </button>
            ) : null}
          </div>

          {/* Filter pills row */}
          {(() => {
            const activeCount = [source, templateFamilyFilter, scopeTrack, regionId, zoneId, officeId].filter(Boolean).length;
            return (
              <div className={`rounded-xl border bg-[var(--card)] transition-all ${activeCount > 0 ? "border-[#1A1C6E]/20" : "border-[var(--fia-gray-200)]"}`}>
                <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
                  {/* Label */}
                  <div className="flex shrink-0 items-center gap-1.5 mr-1">
                    <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-[var(--fia-gray-100)]">
                      <SlidersHorizontal size={10} className="text-[var(--fia-gray-500)]" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--fia-gray-400)]">Filter</span>
                  </div>
                  <div className="h-4 w-px shrink-0 bg-[var(--fia-gray-200)]" />

                  {/* Source */}
                  <div className="relative shrink-0">
                    <Tag size={10} className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 ${source ? "text-white/80" : "text-[var(--fia-gray-400)]"}`} />
                    <select
                      value={source}
                      onChange={(event) => setSource(event.target.value as "" | ArchiveRecordSource)}
                      className={`appearance-none cursor-pointer rounded-full border py-1.5 pl-6 pr-6 text-[11px] font-semibold outline-none transition-all ${source ? "border-[#1A1C6E] bg-[#1A1C6E] text-white shadow-sm" : "border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] text-[var(--fia-gray-600)] hover:bg-white hover:shadow-sm"}`}
                    >
                      <option value="">All sources</option>
                      <option value="WORKFLOW_FINAL">Workflow final</option>
                      <option value="HISTORICAL_UPLOAD">Historical upload</option>
                    </select>
                    <ChevronDown size={9} className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${source ? "text-white/70" : "text-[var(--fia-gray-400)]"}`} />
                  </div>

                  {/* Template family */}
                  <div className="relative shrink-0">
                    <Tag size={10} className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 ${templateFamilyFilter ? "text-white/80" : "text-[var(--fia-gray-400)]"}`} />
                    <select
                      value={templateFamilyFilter}
                      onChange={(event) => setTemplateFamilyFilter(event.target.value as "" | TemplateFamilyCode)}
                      className={`appearance-none cursor-pointer rounded-full border py-1.5 pl-6 pr-6 text-[11px] font-semibold outline-none transition-all ${templateFamilyFilter ? "border-[#1A1C6E] bg-[#1A1C6E] text-white shadow-sm" : "border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] text-[var(--fia-gray-600)] hover:bg-white hover:shadow-sm"}`}
                    >
                      <option value="">All templates</option>
                      {templateFamilies.map((family) => (
                        <option key={family} value={family}>{templateLabel(family)}</option>
                      ))}
                    </select>
                    <ChevronDown size={9} className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${templateFamilyFilter ? "text-white/70" : "text-[var(--fia-gray-400)]"}`} />
                  </div>

                  {/* Track */}
                  <div className="relative shrink-0">
                    <Layers3 size={10} className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 ${scopeTrack ? "text-white/80" : "text-[var(--fia-gray-400)]"}`} />
                    <select
                      value={scopeTrack}
                      onChange={(event) => { setScopeTrack(event.target.value as "" | OrgScopeTrack); setRegionId(""); setZoneId(""); setOfficeId(""); }}
                      className={`appearance-none cursor-pointer rounded-full border py-1.5 pl-6 pr-6 text-[11px] font-semibold outline-none transition-all ${scopeTrack ? "border-[#1A1C6E] bg-[#1A1C6E] text-white shadow-sm" : "border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] text-[var(--fia-gray-600)] hover:bg-white hover:shadow-sm"}`}
                    >
                      <option value="">All tracks</option>
                      <option value="REGIONAL">Regional</option>
                      <option value="WING">Wing</option>
                    </select>
                    <ChevronDown size={9} className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${scopeTrack ? "text-white/70" : "text-[var(--fia-gray-400)]"}`} />
                  </div>

                  {/* Region */}
                  <div className="relative shrink-0">
                    <MapPin size={10} className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 ${regionId ? "text-white/80" : "text-[var(--fia-gray-400)]"}`} />
                    <select
                      value={regionId}
                      onChange={(event) => { setRegionId(event.target.value); setZoneId(""); setOfficeId(""); }}
                      className={`appearance-none cursor-pointer rounded-full border py-1.5 pl-6 pr-6 text-[11px] font-semibold outline-none transition-all ${regionId ? "border-[#1A1C6E] bg-[#1A1C6E] text-white shadow-sm" : "border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] text-[var(--fia-gray-600)] hover:bg-white hover:shadow-sm"}`}
                    >
                      <option value="">All regions</option>
                      {regionOptions.map((region) => (
                        <option key={region.id} value={region.id}>{region.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={9} className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${regionId ? "text-white/70" : "text-[var(--fia-gray-400)]"}`} />
                  </div>

                  {/* Zone */}
                  <div className="relative shrink-0">
                    <MapPin size={10} className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 ${zoneId ? "text-white/80" : "text-[var(--fia-gray-400)]"}`} />
                    <select
                      value={zoneId}
                      onChange={(event) => { setZoneId(event.target.value); setOfficeId(""); }}
                      className={`appearance-none cursor-pointer rounded-full border py-1.5 pl-6 pr-6 text-[11px] font-semibold outline-none transition-all ${zoneId ? "border-[#1A1C6E] bg-[#1A1C6E] text-white shadow-sm" : "border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] text-[var(--fia-gray-600)] hover:bg-white hover:shadow-sm"}`}
                    >
                      <option value="">All zones</option>
                      {zoneOptions.map((zone) => (
                        <option key={zone.id} value={zone.id}>{zone.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={9} className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${zoneId ? "text-white/70" : "text-[var(--fia-gray-400)]"}`} />
                  </div>

                  {/* Office */}
                  <div className="relative shrink-0">
                    <Building2 size={10} className={`pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 ${officeId ? "text-white/80" : "text-[var(--fia-gray-400)]"}`} />
                    <select
                      value={officeId}
                      onChange={(event) => setOfficeId(event.target.value)}
                      className={`appearance-none cursor-pointer rounded-full border py-1.5 pl-6 pr-6 text-[11px] font-semibold outline-none transition-all ${officeId ? "border-[#1A1C6E] bg-[#1A1C6E] text-white shadow-sm" : "border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] text-[var(--fia-gray-600)] hover:bg-white hover:shadow-sm"}`}
                    >
                      <option value="">All offices</option>
                      {officeOptions.map((office) => (
                        <option key={office.id} value={office.id}>{office.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={9} className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 ${officeId ? "text-white/70" : "text-[var(--fia-gray-400)]"}`} />
                  </div>

                  {activeCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => { setSource(""); setTemplateFamilyFilter(""); setScopeTrack(""); setRegionId(""); setZoneId(""); setOfficeId(""); }}
                      className="ml-auto shrink-0 inline-flex items-center gap-1.5 rounded-full border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] px-2.5 py-1 text-[10px] font-semibold text-[var(--fia-gray-500)] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    >
                      <RefreshCw size={8} />
                      Reset
                    </button>
                  ) : null}
                </div>

                {/* Active chips */}
                {activeCount > 0 ? (
                  <div className="flex flex-wrap items-center gap-1.5 border-t border-[#1A1C6E]/10 bg-[#1A1C6E]/[0.03] px-3 py-2">
                    <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#1A1C6E]/50 mr-0.5">Active:</span>
                    {source ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1A1C6E] pl-2.5 pr-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Source: {source === "WORKFLOW_FINAL" ? "Workflow" : "Historical"}
                        <button type="button" onClick={() => setSource("")} className="flex h-3 w-3 items-center justify-center rounded-full bg-white/15 hover:bg-white/30"><X size={7} /></button>
                      </span>
                    ) : null}
                    {templateFamilyFilter ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1A1C6E] pl-2.5 pr-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Template: {templateLabel(templateFamilyFilter).split("(")[0].trim()}
                        <button type="button" onClick={() => setTemplateFamilyFilter("")} className="flex h-3 w-3 items-center justify-center rounded-full bg-white/15 hover:bg-white/30"><X size={7} /></button>
                      </span>
                    ) : null}
                    {scopeTrack ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1A1C6E] pl-2.5 pr-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Track: {scopeTrack}
                        <button type="button" onClick={() => { setScopeTrack(""); setRegionId(""); setZoneId(""); setOfficeId(""); }} className="flex h-3 w-3 items-center justify-center rounded-full bg-white/15 hover:bg-white/30"><X size={7} /></button>
                      </span>
                    ) : null}
                    {regionId ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1A1C6E] pl-2.5 pr-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Region: {regionOptions.find((r) => r.id === regionId)?.name ?? regionId}
                        <button type="button" onClick={() => { setRegionId(""); setZoneId(""); setOfficeId(""); }} className="flex h-3 w-3 items-center justify-center rounded-full bg-white/15 hover:bg-white/30"><X size={7} /></button>
                      </span>
                    ) : null}
                    {zoneId ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1A1C6E] pl-2.5 pr-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Zone: {zoneOptions.find((z) => z.id === zoneId)?.name ?? zoneId}
                        <button type="button" onClick={() => { setZoneId(""); setOfficeId(""); }} className="flex h-3 w-3 items-center justify-center rounded-full bg-white/15 hover:bg-white/30"><X size={7} /></button>
                      </span>
                    ) : null}
                    {officeId ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1A1C6E] pl-2.5 pr-1.5 py-0.5 text-[10px] font-semibold text-white">
                        Office: {officeOptions.find((o) => o.id === officeId)?.name ?? officeId}
                        <button type="button" onClick={() => setOfficeId("")} className="flex h-3 w-3 items-center justify-center rounded-full bg-white/15 hover:bg-white/30"><X size={7} /></button>
                      </span>
                    ) : null}
                    <span className="ml-auto text-[10px] text-[var(--fia-gray-400)]">{items.length} result{items.length !== 1 ? "s" : ""}</span>
                  </div>
                ) : null}
              </div>
            );
          })()}
        </div>

        {/* Results label */}
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--fia-gray-500)]">
            {archiveQuery.isLoading ? "Loading…" : `${items.length} record${items.length !== 1 ? "s" : ""} found`}
          </span>
        </div>

        {archiveQuery.isLoading ? (
          <div className="py-10 text-center text-sm text-[var(--fia-gray-500)]">Loading archive history...</div>
        ) : items.length === 0 ? (
          <EmptyState
            title="No archive history available"
            description="Archived workflow packets and uploaded historical PDFs will appear here when they match your scope."
          />
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const isEditing = editingRecordId === item.id;
              const isSavingMetadata = editMutation.isPending && editMutation.variables?.id === item.id;
              const isDeleting = deleteMutation.isPending && deleteMutation.variables?.id === item.id;
              const isVerifying = verifyMutation.isPending && verifyMutation.variables?.id === item.id;

              return (
                <div key={item.id} className="rounded-[20px] border border-[#E2E8F0] dark:border-slate-700 bg-white dark:bg-[var(--card)] px-4 py-4 shadow-sm">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.acrRecordId ? (
                          <Link href={`/acr/${item.acrRecordId}`} className="font-semibold text-[var(--fia-navy)] hover:text-[var(--fia-cyan)]">
                            {item.employeeName}
                          </Link>
                        ) : (
                          <p className="font-semibold text-[var(--fia-gray-950)]">{item.employeeName}</p>
                        )}
                        <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 text-xs font-semibold text-[#3730A3]">
                          {sourceLabel(item.source)}
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.isVerified ? "bg-[#ECFDF5] text-[#15803D]" : "bg-[#FFF7ED] text-[#C2410C]"}`}>
                          {item.isVerified ? "Verified" : "Pending verification"}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--fia-gray-600)]">
                        {(item.employeeServiceNumber ?? "Service number unavailable")} · {item.positionTitle ?? item.employee?.designation ?? "Position not recorded"}
                      </p>
                      <div className="grid gap-1 text-sm text-[var(--fia-gray-600)] md:grid-cols-2 xl:grid-cols-4">
                        <p>Posting: <span className="font-medium text-[var(--fia-gray-900)]">{item.employeePosting ?? item.employee?.posting ?? "Not recorded"}</span></p>
                        <p>Period: <span className="font-medium text-[var(--fia-gray-900)]">{item.reportingPeriod ?? "Not recorded"}</span></p>
                        <p>Template: <span className="font-medium text-[var(--fia-gray-900)]">{templateLabel(item.templateFamily)}</span></p>
                        <p>Reference: <span className="font-medium text-[var(--fia-gray-900)]">{item.archiveReference ?? "Metadata only"}</span></p>
                      </div>
                      {item.orgLabel ? (
                        <p className="text-sm text-[var(--fia-gray-600)]">
                          Organization: <span className="font-medium text-[var(--fia-gray-900)]">{item.orgLabel}</span>
                        </p>
                      ) : null}
                      {item.remarks ? (
                        <p className="text-sm text-[var(--fia-gray-600)]">
                          Remarks: <span className="font-medium text-[var(--fia-gray-900)]">{item.remarks}</span>
                        </p>
                      ) : null}
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--fia-gray-500)]">
                        <p>Recorded: <span className="font-medium text-[var(--fia-gray-700)]">{new Date(item.createdAt).toLocaleDateString("en-PK")}</span></p>
                        {!isEmployee && item.uploadedBy ? (
                          <p>Uploaded by: <span className="font-medium text-[var(--fia-gray-700)]">{item.uploadedBy}</span></p>
                        ) : null}
                        {!isEmployee && item.verifiedBy ? (
                          <p>Verified by: <span className="font-medium text-[var(--fia-gray-700)]">{item.verifiedBy}</span></p>
                        ) : null}
                        {!isEmployee && item.documentFileName ? (
                          <p>Document: <span className="font-medium text-[var(--fia-gray-700)]">{item.documentFileName}</span></p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                      {!isEmployee && item.documentUrl ? (
                        <a
                          href={toAbsoluteApiUrl(item.documentUrl)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-2xl border border-[#D8DEE8] dark:border-slate-700 bg-white px-4 py-2.5 text-sm font-semibold text-[#334155] transition-colors hover:border-[#B6C2D2] hover:bg-[#F8FAFC] dark:bg-slate-800"
                        >
                          <ExternalLink size={16} />
                          Open PDF
                        </a>
                      ) : null}
                      {canManageArchive && item.source === "HISTORICAL_UPLOAD" ? (
                        <>
                          {!item.isVerified ? (
                            <button
                              type="button"
                              disabled={isVerifying}
                              onClick={() => verifyMutation.mutate({ id: item.id })}
                              className="inline-flex items-center gap-2 rounded-2xl border border-[#D8DEE8] dark:border-slate-700 bg-white px-4 py-2.5 text-sm font-semibold text-[#334155] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <ShieldCheck size={16} />
                              {isVerifying ? "Verifying..." : "Verify"}
                            </button>
                          ) : null}
                          <button
                            type="button"
                            disabled={isSavingMetadata}
                            onClick={() => (isEditing ? cancelEditing() : startEditing(item))}
                            className="inline-flex items-center gap-2 rounded-2xl border border-[#D8DEE8] dark:border-slate-700 bg-white px-4 py-2.5 text-sm font-semibold text-[#334155] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <FilePenLine size={16} />
                            {isEditing ? "Cancel edit" : "Edit metadata"}
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => removeHistoricalRecord(item)}
                            className="inline-flex items-center gap-2 rounded-2xl border border-[#FECACA] bg-[#FFF7F7] px-4 py-2.5 text-sm font-semibold text-[#B91C1C] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 size={16} />
                            {isDeleting ? "Deleting..." : "Delete"}
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {canManageArchive && item.source === "HISTORICAL_UPLOAD" && isEditing ? (
                    <div className="mt-4 rounded-xl border border-[var(--fia-navy)]/15 bg-[var(--fia-navy)]/[0.025] p-4">
                      <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--fia-navy)]/60">Edit metadata</p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="space-y-1.5 lg:col-span-2">
                          <label className="text-xs font-semibold text-[var(--fia-gray-600)]">Template family</label>
                          <div className="relative">
                            <select
                              value={editForm.templateFamily}
                              onChange={(event) => setEditForm((current) => ({ ...current, templateFamily: event.target.value as TemplateFamilyCode }))}
                              className="w-full appearance-none rounded-xl border border-[var(--fia-gray-200)] bg-white px-3.5 py-2 pr-8 text-sm text-[var(--fia-gray-900)] outline-none transition-all focus:border-[var(--fia-navy)]/40 focus:shadow-[0_0_0_3px_rgba(26,28,110,0.07)] cursor-pointer"
                            >
                              {templateFamilies.map((family) => (
                                <option key={family} value={family}>{templateLabel(family)}</option>
                              ))}
                            </select>
                            <ChevronDown size={12} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--fia-gray-400)]" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-[var(--fia-gray-600)]">Period from</label>
                          <input
                            type="date"
                            value={editForm.reportingPeriodFrom}
                            onChange={(event) => setEditForm((current) => ({ ...current, reportingPeriodFrom: event.target.value }))}
                            className="w-full rounded-xl border border-[var(--fia-gray-200)] bg-white px-3.5 py-2 text-sm text-[var(--fia-gray-900)] outline-none transition-all focus:border-[var(--fia-navy)]/40 focus:shadow-[0_0_0_3px_rgba(26,28,110,0.07)]"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-[var(--fia-gray-600)]">Period to</label>
                          <input
                            type="date"
                            value={editForm.reportingPeriodTo}
                            onChange={(event) => setEditForm((current) => ({ ...current, reportingPeriodTo: event.target.value }))}
                            className="w-full rounded-xl border border-[var(--fia-gray-200)] bg-white px-3.5 py-2 text-sm text-[var(--fia-gray-900)] outline-none transition-all focus:border-[var(--fia-navy)]/40 focus:shadow-[0_0_0_3px_rgba(26,28,110,0.07)]"
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                          <label className="text-xs font-semibold text-[var(--fia-gray-600)]">Archive reference</label>
                          <input
                            value={editForm.archiveReference}
                            onChange={(event) => setEditForm((current) => ({ ...current, archiveReference: event.target.value }))}
                            placeholder="Optional reference"
                            className="w-full rounded-xl border border-[var(--fia-gray-200)] bg-white px-3.5 py-2 text-sm text-[var(--fia-gray-900)] outline-none transition-all placeholder:text-[var(--fia-gray-400)] focus:border-[var(--fia-navy)]/40 focus:shadow-[0_0_0_3px_rgba(26,28,110,0.07)]"
                          />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                          <label className="text-xs font-semibold text-[var(--fia-gray-600)]">Remarks</label>
                          <input
                            value={editForm.remarks}
                            onChange={(event) => setEditForm((current) => ({ ...current, remarks: event.target.value }))}
                            placeholder="Verification or source note"
                            className="w-full rounded-xl border border-[var(--fia-gray-200)] bg-white px-3.5 py-2 text-sm text-[var(--fia-gray-900)] outline-none transition-all placeholder:text-[var(--fia-gray-400)] focus:border-[var(--fia-navy)]/40 focus:shadow-[0_0_0_3px_rgba(26,28,110,0.07)]"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={isSavingMetadata}
                          onClick={() => saveMetadata(item.id)}
                          className="inline-flex items-center gap-2 rounded-xl bg-[var(--fia-navy)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-90"
                        >
                          {isSavingMetadata ? "Saving…" : "Save metadata"}
                        </button>
                        <button
                          type="button"
                          onClick={() => cancelEditing()}
                          className="rounded-xl border border-[var(--fia-gray-200)] bg-white px-4 py-2 text-sm font-semibold text-[var(--fia-gray-600)] hover:bg-[var(--fia-gray-50)]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </PortalSurface>
    </div>
  );
}
