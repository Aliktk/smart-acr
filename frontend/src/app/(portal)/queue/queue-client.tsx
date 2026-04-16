"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History, Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { getAcrs, getArchiveRecords, getEmployeeAcrs, transitionAcr } from "@/api/client";
import { PortalPageHeader, PortalSurface, EmptyState, SegmentedTabs } from "@/components/portal/PortalPrimitives";
import { FloatingToast, OverdueBadge, PriorityBadge, StatusChip } from "@/components/ui";
import { useShell } from "@/hooks/useShell";
import { syncAcrSummaryCaches } from "@/utils/acr-cache";
import {
  countStatuses,
  getCurrentOwnerLabel,
  getCurrentStageLabel,
  groupAcrsByServicePeriod,
  isClosedStatus,
  isOverdueStatus,
  sortAcrsByUrgency,
} from "@/utils/acr";
import { getRoleLabel } from "@/utils/roles";

type QueueView = "attention" | "open" | "returned" | "closed" | "all";

function deriveInitialView(searchParams: URLSearchParams): QueueView {
  const explicitStatus = searchParams.get("status");
  const priorityOnly = searchParams.get("priority") === "true";
  const overdueOnly = searchParams.get("overdue") === "true";

  if (priorityOnly || overdueOnly || explicitStatus === "Overdue") {
    return "attention";
  }
  if (explicitStatus?.startsWith("Returned")) {
    return "returned";
  }
  if (explicitStatus === "Archived" || explicitStatus === "Completed") {
    return "closed";
  }
  if (explicitStatus === "Draft") {
    return "open";
  }
  return "open";
}

