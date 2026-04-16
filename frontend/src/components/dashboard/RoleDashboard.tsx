"use client";

import Link from "next/link";
import {
  Archive,
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FilePlus,
  FileStack,
  FolderArchive,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { AcrSummary, DashboardOverview, UserRoleCode, UserSession } from "@/types/contracts";
import { RetirementWarnings } from "./RetirementWarnings";
import { PortalPageHeader, PortalSurface, QuickLinkCard, QuietBarChart, QuietDonutChart, EmptyState } from "@/components/portal/PortalPrimitives";
import { OverdueBadge, PriorityBadge, StatCard, StatusChip } from "@/components/ui";
import {
  buildDueDateDistribution,
  buildStatusDistribution,
  countStatuses,
  getCurrentOwnerLabel,
  getCurrentStageLabel,
  getDashboardMode,
  groupAcrsByServicePeriod,
  isClosedStatus,
  isOverdueStatus,
  sortAcrsByUrgency,
  type DashboardMode,
} from "@/utils/acr";
import { getRoleLabel } from "@/utils/roles";
import { LeadershipDashboard } from "@/components/dashboard/LeadershipDashboard";
import { EmployeeDashboard } from "@/components/dashboard/EmployeeDashboard";
import { ClerkDashboard } from "@/components/dashboard/ClerkDashboard";
import { OperationalDashboard } from "@/components/dashboard/OperationalDashboard";

type LeadershipAnalytics = {
  wingWiseTrends: Array<{ name: string; employees: number; offices: number; acrCount: number }>;
  backlogDistribution: Array<{ name: string; pending: number }>;
};

type DashboardAction = {
  href: string;
  title: string;
  description: string;
  icon: typeof FilePlus;
  tone?: "navy" | "cyan" | "amber" | "green" | "red";
};

type ModeConfig = {
  title: string;
  actions: DashboardAction[];
  tableTitle: string;
  actionLabel: string;
};

function countMatching(items: AcrSummary[], predicate: (item: AcrSummary) => boolean) {
  return items.filter(predicate).length;
}

function roleItems(mode: DashboardMode, items: AcrSummary[]) {
  switch (mode) {
    case "reporting":
      return sortAcrsByUrgency(
        items.filter((item) =>
          item.status === "Pending Reporting Officer" ||
          item.status === "In Review" ||
          item.status === "Returned to Reporting Officer" ||
          isOverdueStatus(item),
        ),
      );
    case "countersigning":
      return sortAcrsByUrgency(
        items.filter((item) =>
          item.status === "Pending Countersigning" ||
          item.status === "Pending Countersigning Officer" ||
          item.status === "Returned to Countersigning Officer" ||
          isOverdueStatus(item),
        ),
      );
    case "secret-branch":
      return sortAcrsByUrgency(
        items.filter((item) =>
          item.status === "Pending Secret Branch Review" ||
          item.status === "Pending Secret Branch Verification" ||
          isClosedStatus(item.status),
        ),
      );
    case "executive":
      return sortAcrsByUrgency(items.filter((item) => item.isPriority || isOverdueStatus(item) || !isClosedStatus(item.status)));
    case "employee":
      return sortAcrsByUrgency(items);
    case "clerk":
    default:
      return sortAcrsByUrgency(items.filter((item) => !isClosedStatus(item.status)));
  }
}

function buildModeConfig(mode: DashboardMode): ModeConfig {
  switch (mode) {
    case "reporting":
      return {
        title: "Reporting Officer Dashboard",
        actions: [
          { href: "/queue?status=Pending%20Reporting%20Officer", title: "Open review queue", description: "Jump straight into assigned files awaiting remarks.", icon: ClipboardCheck, tone: "navy" },
          { href: "/queue?priority=true", title: "Priority cases", description: "Focus on urgent records flagged for immediate handling.", icon: ShieldCheck, tone: "amber" },
          { href: "/search", title: "Search records", description: "Look up an employee or ACR without losing queue context.", icon: Search, tone: "cyan" },
        ],
        tableTitle: "Pending review queue",
        actionLabel: "Review",
      };
    case "countersigning":
      return {
        title: "Countersigning Dashboard",
        actions: [
          { href: "/queue?status=Pending%20Countersigning", title: "Awaiting countersign", description: "See every record that still needs countersigning action.", icon: FileCheck2, tone: "navy" },
          { href: "/queue?priority=true", title: "Priority approvals", description: "Urgent packets brought to the top of the desk.", icon: Sparkles, tone: "amber" },
          { href: "/search", title: "Search supporting records", description: "Find employee history or related ACRs before approving.", icon: Search, tone: "cyan" },
        ],
        tableTitle: "Approval queue",
        actionLabel: "Open",
      };
    case "secret-branch":
      return {
        title: "Secret Branch Dashboard",
        actions: [
          { href: "/queue?status=Pending%20Secret%20Branch%20Review", title: "Review queue", description: "Process desk allocation and internal review items entering Secret Branch.", icon: ClipboardCheck, tone: "navy" },
          { href: "/archive", title: "Open archive", description: "Review finalized packets and authoritative references.", icon: FolderArchive, tone: "green" },
          { href: "/search", title: "Enterprise search", description: "Find any record, employee, or packet reference quickly.", icon: Search, tone: "cyan" },
        ],
        tableTitle: "Secret Branch workload",
        actionLabel: "Open",
      };
    case "executive":
      return {
        title: "Executive Dashboard",
        actions: [
          { href: "/search", title: "Search records", description: "Locate any ACR or employee record quickly.", icon: Search, tone: "cyan" },
          { href: "/archive", title: "Open archive", description: "View archived and finalized ACR records.", icon: FolderArchive, tone: "green" },
        ],
        tableTitle: "Exception watchlist",
        actionLabel: "View brief",
      };
    case "employee":
      return {
        title: "Employee Dashboard",
        actions: [
          { href: "/queue", title: "My ACR history", description: "Track current and previous ACR cycles with employee-safe workflow visibility.", icon: FileStack, tone: "navy" },
          { href: "/archive", title: "Archive metadata", description: "View historical archive entries and uploaded legacy records linked to your profile.", icon: FolderArchive, tone: "green" },
        ],
        tableTitle: "Your ACR records",
        actionLabel: "Track",
      };
    case "clerk":
    default:
      return {
        title: "Clerk Dashboard",
        actions: [
          { href: "/acr/new", title: "Initiate new ACR", description: "Create a clean new record and start the annual reporting flow.", icon: FilePlus, tone: "navy" },
          { href: "/queue?status=Draft", title: "Continue drafts", description: "Resume work that has not yet been submitted onward.", icon: FileStack, tone: "amber" },
          { href: "/queue?status=Returned%20to%20Clerk", title: "Handle returns", description: "Correct and resubmit records that came back with remarks.", icon: Send, tone: "red" },
        ],
        tableTitle: "Active clerk queue",
        actionLabel: "Open",
      };
  }
}

function buildMetricCards(mode: DashboardMode, items: AcrSummary[], overview: DashboardOverview) {
  const counts = countStatuses(items);

  switch (mode) {
    case "reporting":
      return [
        {
          title: "Pending Review",
          value: countMatching(items, (item) => item.status === "Pending Reporting Officer" || item.status === "In Review" || item.status === "Overdue"),
          subtitle: "Awaiting reporting action",
          icon: <ClipboardCheck size={18} />,
          accent: "navy" as const,
        },
        {
          title: "Priority Files",
          value: counts.priority,
          subtitle: "Flagged for urgent attention",
          icon: <ShieldCheck size={18} />,
          accent: "amber" as const,
        },
        {
          title: "Overdue",
          value: counts.overdue,
          subtitle: "Require immediate action",
          icon: <Clock3 size={18} />,
          accent: "red" as const,
        },
        {
          title: "Closed",
          value: counts.closed,
          subtitle: "Finished within your scope",
          icon: <Archive size={18} />,
          accent: "green" as const,
        },
      ];
    case "countersigning":
      return [
        {
          title: "Awaiting Countersign",
          value: countMatching(items, (item) => item.status === "Pending Countersigning" || item.status === "Pending Countersigning Officer" || item.status === "Overdue"),
          subtitle: "Ready for final supervisory review",
          icon: <FileCheck2 size={18} />,
          accent: "navy" as const,
        },
        {
          title: "Priority Queue",
          value: counts.priority,
          subtitle: "High-sensitivity approvals",
          icon: <Sparkles size={18} />,
          accent: "amber" as const,
        },
        {
          title: "Overdue",
          value: counts.overdue,
          subtitle: "Outside due window",
          icon: <Clock3 size={18} />,
          accent: "red" as const,
        },
        {
          title: "Submitted Onward",
          value: countMatching(items, (item) => item.status === "Pending Secret Branch Review" || item.status === "Pending Secret Branch Verification" || isClosedStatus(item.status)),
          subtitle: "Already moved beyond countersigning",
          icon: <Send size={18} />,
          accent: "cyan" as const,
        },
      ];
    case "secret-branch":
      return [
        {
          title: "Finalized Records",
          value: countMatching(items, (item) => item.status === "Archived" || item.status === "Completed"),
          subtitle: "Closed in Secret Branch custody",
          icon: <FolderArchive size={18} />,
          accent: "navy" as const,
        },
        {
          title: "Pending Review",
          value: countMatching(items, (item) => item.status === "Pending Secret Branch Review"),
          subtitle: "Desk review pending",
          icon: <Archive size={18} />,
          accent: "amber" as const,
        },
        {
          title: "Pending Verification",
          value: countMatching(items, (item) => item.status === "Pending Secret Branch Verification"),
          subtitle: "Awaiting AD Secret Branch verification",
          icon: <Send size={18} />,
          accent: "cyan" as const,
        },
        {
          title: "Visible Scope",
          value: counts.total,
          subtitle: "Final records accessible to this role",
          icon: <BarChart3 size={18} />,
          accent: "amber" as const,
        },
      ];
    case "executive":
      return [
        {
          title: "Active Records",
          value: counts.open,
          subtitle: "Visible in the current leadership scope",
          icon: <FileStack size={18} />,
          accent: "navy" as const,
          trend: overview.summary.initiatedDeltaPercent !== null
            ? {
                value: overview.summary.initiatedDeltaPercent,
                label: "vs previous cycle",
                up: overview.summary.initiatedDeltaPercent >= 0,
              }
            : undefined,
        },
        {
          title: "Overdue",
          value: counts.overdue,
          subtitle: "Exception-driven workload",
          icon: <Clock3 size={18} />,
          accent: "red" as const,
        },
        {
          title: "Priority",
          value: counts.priority,
          subtitle: "Records escalated for attention",
          icon: <ShieldCheck size={18} />,
          accent: "amber" as const,
        },
        {
          title: "Closed",
          value: counts.closed,
          subtitle: "Archived or completed records",
          icon: <Archive size={18} />,
          accent: "green" as const,
          trend: overview.summary.completedDeltaPercent !== null
            ? {
                value: overview.summary.completedDeltaPercent,
                label: "vs previous cycle",
                up: overview.summary.completedDeltaPercent >= 0,
              }
            : undefined,
        },
      ];
    case "employee":
      return [
        {
          title: "Active Cycle",
          value: countMatching(items, (item) => !isClosedStatus(item.status) && !item.status.startsWith("Returned")),
          subtitle: "Currently moving in workflow",
          icon: <FileStack size={18} />,
          accent: "navy" as const,
        },
        {
          title: "Returned / Rework",
          value: counts.returned,
          subtitle: "Needs upstream correction",
          icon: <Send size={18} />,
          accent: "amber" as const,
        },
        {
          title: "Archived",
          value: countMatching(items, (item) => item.status === "Archived" || item.status === "Completed"),
          subtitle: "Closed cycles",
          icon: <Archive size={18} />,
          accent: "green" as const,
        },
        {
          title: "Visible Records",
          value: counts.total,
          subtitle: "Personal ACR history",
          icon: <Search size={18} />,
          accent: "cyan" as const,
        },
      ];
    case "clerk":
    default:
      return [
        {
          title: "Drafts",
          value: counts.drafts,
          subtitle: "Still in initiation stage",
          icon: <FilePlus size={18} />,
          accent: "navy" as const,
        },
        {
          title: "In Flight",
          value: countMatching(items, (item) => !isClosedStatus(item.status) && item.status !== "Draft" && !item.status.startsWith("Returned")),
          subtitle: "Submitted and still active",
          icon: <FileStack size={18} />,
          accent: "cyan" as const,
        },
        {
          title: "Returned",
          value: counts.returned,
          subtitle: "Back for correction",
          icon: <Send size={18} />,
          accent: "amber" as const,
        },
        {
          title: "Closed",
          value: counts.closed,
          subtitle: "Archived or completed",
          icon: <Archive size={18} />,
          accent: "green" as const,
        },
      ];
  }
}

function chartPalette(index: number) {
  const colors = [
    "var(--fia-navy)",
    "var(--fia-cyan)",
    "var(--fia-warning)",
    "var(--fia-success)",
    "#7C3AED",
    "#E11D48",
  ];

  return colors[index % colors.length];
}

function DashboardRecordsTable({
  title,
  items,
  actionLabel,
  mode,
}: {
  title: string;
  items: AcrSummary[];
  actionLabel: string;
  mode: DashboardMode;
}) {
  return (
    <PortalSurface title={title}>
      {items.length === 0 ? (
        <EmptyState
          title={mode === "employee" ? "No employee history is available yet" : "No records need attention"}
          description={
            mode === "employee"
              ? "Your personal ACR metadata will appear here as records are initiated and move through workflow."
              : "Your highest-priority queue is clear for now. The next items will appear here as workflow states change."
          }
        />
      ) : mode === "employee" ? (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="border-b border-[var(--fia-gray-100)] bg-[var(--fia-gray-50)] text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">
              <tr>
                <th className="px-3.5 py-3">ACR</th>
                <th className="px-3.5 py-3">Template / Period</th>
                <th className="px-3.5 py-3">Workflow Transparency</th>
                <th className="px-3.5 py-3">Archive</th>
                <th className="px-3.5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
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
                      RO: <span className="font-medium text-[var(--fia-gray-900)]">{item.reportingOfficer}</span>
                    </p>
                    <p className="mt-1 text-xs text-[var(--fia-gray-600)]">
                      CSO: <span className="font-medium text-[var(--fia-gray-900)]">{item.countersigningOfficer ?? "Not applicable"}</span>
                    </p>
                  </td>
                  <td className="px-3.5 py-3.5 align-top text-[var(--fia-gray-700)]">
                    <p className="font-medium">{item.secretBranch?.status ?? getCurrentStageLabel(item)}</p>
                    <p className="mt-1 text-xs text-[var(--fia-gray-500)]">
                      Initiated: {item.initiatedDate}
                    </p>
                    <p className="mt-1 text-xs text-[var(--fia-gray-500)]">
                      Submitted to RO: {item.submittedToReportingAt ? new Date(item.submittedToReportingAt).toLocaleDateString("en-PK") : "Pending"}
                    </p>
                    <p className="mt-1 text-xs text-[var(--fia-gray-500)]">
                      Sent to Secret Branch: {item.secretBranch?.submittedAt ? new Date(item.secretBranch.submittedAt).toLocaleDateString("en-PK") : "Not yet"}
                    </p>
                  </td>
                  <td className="px-3.5 py-3.5 align-top text-[var(--fia-gray-700)]">
                    <p className="font-medium">{item.completedDate ?? item.archivedAt ?? "In progress"}</p>
                    <p className="mt-1 text-xs text-[var(--fia-gray-500)]">
                      PDF retained: {item.hasHistoricalPdf ? "Yes, restricted" : "Not available"}
                    </p>
                  </td>
                  <td className="px-3.5 py-3.5 text-right align-top">
                    <Link
                      href={`/acr/${item.id}`}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--fia-cyan-100)] px-3.5 py-1.5 font-semibold text-[var(--fia-cyan)] transition-colors hover:bg-[#D7EFFB]"
                    >
                      {actionLabel}
                      <ArrowRight size={14} />
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
            <thead className="border-b border-[var(--fia-gray-100)] bg-[var(--fia-gray-50)] text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">
              <tr>
                <th className="px-3.5 py-3">{mode === "executive" ? "ACR No" : "Record"}</th>
                <th className="px-3.5 py-3">Employee</th>
                <th className="px-3.5 py-3">{mode === "executive" ? "Stage" : "Current Stage"}</th>
                <th className="px-3.5 py-3">Status</th>
                {mode === "executive" ? (
                  <th className="px-3.5 py-3">Days Overdue</th>
                ) : (
                  <>
                    <th className="px-3.5 py-3">Due Date</th>
                    <th className="px-3.5 py-3">Current Owner</th>
                  </>
                )}
                <th className="px-3.5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={`border-b border-[var(--fia-gray-100)] last:border-b-0 ${mode === "executive" && item.isOverdue ? "bg-[rgba(239,68,68,0.02)]" : ""}`}>
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
                    <div className="flex flex-wrap gap-1.5">
                      <StatusChip status={item.status} />
                      {item.isPriority ? <PriorityBadge priority /> : null}
                      {mode !== "executive" && item.isOverdue ? <OverdueBadge days={item.overdueDays} /> : null}
                    </div>
                  </td>
                  {mode === "executive" ? (
                    <td className="px-3.5 py-3.5">
                      {item.isOverdue ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--fia-danger-bg,rgba(239,68,68,0.1))] px-2.5 py-0.5 text-xs font-bold text-[var(--fia-danger)]">
                          +{item.overdueDays ?? 0}d
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--fia-gray-400)]">—</span>
                      )}
                    </td>
                  ) : (
                    <>
                      <td className={`px-3.5 py-3.5 ${item.isOverdue ? "font-semibold text-[var(--fia-danger)]" : "text-[var(--fia-gray-700)]"}`}>
                        {item.dueDate}
                      </td>
                      <td className="px-3.5 py-3.5 text-[var(--fia-gray-700)]">{getCurrentOwnerLabel(item)}</td>
                    </>
                  )}
                  <td className="px-3.5 py-3.5 text-right">
                    <Link
                      href={`/acr/${item.id}`}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[var(--fia-cyan-100)] px-3.5 py-1.5 text-xs font-semibold text-[var(--fia-cyan)] transition-colors hover:bg-[#D7EFFB]"
                    >
                      {actionLabel}
                      <ArrowRight size={12} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PortalSurface>
  );
}

