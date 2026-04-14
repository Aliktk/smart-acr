"use client";

import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Lightbulb, TrendingDown, TrendingUp, Zap, ShieldAlert, BarChart3 } from "lucide-react";
import Link from "next/link";
import type { DashboardKpi } from "@/types/contracts";

interface Insight {
  type: "warning" | "success" | "action" | "info" | "critical";
  title: string;
  description: string;
  link?: string;
  linkLabel?: string;
  metric?: { value: string | number; label: string; direction?: "up" | "down" | "neutral" };
}

interface InsightsPanelProps {
  kpis: DashboardKpi[];
  mode: string;
}

function num(v: string | number | undefined): number {
  if (v === undefined) return 0;
  return typeof v === "number" ? v : parseFloat(v) || 0;
}

function deriveInsights(kpis: DashboardKpi[], mode: string): Insight[] {
  const insights: Insight[] = [];
  const kpiMap = new Map(kpis.map((k) => [k.key, k]));

  const overdue = kpiMap.get("overdue");
  const overdueCount = num(overdue?.value);
  if (overdueCount > 0) {
    insights.push({
      type: overdueCount > 10 ? "critical" : "warning",
      title: `${overdueCount} overdue ACR${overdueCount > 1 ? "s" : ""} require attention`,
      description:
        overdueCount > 10
          ? "Critical backlog: multiple holding officers need immediate escalation."
          : overdueCount > 5
          ? "Review overdue records and dispatch reminders to responsible officers."
          : "A small number of records are past due. Clear them before they escalate.",
      link: "/queue?status=Overdue",
      linkLabel: "View overdue queue",
      metric: { value: overdueCount, label: "overdue", direction: "down" },
    });
  }

  const completionRate = kpiMap.get("completionRate");
  const rateVal = num(completionRate?.value);
  if (completionRate) {
    if (rateVal < 40) {
      insights.push({
        type: "warning",
        title: `Completion rate critically low: ${rateVal}%`,
        description: "Far below target. Identify stages with the longest hold times and escalate.",
        link: "/analytics",
        linkLabel: "Analyze bottlenecks",
        metric: { value: `${rateVal}%`, label: "completion", direction: "down" },
      });
    } else if (rateVal >= 40 && rateVal < 70) {
      insights.push({
        type: "info",
        title: `Completion rate at ${rateVal}% — room to improve`,
        description: "Check stage-wise turnaround for where records are stalling.",
        link: "/analytics",
        linkLabel: "View analysis",
        metric: { value: `${rateVal}%`, label: "completion", direction: "neutral" },
      });
    } else if (rateVal >= 80) {
      insights.push({
        type: "success",
        title: `Strong completion rate: ${rateVal}%`,
        description: "Workflow is healthy. Keep monitoring to sustain this performance.",
        metric: { value: `${rateVal}%`, label: "completion", direction: "up" },
      });
    }
  }

  const pending = kpiMap.get("pending");
  const total = kpiMap.get("total");
  if (pending && total && num(total.value) > 0) {
    const pendingPct = Math.round((num(pending.value) / num(total.value)) * 100);
    if (pendingPct > 65) {
      insights.push({
        type: "action",
        title: `${pendingPct}% of records are pending`,
        description: "Large backlog detected. Review stage distribution and push stalled records forward.",
        link: "/queue",
        linkLabel: "Open queue",
        metric: { value: `${pendingPct}%`, label: "pending", direction: "down" },
      });
    }
  }

  const avgTurnaround = kpiMap.get("avgTurnaround") ?? kpiMap.get("turnaround") ?? kpiMap.get("avgCompletionDays");
  const avgDays = num(avgTurnaround?.value);
  if (avgTurnaround && avgDays > 0) {
    if (avgDays > 45) {
      insights.push({
        type: "warning",
        title: `Avg turnaround ${avgDays}d — above 45-day threshold`,
        description: "Lengthy completion times may indicate systemic delays at specific stages.",
        metric: { value: `${avgDays}d`, label: "avg turnaround", direction: "down" },
      });
    } else if (avgDays > 30) {
      insights.push({
        type: "info",
        title: `Avg turnaround: ${avgDays} days`,
        description: "Above the 30-day target. Identify slow hand-off points in the turnaround analysis.",
        metric: { value: `${avgDays}d`, label: "avg turnaround", direction: "neutral" },
      });
    } else {
      insights.push({
        type: "success",
        title: `Avg turnaround: ${avgDays} days`,
        description: "Within the 30-day target. Workflow is processing at a healthy pace.",
        metric: { value: `${avgDays}d`, label: "turnaround", direction: "up" },
      });
    }
  }

  const priority = kpiMap.get("priority");
  const priorityCount = num(priority?.value);
  if (priorityCount > 0) {
    insights.push({
      type: "action",
      title: `${priorityCount} priority record${priorityCount > 1 ? "s" : ""} flagged`,
      description: "Escalated records need expedited handling above regular queue order.",
      link: "/queue?priority=true",
      linkLabel: "View priority queue",
      metric: { value: priorityCount, label: "priority", direction: "neutral" },
    });
  }

  if (mode === "secret-branch") {
    const anomalies = kpiMap.get("anomalies");
    const anomalyCount = num(anomalies?.value);
    if (anomalyCount > 0) {
      insights.push({
        type: "critical",
        title: `${anomalyCount} receipt anomal${anomalyCount > 1 ? "ies" : "y"} detected`,
        description: "Receipt anomalies require verification before final archival processing.",
        link: "/queue",
        linkLabel: "Review intake",
        metric: { value: anomalyCount, label: "anomalies", direction: "down" },
      });
    } else {
      insights.push({
        type: "success",
        title: "Receipt queue clear",
        description: "No pending receipt anomalies. Archive intake is proceeding normally.",
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      type: "success",
      title: "All systems healthy",
      description: "No critical issues detected. Dashboard metrics are within expected ranges.",
    });
  }

  return insights.slice(0, 5);
}

const typeConfig = {
  critical: {
    icon: ShieldAlert,
    iconColor: "text-red-500",
    bg: "bg-red-50 dark:bg-[rgba(239,68,68,0.08)]",
    border: "border-red-200 dark:border-[rgba(239,68,68,0.25)]",
    metricColor: "text-red-600 dark:text-red-400",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-amber-500",
    bg: "bg-amber-50 dark:bg-[rgba(217,119,6,0.08)]",
    border: "border-amber-200 dark:border-[rgba(217,119,6,0.2)]",
    metricColor: "text-amber-600 dark:text-amber-400",
  },
  success: {
    icon: CheckCircle2,
    iconColor: "text-emerald-500",
    bg: "bg-emerald-50 dark:bg-[rgba(16,185,129,0.08)]",
    border: "border-emerald-200 dark:border-[rgba(16,185,129,0.2)]",
    metricColor: "text-emerald-600 dark:text-emerald-400",
  },
  action: {
    icon: Zap,
    iconColor: "text-[var(--fia-cyan)]",
    bg: "bg-[var(--fia-cyan-bg,rgba(0,149,217,0.05))] dark:bg-[rgba(0,149,217,0.08)]",
    border: "border-[var(--fia-cyan-100,rgba(0,149,217,0.2))] dark:border-[rgba(0,149,217,0.2)]",
    metricColor: "text-[var(--fia-cyan)]",
  },
  info: {
    icon: Lightbulb,
    iconColor: "text-violet-500",
    bg: "bg-violet-50 dark:bg-[rgba(139,92,246,0.08)]",
    border: "border-violet-200 dark:border-[rgba(139,92,246,0.2)]",
    metricColor: "text-violet-600 dark:text-violet-400",
  },
};

function MetricPill({ metric, typeKey }: { metric: NonNullable<Insight["metric"]>; typeKey: keyof typeof typeConfig }) {
  const config = typeConfig[typeKey];
  const DirIcon = metric.direction === "up" ? TrendingUp : metric.direction === "down" ? TrendingDown : BarChart3;

  return (
    <div className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${config.metricColor} bg-white/60 dark:bg-black/20`}>
      <DirIcon size={9} />
      {metric.value}
      <span className="font-normal opacity-70">{metric.label}</span>
    </div>
  );
}

export function InsightsPanel({ kpis, mode }: InsightsPanelProps) {
  const insights = deriveInsights(kpis, mode);

  return (
    <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--fia-navy)] text-white">
            <Lightbulb size={14} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--fia-gray-900)]">Insights</h3>
            <p className="text-[10px] text-[var(--fia-gray-500)]">Automated recommendations</p>
          </div>
        </div>
        <span className="rounded-full bg-[var(--fia-gray-100)] px-2 py-0.5 text-[10px] font-semibold text-[var(--fia-gray-500)]">
          {insights.length} active
        </span>
      </div>

      <div className="space-y-2">
        {insights.map((insight, index) => {
          const config = typeConfig[insight.type];
          const Icon = config.icon;

          return (
            <div
              key={index}
              className={`rounded-xl border ${config.border} ${config.bg} p-3 transition-all hover:shadow-sm`}
            >
              <div className="flex gap-2.5">
                <Icon size={15} className={`mt-0.5 shrink-0 ${config.iconColor}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-1">
                    <p className="text-xs font-semibold text-[var(--fia-gray-900)]">{insight.title}</p>
                    {insight.metric ? (
                      <MetricPill metric={insight.metric} typeKey={insight.type} />
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--fia-gray-600)]">{insight.description}</p>
                  {insight.link ? (
                    <Link
                      href={insight.link}
                      className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--fia-cyan)] hover:underline"
                    >
                      {insight.linkLabel ?? "View"} <ArrowRight size={10} />
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <p className="mt-3 text-center text-[10px] text-[var(--fia-gray-400)]">
        <Clock size={8} className="inline mr-1 mb-0.5" />
        Insights update with each filter change
      </p>
    </div>
  );
}
