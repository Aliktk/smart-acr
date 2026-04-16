"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldAlert,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  ArrowRight,
  Clock,
} from "lucide-react";
import type { DashboardOverview, DashboardKpi, UserSession } from "@/types/contracts";
import { InsightsPanel } from "./InsightsPanel";
import { WorkflowPipeline } from "./WorkflowPipeline";
import { RetirementWarnings } from "./RetirementWarnings";
import { PortalPageHeader, PortalSurface, EmptyState, QuietDonutChart, QuietBarChart } from "@/components/portal/PortalPrimitives";
import { StatCard, StatusChip, PriorityBadge, OverdueBadge } from "@/components/ui";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface OperationalDashboardProps {
  session: UserSession;
  overview: DashboardOverview;
  mode: "reporting" | "countersigning";
}

const modeConfig = {
  reporting: {
    eyebrow: "Reporting Officer · Workflow Queue",
    title: "Reporting Officer Dashboard",
    pendingLabel: "Pending Reporting",
  },
  countersigning: {
    eyebrow: "Countersigning Officer · Workflow Queue",
    title: "Countersigning Dashboard",
    pendingLabel: "Pending Countersigning",
  },
};

function formatDistributionForPipeline(distribution: DashboardOverview["distribution"]) {
  const stageMapping: Record<string, { label: string; color: string }> = {
    draft: { label: "Draft", color: "var(--fia-gray-500)" },
    "admin-office": { label: "Admin Office", color: "var(--fia-cyan)" },
    reporting: { label: "Reporting", color: "var(--fia-warning)" },
    countersigning: { label: "Countersigning", color: "var(--fia-navy)" },
    "secret-branch": { label: "Secret Branch", color: "var(--fia-purple,#7C3AED)" },
    archived: { label: "Archived", color: "var(--fia-success)" },
  };

  const stages = [
    "draft",
    "admin-office",
    "reporting",
    "countersigning",
    "secret-branch",
    "archived",
  ];

  return stages.map((stage) => {
    const entry = distribution.find(
      (d) => d.label.toLowerCase().includes(stage) || stage.includes(d.label.toLowerCase())
    );
    const config = stageMapping[stage];
    return {
      label: config.label,
      count: entry?.value || 0,
      color: config.color,
    };
  });
}

function buildKpisFromMetrics(metrics: DashboardOverview["metrics"]): DashboardKpi[] {
  return [
    {
      key: "overdue",
      label: "Overdue",
      value: metrics.overdueCount || 0,
      helper: "Past due date",
      tone: "red",
    },
    {
      key: "pending",
      label: "Pending",
      value: metrics.pendingCount || 0,
      helper: "Awaiting action",
      tone: "cyan",
    },
    {
      key: "completed",
      label: "Completed",
      value: metrics.completedCount || 0,
      helper: "Closed records",
      tone: "green",
    },
    {
      key: "returned",
      label: "Returned",
      value: metrics.rectificationReturnsCount || 0,
      helper: "Correction needed",
      tone: "amber",
    },
    {
      key: "turnaround",
      label: "Avg Days",
      value: Math.round(metrics.averageCompletionDays ?? 0),
      helper: "Average completion",
      tone: "slate",
    },
    {
      key: "priority",
      label: "Priority",
      value: metrics.priorityCount || 0,
      helper: "Escalated records",
      tone: "amber",
    },
    {
      key: "total",
      label: "Total Records",
      value: metrics.initiatedCount || 0,
      helper: "In scope",
      tone: "navy",
    },
  ];
}

function countItemsInStatus(
  items: DashboardOverview["items"],
  statuses: string[]
): number {
  return items.filter((item) => statuses.includes(item.status)).length;
}

function countOverdueItems(items: DashboardOverview["items"]): number {
  return items.filter((item) => item.isOverdue).length;
}

function countReturnedItems(items: DashboardOverview["items"]): number {
  return items.filter((item) => item.status?.startsWith("Returned")).length;
}

function countCompletedItems(items: DashboardOverview["items"], mode: string): number {
  if (mode === "reporting") {
    return items.filter(
      (item) =>
        item.status === "Archived" ||
        item.status === "Pending Countersigning" ||
        item.status === "Submitted to Secret Branch"
    ).length;
  }
  return items.filter(
    (item) => item.status === "Archived" || item.status === "Submitted to Secret Branch"
  ).length;
}