const emptyOverview: DashboardOverview = {
  metrics: {
    initiatedCount: 0,
    pendingCount: 0,
    overdueCount: 0,
    completedCount: 0,
    archivedCount: 0,
    priorityCount: 0,
    averageCompletionDays: 0,
  },
  summary: {
    fiscalYearLabel: "",
    totalCount: 0,
    draftCount: 0,
    submittedCount: 0,
    returnedCount: 0,
    currentFiscalInitiatedCount: 0,
    currentFiscalPendingCount: 0,
    currentFiscalCompletedCount: 0,
    currentFiscalReturnedCount: 0,
    initiatedDeltaPercent: null,
    completedDeltaPercent: null,
  },
  distribution: [],
  items: [],
};

export function RoleDashboard({
  session,
  overview,
  analytics,
}: {
  session?: UserSession;
  overview?: DashboardOverview;
  analytics?: LeadershipAnalytics;
}) {
  const activeRoleCode: UserRoleCode = session?.activeRoleCode ?? "CLERK";
  const mode = getDashboardMode(activeRoleCode);

  // ── Route each role tier to the correct scoped dashboard ──
  if (!session) {
    return <div className="p-6 text-sm text-[var(--fia-gray-500)]">Loading session…</div>;
  }

  if (mode === "executive" || mode === "secret-branch") {
    return <LeadershipDashboard session={session} />;
  }

  if (mode === "employee") {
    return (
      <EmployeeDashboard
        session={session!}
        overview={overview ?? emptyOverview}
      />
    );
  }

  if (mode === "clerk") {
    return (
      <ClerkDashboard
        session={session!}
        overview={overview ?? emptyOverview}
      />
    );
  }

  if (mode === "reporting" || mode === "countersigning") {
    return (
      <OperationalDashboard
        session={session!}
        overview={overview ?? emptyOverview}
        mode={mode}
      />
    );
  }

  const config = buildModeConfig(mode);
  const items = overview?.items ?? [];
  const ownerScopedItems =
    session?.id && (mode === "clerk" || mode === "reporting" || mode === "countersigning" || mode === "secret-branch")
      ? items.filter((item) => item.currentHolderId === session.id || (mode === "secret-branch" && isClosedStatus(item.status)))
      : items;
  const focusItems = roleItems(mode, ownerScopedItems).slice(0, 6);
  const metricCards = buildMetricCards(mode, ownerScopedItems, overview ?? {
    metrics: {
      initiatedCount: 0,
      pendingCount: 0,
      overdueCount: 0,
      completedCount: 0,
      archivedCount: 0,
      priorityCount: 0,
      averageCompletionDays: 0,
    },
    summary: {
      fiscalYearLabel: "",
      totalCount: 0,
      draftCount: 0,
      submittedCount: 0,
      returnedCount: 0,
      currentFiscalInitiatedCount: 0,
      currentFiscalPendingCount: 0,
      currentFiscalCompletedCount: 0,
      currentFiscalReturnedCount: 0,
      initiatedDeltaPercent: null,
      completedDeltaPercent: null,
    },
    distribution: [],
    items: [],
  });

  const roleLabel = getRoleLabel(activeRoleCode);
  const statusChart = buildStatusDistribution(ownerScopedItems).map((entry, index) => ({
    ...entry,
    color: chartPalette(index),
  }));
  const dueChart = buildDueDateDistribution(ownerScopedItems).map((entry, index) => ({
    ...entry,
    color: chartPalette(index + 2),
  }));
  const leadershipChart = analytics?.backlogDistribution.map((entry, index) => ({
    label: entry.name,
    value: entry.pending,
    color: chartPalette(index),
  }));
  const servicePeriodGroups = mode === "employee" ? groupAcrsByServicePeriod(ownerScopedItems) : [];

  return (
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-5 p-5">
      <PortalPageHeader
        eyebrow={`${roleLabel} · Fiscal ${overview?.summary.fiscalYearLabel ?? "current cycle"}`}
        title={config.title}
        actions={
          <>
            {mode === "clerk" ? (
              <Link href="/acr/new" className="fia-btn-primary">
                <FilePlus size={16} />
                Initiate New ACR
              </Link>
            ) : null}
            {mode === "secret-branch" ? (
              <Link href="/archive" className="fia-btn-primary">
                <FolderArchive size={16} />
                Open Archive
              </Link>
            ) : null}
            {mode !== "clerk" && mode !== "executive" && mode !== "secret-branch" ? (
              <Link href="/queue" className="fia-btn-primary">
                <FileStack size={16} />
                Open Queue
              </Link>
            ) : null}
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      {overview?.retirementWarnings && overview.retirementWarnings.length > 0 ? (
        <RetirementWarnings warnings={overview.retirementWarnings} />
      ) : null}

      {mode === "employee" ? (
        <PortalSurface title="Service-period summaries" subtitle="Each service period is shown as metadata only. Confidential narrative remarks and form contents remain restricted.">
          {servicePeriodGroups.length === 0 ? (
            <EmptyState
              title="No service periods available"
              description="Your service-period summaries will appear here once ACR records are linked to your employee profile."
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {servicePeriodGroups.map((group) => {
                const archivedCount = group.items.filter((item) => item.status === "Archived" || item.status === "Completed").length;
                const activeCount = group.items.length - archivedCount;
                const latestItem = [...group.items].sort(
                  (left, right) => new Date(right.reportingPeriodTo ?? right.initiatedDate).getTime() - new Date(left.reportingPeriodTo ?? left.initiatedDate).getTime(),
                )[0];

                return (
                  <div key={group.key} className="rounded-3xl border border-[var(--fia-gray-100)] bg-[var(--fia-gray-50)] px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">Service period</p>
                    <p className="mt-2 text-lg font-semibold text-[var(--fia-gray-950)]">{group.label}</p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
                    {latestItem ? (
                      <div className="mt-4 rounded-2xl bg-[var(--card)] border border-[var(--fia-gray-100)] px-3 py-3">
                        <p className="text-xs text-[var(--fia-gray-500)]">Latest status</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <StatusChip status={latestItem.status} />
                          <span className="text-sm text-[var(--fia-gray-700)]">{latestItem.acrNo}</span>
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

      <div className={`grid gap-4 ${mode === "executive" ? "" : "xl:grid-cols-[320px_minmax(0,1fr)]"}`}>
        {config.actions.length > 0 ? (
          <PortalSurface title="Quick actions">
            <div className={config.actions.length >= 3 ? "grid gap-3 sm:grid-cols-2" : "space-y-3"}>
              {config.actions.map((action) => (
                <QuickLinkCard key={action.href} {...action} />
              ))}
            </div>
          </PortalSurface>
        ) : null}
        <div className="grid gap-4 lg:grid-cols-2">
          <PortalSurface title="Workflow status">
            <QuietDonutChart data={statusChart} />
          </PortalSurface>
          <PortalSurface title={leadershipChart && leadershipChart.length > 0 ? "Backlog by wing" : "Due-date horizon"}>
            <QuietBarChart data={leadershipChart && leadershipChart.length > 0 ? leadershipChart : dueChart} />
          </PortalSurface>
        </div>
      </div>

      <DashboardRecordsTable
        title={config.tableTitle}
        items={focusItems}
        actionLabel={config.actionLabel}
        mode={mode}
      />
    </div>
  );
}
