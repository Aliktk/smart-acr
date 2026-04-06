"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { getAcrs, transitionAcr } from "@/api/client";
import { PortalPageHeader, PortalSurface, EmptyState, SegmentedTabs } from "@/components/portal/PortalPrimitives";
import { FloatingToast, OverdueBadge, PriorityBadge, StatusChip } from "@/components/ui";
import { useShell } from "@/hooks/useShell";
import { syncAcrSummaryCaches } from "@/utils/acr-cache";
import {
  countStatuses,
  getCurrentOwnerLabel,
  getCurrentStageLabel,
  isClosedStatus,
  isOverdueStatus,
  sortAcrsByUrgency,
} from "@/utils/acr";
import { getRoleLabel } from "@/utils/roles";

type QueueView = "attention" | "open" | "returned" | "closed" | "all";

function deriveInitialView(searchParams: URLSearchParams): QueueView {
  const explicitStatus = searchParams.get("status");
  const priorityOnly = searchParams.get("priority") === "true";

  if (priorityOnly || explicitStatus === "Overdue") {
    return "attention";
  }
  if (explicitStatus === "Returned") {
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
    queryKey: ["acrs", deferredQuery],
    queryFn: () => getAcrs({ query: deferredQuery || undefined }),
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
  const operationalRole = user?.activeRoleCode === "CLERK" ||
    user?.activeRoleCode === "REPORTING_OFFICER" ||
    user?.activeRoleCode === "COUNTERSIGNING_OFFICER" ||
    user?.activeRoleCode === "SECRET_BRANCH";
  const ownedItems = useMemo(() => {
    if (!operationalRole || !user?.id) {
      return items;
    }

    return items.filter((item) => item.currentHolderId === user.id);
  }, [items, operationalRole, user?.id]);
  const counts = countStatuses(ownedItems);

  const filtered = useMemo(() => {
    let next = ownedItems;

    if (view === "attention") {
      next = next.filter((item) => item.isPriority || isOverdueStatus(item) || item.status === "Returned");
    } else if (view === "open") {
      next = next.filter((item) => !isClosedStatus(item.status) && item.status !== "Returned");
    } else if (view === "returned") {
      next = next.filter((item) => item.status === "Returned");
    } else if (view === "closed") {
      next = next.filter((item) => isClosedStatus(item.status));
    }

    if (explicitStatus) {
      next = next.filter((item) => item.status === explicitStatus);
    }

    if (priorityFromQuery) {
      next = next.filter((item) => item.isPriority);
    }

    return sortAcrsByUrgency(next);
  }, [explicitStatus, ownedItems, priorityFromQuery, view]);

  const tabs: Array<{ key: QueueView; label: string; count: number }> = [
    { key: "attention", label: "Needs attention", count: ownedItems.filter((item) => item.isPriority || isOverdueStatus(item) || item.status === "Returned").length },
    { key: "open", label: "Open work", count: counts.open - counts.returned },
    { key: "returned", label: "Returned", count: counts.returned },
    { key: "closed", label: "Closed", count: counts.closed },
    { key: "all", label: "All records", count: counts.total },
  ];

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
        title="Operational Queue"
      />

      <PortalSurface title="Queue view">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <SegmentedTabs tabs={tabs} value={view} onChange={setView} />
          <label className="relative block w-full max-w-[340px]">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--fia-gray-400)]" />
            <input
              value={queryText}
              onChange={(event) => setQueryText(event.target.value)}
              placeholder="Search by record, employee, CNIC, rank, or office"
              className="w-full rounded-full border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] py-2.5 pl-11 pr-4 text-sm outline-none transition-all focus:border-[var(--fia-cyan)] focus:bg-white focus:ring-4 focus:ring-[rgba(0,149,217,0.10)]"
            />
          </label>
        </div>
      </PortalSurface>

      <PortalSurface title="Working records">
        {actionError ? (
          <div className="mb-3 rounded-2xl border border-[var(--fia-danger-soft)] bg-[#FFF1F2] px-4 py-3 text-sm text-[var(--fia-danger)]">
            {actionError}
          </div>
        ) : null}
        {data === undefined ? (
          <div className="py-12 text-center text-sm text-[var(--fia-gray-500)]">Loading queue records...</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No records match this queue view"
            description="Try another queue segment or broaden the search term. Closed and active records remain available through the other queue views."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-[var(--fia-gray-100)] bg-[var(--fia-gray-50)] text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">
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
                      : item.status === "Returned"
                        ? "Correct"
                        : item.status === "Pending Reporting Officer" && user?.activeRoleCode === "REPORTING_OFFICER"
                          ? "Review"
                          : item.status === "Pending Countersigning" && user?.activeRoleCode === "COUNTERSIGNING_OFFICER"
                            ? "Review"
                          : "Open";

                  const href =
                    (item.status === "Pending Reporting Officer" && user?.activeRoleCode === "REPORTING_OFFICER") ||
                    (item.status === "Pending Countersigning" && user?.activeRoleCode === "COUNTERSIGNING_OFFICER")
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
                        {item.dueDate}
                      </td>
                      <td className="px-3.5 py-3.5 text-[var(--fia-gray-700)]">{getCurrentOwnerLabel(item)}</td>
                      <td className="px-3.5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Link
                            href={href}
                            className="inline-flex items-center gap-2 rounded-full bg-[var(--fia-cyan-100)] px-3.5 py-1.5 font-semibold text-[var(--fia-cyan)] transition-colors hover:bg-[#D7EFFB]"
                          >
                            {primaryAction}
                          </Link>
                          {item.status === "Draft" ? (
                            <button
                              type="button"
                              disabled={mutation.isPending}
                              onClick={() => mutation.mutate({ id: item.id, action: "submit_to_reporting" })}
                              className="rounded-full bg-[var(--fia-navy)] px-3.5 py-1.5 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
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