export function OperationalDashboard({
  session,
  overview,
  mode,
}: OperationalDashboardProps) {
  const router = useRouter();
  const config = modeConfig[mode];
  const kpis = buildKpisFromMetrics(overview.metrics);
  const pipelineStages = formatDistributionForPipeline(overview.distribution);

  // Build KPI cards data
  const pendingCount = countItemsInStatus(
    overview.items,
    mode === "reporting"
      ? ["Pending Reporting Officer", "In Review"]
      : ["Pending Countersigning", "Pending Countersigning Officer"]
  );
  const priorityCount = overview.items.filter((item) => item.isPriority).length;
  const overdueCount = countOverdueItems(overview.items);
  const returnedCount = countReturnedItems(overview.items);
  const completedCount = countCompletedItems(overview.items, mode);

  // Filter items for priority queue (top 8, sorted by urgency)
  const priorityQueueItems = overview.items
    .filter(
      (item) =>
        item.isOverdue ||
        item.isPriority ||
        (mode === "reporting" &&
          ["Pending Reporting Officer", "In Review"].includes(item.status)) ||
        (mode === "countersigning" &&
          ["Pending Countersigning", "Pending Countersigning Officer"].includes(
            item.status
          ))
    )
    .sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      if (a.isPriority !== b.isPriority) return a.isPriority ? -1 : 1;
      return (
        new Date(a.dueDate || "").getTime() -
        new Date(b.dueDate || "").getTime()
      );
    })
    .slice(0, 8);

  // Format distribution for charts
  const donutData = overview.distribution
    .filter((d) => d.value > 0)
    .map((d) => ({
      label: d.label,
      value: d.value,
      color: {
        Draft: "var(--fia-gray-400)",
        "Admin Office": "var(--fia-cyan)",
        "In Review": "var(--fia-warning)",
        Reporting: "var(--fia-warning)",
        Countersigning: "var(--fia-navy)",
        "Secret Branch": "var(--fia-purple,#7C3AED)",
        Archived: "var(--fia-success)",
      }[d.label] || "var(--fia-navy)",
    }));

  const barChartData = overview.distribution.map((d) => ({
    name: d.label,
    value: d.value,
    fill: {
      Draft: "var(--fia-gray-400)",
      "Admin Office": "var(--fia-cyan)",
      "In Review": "var(--fia-warning)",
      Reporting: "var(--fia-warning)",
      Countersigning: "var(--fia-navy)",
      "Secret Branch": "var(--fia-purple,#7C3AED)",
      Archived: "var(--fia-success)",
    }[d.label] || "var(--fia-navy)",
  }));

  const daysOverdue = (item: typeof overview.items[0]) => {
    if (!item.isOverdue || !item.dueDate) return undefined;
    const due = new Date(item.dueDate);
    const now = new Date();
    const days = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? days : undefined;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PortalPageHeader
        eyebrow={config.eyebrow}
        title={config.title}
        actions={
          <Link
            href="/queue"
            className="inline-flex items-center gap-2 rounded-[12px] bg-[var(--fia-navy)] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
          >
            Open Full Queue
            <ArrowRight size={14} />
          </Link>
        }
      />

      {/* KPI Strip — 5 compact cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard
          title="Pending Review"
          value={pendingCount}
          icon={<ClipboardCheck size={16} />}
          accent="navy"
          onClick={() => router.push(mode === "reporting" ? "/queue?status=Pending%20Reporting%20Officer" : "/queue?status=Pending%20Countersigning")}
        />
        <StatCard
          title="Priority Files"
          value={priorityCount}
          icon={<ShieldAlert size={16} />}
          accent="amber"
          onClick={() => router.push("/queue?priority=true")}
        />
        <StatCard
          title="Overdue"
          value={overdueCount}
          icon={<AlertTriangle size={16} />}
          accent="red"
          onClick={() => router.push("/queue?overdue=true")}
        />
        <StatCard
          title="Returned to Role"
          value={returnedCount}
          icon={<RotateCcw size={16} />}
          accent="amber"
        />
        <StatCard
          title="Completed/Forwarded"
          value={completedCount}
          icon={<CheckCircle2 size={16} />}
          accent="green"
        />
      </div>

      {/* Insights Panel + Workflow Pipeline — two column */}
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <WorkflowPipeline stages={pipelineStages} title="Workflow Pipeline" />
        <InsightsPanel kpis={kpis} mode={mode} />
      </div>

      {/* Status Distribution + Stage Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Workflow Status — Donut Chart */}
        <PortalSurface title="Workflow Status">
          {donutData.length > 0 ? (
            <QuietDonutChart data={donutData} />
          ) : (
            <EmptyState title="No data" description="No ACRs in current scope" />
          )}
        </PortalSurface>

        {/* Stage Summary — Bar Chart */}
        <PortalSurface title="Stage Summary">
          {barChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={barChartData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 120, bottom: 5 }}
              >
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--fia-gray-200)",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="value" fill="var(--fia-navy)" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyState title="No data" description="No stage distribution available" />
          )}
        </PortalSurface>
      </div>

      {/* Priority Queue Table */}
      <PortalSurface
        title="Priority Review Queue"
        subtitle="Sorted by urgency — overdue and priority records first"
      >
        {priorityQueueItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--fia-gray-200)]">
                  <th className="px-3 py-2 text-left font-semibold text-[var(--fia-gray-600)]">
                    ACR No
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--fia-gray-600)]">
                    Employee
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--fia-gray-600)]">
                    Status
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--fia-gray-600)]">
                    Due Date
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-[var(--fia-gray-600)]">
                    Days Overdue
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-[var(--fia-gray-600)]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--fia-gray-200)]">
                {priorityQueueItems.map((item) => {
                  const overdueDays = daysOverdue(item);
                  return (
                    <tr key={item.id} className="hover:bg-[var(--fia-gray-50)]">
                      <td className="px-3 py-3 font-semibold text-[var(--fia-navy)]">
                        {item.acrNo}
                      </td>
                      <td className="px-3 py-3 text-[var(--fia-gray-900)]">
                        {item.employee.name}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <StatusChip status={item.status} size="sm" />
                          {item.isPriority && <PriorityBadge priority={true} />}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-[var(--fia-gray-600)]">
                        {item.dueDate
                          ? new Date(item.dueDate).toLocaleDateString("en-PK", {
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-3">
                        {overdueDays ? (
                          <OverdueBadge days={overdueDays} />
                        ) : (
                          <span className="text-[var(--fia-gray-400)]">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          href={`/acr/${item.id}`}
                          className="inline-flex items-center gap-1 text-[var(--fia-cyan)] hover:underline"
                        >
                          <FileCheck2 size={14} />
                          <span>Open</span>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No priority items"
            description="All urgent records have been addressed"
          />
        )}
      </PortalSurface>

      {/* Retirement Warnings — only for reporting mode and if warnings exist */}
      {mode === "reporting" && overview.retirementWarnings && overview.retirementWarnings.length > 0 && (
        <RetirementWarnings warnings={overview.retirementWarnings} />
      )}
    </div>
  );
}