export function QueueClientPage() {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const queryClient = useQueryClient();
  const { user } = useShell();
  const explicitStatus = searchParams.get("status") ?? undefined;
  const priorityFromQuery = searchParams.get("priority") === "true";
  const overdueFromQuery = searchParams.get("overdue") === "true";
  const [view, setView] = useState<QueueView>(() => deriveInitialView(searchParams));
  const [queryText, setQueryText] = useState(searchParams.get("query") ?? "");
  const [actionError, setActionError] = useState<string | null>(null);
  const [pageToast, setPageToast] = useState<{ title: string; message?: string; tone?: "success" | "info" | "warning" | "danger" } | null>(null);
  const deferredQuery = useDeferredValue(queryText.trim());

  useEffect(() => {
    setView(deriveInitialView(searchParams));
    setQueryText(searchParams.get("query") ?? "");
  }, [searchKey, searchParams]);

  useEffect(() => {
    const rawFlash = sessionStorage.getItem("fia-smart-acr-flash");

    if (!rawFlash) {
      return;
    }

    try {
      const flash = JSON.parse(rawFlash) as { title: string; message?: string; tone?: "success" | "info" | "warning" | "danger" };
      setPageToast(flash);
    } catch {
      // ignore malformed flash payloads
    }

    sessionStorage.removeItem("fia-smart-acr-flash");
  }, []);

  useEffect(() => {
    if (!pageToast) {
      return;
    }

    const timer = window.setTimeout(() => setPageToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pageToast]);

  const { data } = useQuery({
    queryKey: ["acrs", user?.activeRoleCode, deferredQuery],
    queryFn: () => user?.activeRoleCode === "EMPLOYEE"
      ? getEmployeeAcrs()
      : getAcrs({ query: deferredQuery || undefined }),
  });

  const historicalArchiveQuery = useQuery({
    queryKey: ["employee-historical-archive", user?.activeRoleCode],
    queryFn: () => getArchiveRecords({ source: "HISTORICAL_UPLOAD" }),
    enabled: user?.activeRoleCode === "EMPLOYEE",
  });

  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => transitionAcr(id, { action }),
    onSuccess: (updated) => {
      setActionError(null);
      syncAcrSummaryCaches(queryClient, updated);
      queryClient.invalidateQueries({ queryKey: ["acrs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
    },
    onError: (error: Error) => {
      setActionError(error.message);
    },
  });

  const items = data?.items ?? [];
  const historicalArchiveItems = historicalArchiveQuery.data?.items ?? [];
  const operationalRole = user?.activeRoleCode === "CLERK" ||
    user?.activeRoleCode === "REPORTING_OFFICER" ||
    user?.activeRoleCode === "COUNTERSIGNING_OFFICER" ||
    user?.activeRoleCode === "SECRET_BRANCH";
  // ownedItems = records currently assigned to this user (need action now)
  // allParticipatedItems = all records the user has ever been involved with (submitted, forwarded, etc.)
  const ownedItems = useMemo(() => {
    if (!operationalRole || !user?.id) {
      return items;
    }

    return items.filter((item) => item.currentHolderId === user.id);
  }, [items, operationalRole, user?.id]);
  const counts = countStatuses(ownedItems);

  const filtered = useMemo(() => {
    // "all" and "closed" views show every record the user participated in,
    // not just those currently assigned to them, so submitted/forwarded ACRs remain visible.
    const baseItems = (view === "all" || view === "closed") ? items : ownedItems;
    let next = baseItems;

    if (view === "attention") {
      next = next.filter((item) => !isClosedStatus(item.status) && (item.isPriority || isOverdueStatus(item) || item.status.startsWith("Returned")));
    } else if (view === "open") {
      next = next.filter((item) => !isClosedStatus(item.status) && !item.status.startsWith("Returned"));
    } else if (view === "returned") {
      next = next.filter((item) => item.status.startsWith("Returned"));
    } else if (view === "closed") {
      next = next.filter((item) => isClosedStatus(item.status));
    }

    // Only apply the URL-driven status filter when the view matches what the URL dictates.
    // If the user manually switched tabs, the current view will differ from the URL-derived one
    // and the explicit status should not restrict results within the new view.
    if (explicitStatus && view === deriveInitialView(searchParams)) {
      next = next.filter((item) => item.status === explicitStatus);
    }

    if (priorityFromQuery) {
      next = next.filter((item) => item.isPriority);
    }

    if (overdueFromQuery) {
      next = next.filter((item) => item.isOverdue);
    }

    if (user?.activeRoleCode === "EMPLOYEE" && deferredQuery) {
      const lowered = deferredQuery.toLowerCase();
      next = next.filter((item) =>
        [
          item.acrNo,
          item.employee.name,
          item.employee.serviceNumber ?? "",
          item.employee.posting,
          item.reportingPeriod,
          item.status,
        ].some((value) => value.toLowerCase().includes(lowered)),
      );
    }

    return sortAcrsByUrgency(next);
  }, [deferredQuery, explicitStatus, items, overdueFromQuery, ownedItems, priorityFromQuery, user?.activeRoleCode, view]);

  const tabs: Array<{ key: QueueView; label: string; count: number }> = [
    { key: "attention", label: "Needs attention", count: ownedItems.filter((item) => !isClosedStatus(item.status) && (item.isPriority || isOverdueStatus(item) || item.status.startsWith("Returned"))).length },
    { key: "open", label: "Open work", count: counts.open - counts.returned },
    { key: "returned", label: "Returned", count: counts.returned },
    { key: "closed", label: "Closed", count: items.filter((item) => isClosedStatus(item.status)).length },
    { key: "all", label: "All records", count: items.length },
  ];

  const recentHistoricalItems = useMemo(
    () => historicalArchiveItems.slice(0, 3),
    [historicalArchiveItems],
  );
  const servicePeriodGroups = useMemo(
    () => (user?.activeRoleCode === "EMPLOYEE" ? groupAcrsByServicePeriod(filtered) : []),
    [filtered, user?.activeRoleCode],
  );

  const roleLabel = user ? getRoleLabel(user.activeRoleCode) : "Portal";

  return (
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-5 p-5">
      <FloatingToast
        visible={Boolean(pageToast)}
        title={pageToast?.title ?? ""}
        message={pageToast?.message}
        tone={pageToast?.tone}
      />
      <PortalPageHeader
        eyebrow={`${roleLabel} queue`}
        title={user?.activeRoleCode === "EMPLOYEE" ? "My ACR History" : "Operational Queue"}
      />

      <PortalSurface title="Queue view">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <SegmentedTabs tabs={tabs} value={view} onChange={setView} />
          <label className="relative block w-full max-w-[340px]">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fia-gray-400)]" />
            <input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder={user?.activeRoleCode === "EMPLOYEE" ? "Search your ACR history" : "Search by record, employee, CNIC, rank, or office"}
              className="w-full rounded-full border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] py-2.5 pl-11 pr-4 text-sm text-[var(--foreground)] outline-none transition-all placeholder:text-[var(--fia-gray-400)] focus:border-[var(--fia-cyan)] focus:bg-[var(--card)] focus:ring-4 focus:ring-[rgba(0,149,217,0.10)]"
            />
          </label>
        </div>
      </PortalSurface>

      {user?.activeRoleCode === "EMPLOYEE" ? (
        <PortalSurface title="Service-period summaries" subtitle="Grouped metadata for each reporting period linked to your employee profile.">
          {servicePeriodGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] px-4 py-4 text-sm text-[var(--fia-gray-500)]">
              No service-period summaries match the current queue filters.
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-3">
              {servicePeriodGroups.map((group) => {
                const archivedCount = group.items.filter((item) => item.status === "Archived" || item.status === "Completed").length;
                const activeCount = group.items.length - archivedCount;
                const latestRecord = [...group.items].sort(
                  (left, right) => new Date(right.reportingPeriodTo ?? right.initiatedDate).getTime() - new Date(left.reportingPeriodTo ?? left.initiatedDate).getTime(),
                )[0];

                return (
                  <div key={group.key} className="rounded-2xl border border-[var(--fia-gray-100)] bg-[var(--fia-gray-50)] px-4 py-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="h-3 w-1 rounded-full bg-[#1A1C6E]" />
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">Service period</p>
                    </div>
                    <p className="mt-2 text-lg font-semibold text-[var(--fia-gray-950)]">{group.label}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3 bg-[var(--card)] rounded-xl px-3 py-3">
                      <div>
                        <p className="text-xs text-[var(--fia-gray-500)]">Records</p>
                        <p className="mt-1 text-base font-semibold text-[var(--fia-gray-900)]">{group.items.length}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--fia-gray-500)]">Archived</p>
                        <p className="mt-1 text-base font-semibold text-[var(--fia-gray-900)]">{archivedCount}</p>
                      </div>
                      <div>
                        <p className="text-xs text-[var(--fia-gray-500)]">Active</p>
                        <p className="mt-1 text-base font-semibold text-[var(--fia-gray-900)]">{activeCount}</p>
                      </div>
                    </div>
                    {latestRecord ? (
                      <div className="mt-4 rounded-2xl bg-[var(--card)] px-3 py-3">
                        <p className="text-xs text-[var(--fia-gray-500)]">Latest record</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusChip status={latestRecord.status} />
                          <span className="text-sm text-[var(--fia-gray-700)]">{latestRecord.acrNo}</span>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </PortalSurface>
      ) : null}

      {user?.activeRoleCode === "EMPLOYEE" ? (
        <PortalSurface title="Historical archive history" subtitle="Legacy ACR records from pre-digitization years appear here as metadata only. PDF contents remain restricted unless Secret Branch explicitly authorizes access.">
          {historicalArchiveQuery.isLoading ? (
            <div className="py-6 text-sm text-[var(--fia-gray-500)]">Loading historical archive metadata...</div>
          ) : historicalArchiveItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] px-4 py-4 text-sm text-[var(--fia-gray-500)]">
              No historical ACR metadata has been linked to your profile yet.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 rounded-3xl border border-[var(--fia-gray-100)] bg-[var(--fia-gray-50)] px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-[var(--fia-cyan-100)] p-2.5 text-[var(--fia-cyan)]">
                    <History size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--fia-gray-950)]">{historicalArchiveItems.length} historical archive record(s) linked to your profile</p>
                    <p className="mt-1 text-sm text-[var(--fia-gray-600)]">These legacy entries are kept separate from live workflow ACRs while remaining visible in your record history.</p>
                  </div>
                </div>
                <Link
                  href="/archive"
                  className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#EEF8FF] to-[#D7EFFB] border border-[#BAE6FD] px-4 py-2 text-sm font-semibold text-[#0369A1] transition-colors hover:border-[#0095D9] hover:text-[#0095D9]"
                >
                  Open archive history
                </Link>
              </div>

              <div className="grid gap-3 lg:grid-cols-3">
                {recentHistoricalItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[var(--fia-gray-100)] bg-[var(--card)] px-4 py-4">
                    <p className="text-sm font-semibold text-[var(--fia-gray-950)]">{item.reportingPeriod ?? "Historical period not recorded"}</p>
                    <p className="mt-1 text-sm text-[var(--fia-gray-600)]">{item.templateFamily ?? "Template not recorded"}</p>
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">Archive reference</p>
                    <p className="mt-1 text-sm text-[var(--fia-gray-700)]">{item.archiveReference ?? "Metadata only"}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </PortalSurface>
      ) : null}

      <PortalSurface title={user?.activeRoleCode === "EMPLOYEE" ? "My ACR metadata history" : "Working records"}>
        {actionError ? (
          <div className="mb-3 rounded-2xl border border-[var(--fia-danger-bg)] bg-[var(--fia-danger-bg)] px-4 py-3 text-sm text-[var(--fia-danger)]">
            {actionError}
          </div>
        ) : null}
        {data === undefined ? (
          <div className="py-12 text-center text-sm text-[var(--fia-gray-500)]">Loading queue records...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={user?.activeRoleCode === "EMPLOYEE" ? "No ACR history matches this view" : "No records match this queue view"}
            description={
              user?.activeRoleCode === "EMPLOYEE"
                ? "Try another queue segment or broaden the search term. Your linked service-period history remains available through the other queue views."
                : "Try another queue segment or broaden the search term. Closed and active records remain available through the other queue views."
            }
          />
        ) : user?.activeRoleCode === "EMPLOYEE" ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[var(--fia-gray-100)] bg-gradient-to-r from-[var(--fia-gray-50)] to-white dark:from-slate-800/50 dark:to-transparent text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">
                <tr>
                  <th className="px-3.5 py-3">ACR</th>
                  <th className="px-3.5 py-3">Template / Period</th>
                  <th className="px-3.5 py-3">Officer Chain</th>
                  <th className="px-3.5 py-3">Secret Branch / Archive</th>
                  <th className="px-3.5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--fia-gray-100)] last:border-b-0">
                    <td className="px-3.5 py-3.5 align-top">
                      <Link href={`/acr/${item.id}`} className="font-semibold text-[var(--fia-navy)] hover:text-[var(--fia-cyan)]">
                        {item.acrNo}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusChip status={item.status} />
                        {item.isPriority ? <PriorityBadge priority /> : null}
                        {item.isOverdue ? <OverdueBadge days={item.overdueDays} /> : null}
                      </div>
                    </td>
                    <td className="px-3.5 py-3.5 align-top">
                      <p className="font-semibold text-[var(--fia-gray-900)]">{item.templateFamily ?? "Template not recorded"}</p>
                      <p className="mt-1 text-xs text-[var(--fia-gray-500)]">{item.servicePeriodLabel ?? item.reportingPeriod}</p>
                      <p className="mt-2 text-xs text-[var(--fia-gray-600)]">
                        Initiated: <span className="font-medium text-[var(--fia-gray-900)]">{item.initiatedDate}</span>
                      </p>
                      <p className="mt-1 text-xs text-[var(--fia-gray-600)]">
                        Completed: <span className="font-medium text-[var(--fia-gray-900)]">{item.completedDate ?? item.archivedAt ?? "In progress"}</span>
                      </p>
                    </td>
                    <td className="px-3.5 py-3.5 align-top text-[var(--fia-gray-700)]">
                      <p className="text-xs text-[var(--fia-gray-500)]">
                        Initiated by: <span className="font-medium text-[var(--fia-gray-900)]">{item.initiatedBy}</span>
                      </p>
                      <p className="mt-1 text-xs text-[var(--fia-gray-500)]">
                        Reporting officer: <span className="font-medium text-[var(--fia-gray-900)]">{item.reportingOfficer}</span>
                      </p>
                      <p className="mt-1 text-xs text-[var(--fia-gray-500)]">
                        Countersigning officer: <span className="font-medium text-[var(--fia-gray-900)]">{item.countersigningOfficer ?? "Not applicable"}</span>
                      </p>
                      <p className="mt-1 text-xs text-[var(--fia-gray-500)]">
                        Current stage: <span className="font-medium text-[var(--fia-gray-900)]">{getCurrentStageLabel(item)}</span>
                      </p>
                    </td>
                    <td className="px-3.5 py-3.5 align-top text-[var(--fia-gray-700)]">
                      <p className="font-medium">{item.secretBranch?.status ?? "Not yet submitted to Secret Branch"}</p>
                      <p className="mt-1 text-xs text-[var(--fia-gray-500)]">
                        Sent to RO: {item.submittedToReportingAt ? new Date(item.submittedToReportingAt).toLocaleDateString("en-PK") : "Pending"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--fia-gray-500)]">
                        Sent to Secret Branch: {item.secretBranch?.submittedAt ? new Date(item.secretBranch.submittedAt).toLocaleDateString("en-PK") : "Not yet"}
                      </p>
                      <p className="mt-1 text-xs text-[var(--fia-gray-500)]">
                        Restricted PDF retained: {item.hasHistoricalPdf ? "Yes" : "No"}
                      </p>
                    </td>
                    <td className="px-3.5 py-3.5 text-right align-top">
                      <Link
                        href={`/acr/${item.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#EEF8FF] to-[#D7EFFB] px-3.5 py-1.5 text-xs font-semibold text-[#0369A1] border border-[#BAE6FD] transition-colors hover:border-[#0095D9] hover:text-[#0095D9]"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[var(--fia-gray-100)] bg-gradient-to-r from-[var(--fia-gray-50)] to-white dark:from-slate-800/50 dark:to-transparent text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">
                <tr>
                <th className="px-3.5 py-3">Record</th>
                <th className="px-3.5 py-3">Employee</th>
                <th className="px-3.5 py-3">Current Stage</th>
                <th className="px-3.5 py-3">Status</th>
                <th className="px-3.5 py-3">Due Date</th>
                <th className="px-3.5 py-3">Current Owner</th>
                <th className="px-3.5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const primaryAction =
                    item.status === "Draft"
                      ? "Continue"
                      : item.status === "Returned to Clerk"
                        ? "Correct"
                        : item.status === "Pending Reporting Officer" && user?.activeRoleCode === "REPORTING_OFFICER"
                          ? "Review"
                          : (item.status === "Pending Countersigning" || item.status === "Pending Countersigning Officer") && user?.activeRoleCode === "COUNTERSIGNING_OFFICER"
                            ? "Review"
                            : item.status === "Pending Secret Branch Review" && user?.activeRoleCode === "SECRET_BRANCH"
                              ? "Review"
                              : item.status === "Pending Secret Branch Verification" && user?.activeRoleCode === "SECRET_BRANCH"
                                ? "Verify"
                                : user?.activeRoleCode === "EMPLOYEE"
                                  ? "View"
                          : "Open";

                  const href =
                    (item.status === "Pending Reporting Officer" && user?.activeRoleCode === "REPORTING_OFFICER") ||
                    ((item.status === "Pending Countersigning" || item.status === "Pending Countersigning Officer") && user?.activeRoleCode === "COUNTERSIGNING_OFFICER")
                      ? `/review/${item.id}`
                      : `/acr/${item.id}`;

                  return (
                    <tr key={item.id} className="border-b border-[var(--fia-gray-100)] last:border-b-0">
                      <td className="px-3.5 py-3.5">
                        <Link href={`/acr/${item.id}`} className="font-semibold text-[var(--fia-navy)] hover:text-[var(--fia-cyan)]">
                          {item.acrNo}
                        </Link>
                        <p className="mt-1 text-xs text-[var(--fia-gray-400)]">{item.reportingPeriod}</p>
                      </td>
                      <td className="px-3.5 py-3.5">
                        <p className="font-semibold text-[var(--fia-gray-900)]">{item.employee.name}</p>
                        <p className="mt-1 text-xs text-[var(--fia-gray-500)]">
                          {item.employee.rank} · BPS-{item.employee.bps}
                        </p>
                      </td>
                      <td className="px-3.5 py-3.5 text-[var(--fia-gray-700)]">{getCurrentStageLabel(item)}</td>
                      <td className="px-3.5 py-3.5">
                        <div className="flex flex-wrap gap-2">
                          <StatusChip status={item.status} />
                          {item.isPriority ? <PriorityBadge priority /> : null}
                          {item.isOverdue ? <OverdueBadge days={item.overdueDays} /> : null}
                        </div>
                      </td>
                      <td className={`px-3.5 py-3.5 ${item.isOverdue ? "font-semibold text-[var(--fia-danger)]" : "text-[var(--fia-gray-700)]"}`}>
                        {item.isOverdue ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#BE123C] animate-pulse" />
                            {item.dueDate}
                          </span>
                        ) : item.dueDate}
                      </td>
                      <td className="px-3.5 py-3.5 text-[var(--fia-gray-700)]">{getCurrentOwnerLabel(item)}</td>
                      <td className="px-3.5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={href}
                            className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#EEF8FF] to-[#D7EFFB] px-3.5 py-1.5 text-xs font-semibold text-[#0369A1] border border-[#BAE6FD] transition-colors hover:border-[#0095D9] hover:text-[#0095D9]"
                          >
                            {primaryAction}
                          </Link>
                          {item.status === "Draft" ? (
                            <button
                              type="button"
                              disabled={mutation.isPending}
                              onClick={() => mutation.mutate({ id: item.id, action: "submit_to_reporting" })}
                              className="rounded-full bg-gradient-to-r from-[#1A1C6E] to-[#2D308F] px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_2px_8px_rgba(26,28,110,0.25)] hover:shadow-[0_4px_14px_rgba(26,28,110,0.35)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Submit
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </PortalSurface>
    </div>
  );
}
