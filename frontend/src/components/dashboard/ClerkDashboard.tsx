"use client";

import { FilePlus, Send, RotateCcw, Archive, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { DashboardOverview, UserSession } from "@/types/contracts";
import {
  PortalPageHeader,
  PortalSurface,
  QuickLinkCard,
  QuietBarChart,
} from "@/components/portal/PortalPrimitives";
import { StatusPieChart } from "./charts";
import { WorkflowPipeline } from "./WorkflowPipeline";
import { StatCard, StatusChip, OverdueBadge } from "@/components/ui";
import {
  isClosedStatus,
  isDraftStatus,
  isOpenStatus,
  isReturnedStatus,
  sortAcrsByUrgency,
  buildDueDateDistribution,
} from "@/utils/acr";
import { RetirementWarnings } from "./RetirementWarnings";

interface ClerkDashboardProps {
  session: UserSession;
  overview: DashboardOverview;
}

export function ClerkDashboard({ session, overview }: ClerkDashboardProps) {
  const router = useRouter();
  const items = overview.items;

  // Calculate stats
  const stats = {
    drafts: items.filter((item) => isDraftStatus(item.status)).length,
    inFlight: items.filter(
      (item) =>
        isOpenStatus(item.status) &&
        !isDraftStatus(item.status) &&
        !isReturnedStatus(item.status),
    ).length,
    returned: items.filter((item) => isReturnedStatus(item.status)).length,
    closed: items.filter((item) => isClosedStatus(item.status)).length,
  };

  // Build distribution data for donut chart
  const distributionData = overview.distribution.map((entry) => ({
    label: entry.label,
    value: entry.value,
    color: statusToColor(entry.label),
  }));

  // Build due-date horizon data
  const dueDateData = buildDueDateDistribution(items).map((entry) => ({
    label: entry.label,
    value: entry.value,
    color: dueDateToColor(entry.label),
  }));

  // Build pipeline stages for workflow progress band
  const pipelineStages = [
    { label: "Draft",          color: "#94A3B8" },
    { label: "Admin Office",   color: "#8B5CF6" },
    { label: "Reporting",      color: "#F59E0B" },
    { label: "Countersigning", color: "#3B82F6" },
    { label: "Secret Branch",  color: "#0EA5E9" },
    { label: "Archived",       color: "#10B981" },
  ].map((stage) => ({
    ...stage,
    count: overview.distribution.find((d) =>
      d.label.toLowerCase().includes(stage.label.toLowerCase().split(" ")[0])
    )?.value ?? 0,
  }));

  // Get active queue - top 8 items sorted by urgency
  const activeQueue = sortAcrsByUrgency(
    items.filter((item) => !isClosedStatus(item.status)),
  ).slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Page Header with Action */}
      <PortalPageHeader
        eyebrow="Clerk · Record Initiation & Queue"
        title="Clerk Dashboard"
        actions={
          <Link
            href="/acr/new"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--fia-navy)] px-3.5 py-2 text-sm font-semibold text-white transition-all hover:shadow-[0_4px_12px_rgba(15,23,42,0.2)]"
          >
            <FilePlus size={16} />
            Initiate New ACR
          </Link>
        }
      />

      {/* KPI Stats - 4 cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Drafts"
          value={stats.drafts}
          icon={<FilePlus size={18} />}
          accent="navy"
          onClick={() => router.push("/queue?status=Draft")}
        />
        <StatCard
          title="In-Flight"
          value={stats.inFlight}
          icon={<Send size={18} />}
          accent="cyan"
          onClick={() => router.push("/queue")}
        />
        <StatCard
          title="Returned to Clerk"
          value={stats.returned}
          icon={<RotateCcw size={18} />}
          accent="amber"
          onClick={() => router.push("/queue?status=Returned%20to%20Clerk")}
        />
        <StatCard
          title="Closed / Archived"
          value={stats.closed}
          icon={<Archive size={18} />}
          accent="green"
          onClick={() => router.push("/queue?status=Archived")}
        />
      </div>

      {/* Workflow Progress Band */}
      <WorkflowPipeline stages={pipelineStages} title="Workflow Pipeline" />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuickLinkCard
          href="/acr/new"
          icon={FilePlus}
          title="Initiate New ACR"
          description="Start a new ACR record"
          tone="navy"
        />
        <QuickLinkCard
          href="/queue?status=Draft"
          icon={RotateCcw}
          title="Continue Drafts"
          description="Resume incomplete records"
          tone="amber"
        />
        <QuickLinkCard
          href="/queue?status=Returned"
          icon={RotateCcw}
          title="Handle Returns"
          description="Address rejected records"
          tone="red"
        />
      </div>

      {/* Charts Section - Two Columns */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Workflow Status Donut */}
        {distributionData.some((d) => d.value > 0) ? (
          <StatusPieChart data={distributionData} title="Workflow Status" />
        ) : (
          <PortalSurface title="Workflow Status">
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-[var(--fia-gray-500)]">No data available</p>
            </div>
          </PortalSurface>
        )}

        {/* Due-Date Horizon Bar Chart */}
        <PortalSurface title="Due-Date Horizon">
          {dueDateData.length > 0 && dueDateData.some((d) => d.value > 0) ? (
            <QuietBarChart data={dueDateData} />
          ) : (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-[var(--fia-gray-500)]">No active records</p>
            </div>
          )}
        </PortalSurface>
      </div>

      {/* Active Queue Table */}
      <PortalSurface
        title="Active Clerk Queue"
        subtitle="Records currently in initiation scope"
      >
        {activeQueue.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--fia-gray-200)]">
                  <th className="pb-2.5 text-left font-semibold text-[var(--fia-gray-600)]">
                    ACR No
                  </th>
                  <th className="pb-2.5 text-left font-semibold text-[var(--fia-gray-600)]">
                    Employee
                  </th>
                  <th className="pb-2.5 text-left font-semibold text-[var(--fia-gray-600)]">
                    Status
                  </th>
                  <th className="pb-2.5 text-left font-semibold text-[var(--fia-gray-600)]">
                    Due Date
                  </th>
                  <th className="pb-2.5 text-left font-semibold text-[var(--fia-gray-600)]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fia-gray-200)]">
                {activeQueue.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--fia-gray-50)]">
                    <td className="py-2.5 font-semibold text-[var(--fia-gray-900)]">
                      {item.acrNo}
                    </td>
                    <td className="py-2.5 text-[var(--fia-gray-700)]">
                      {item.employee.name}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        <StatusChip status={item.status} size="sm" />
                        {item.isOverdue && item.overdueDays !== undefined && (
                          <OverdueBadge days={item.overdueDays} />
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 text-[var(--fia-gray-600)]">
                      {item.dueDate
                        ? new Date(item.dueDate).toLocaleDateString("en-PK", {
                            month: "short",
                            day: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="py-2.5">
                      <Link
                        href={`/acr/${item.id}`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--fia-navy)] hover:underline"
                      >
                        Open
                        <ArrowRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--fia-gray-300)] bg-[var(--fia-gray-50)] px-4 py-6 text-center">
            <p className="font-semibold text-[var(--fia-gray-900)]">No Active Records</p>
            <p className="mt-1 text-sm text-[var(--fia-gray-500)]">
              All records have been completed or archived.
            </p>
          </div>
        )}
      </PortalSurface>

      {/* Retirement Warnings */}
      {overview.retirementWarnings && overview.retirementWarnings.length > 0 && (
        <RetirementWarnings warnings={overview.retirementWarnings} />
      )}
    </div>
  );
}

// Helper functions for color mapping
function statusToColor(label: string): string {
  const colorMap: Record<string, string> = {
    Draft: "var(--fia-gray-400)",
    "Needs Review": "var(--fia-warning)",
    Countersigning: "var(--fia-cyan)",
    "Secret Branch": "var(--fia-navy)",
    Returned: "#E11D48",
    Closed: "var(--fia-success)",
  };
  return colorMap[label] || "var(--fia-navy)";
}

function dueDateToColor(label: string): string {
  const colorMap: Record<string, string> = {
    Overdue: "#DC2626",
    "0-7 days": "var(--fia-warning)",
    "8-14 days": "var(--fia-cyan)",
    "15+ days": "var(--fia-success)",
  };
  return colorMap[label] || "var(--fia-navy)";
}
