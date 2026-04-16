"use client";

import ReactECharts from "echarts-for-react";
import { DT, CHART_PALETTE } from "@/styles/dashboard-tokens";
import { useMemo } from "react";

interface WorkloadPoint {
  name: string;
  role: string;
  daysSinceOldest: number; // x-axis
  queueDepth: number;      // y-axis
  overdueCount: number;    // bubble size
}

interface OfficerWorkloadBubbleProps {
  data: WorkloadPoint[];
  title?: string;
}

const ROLE_COLORS: Record<string, string> = {
  CLERK: DT.sapphire[400],
  REPORTING_OFFICER: DT.teal[500],
  COUNTERSIGNING_OFFICER: DT.amber[500],
  SECRET_BRANCH: DT.violet[500],
};

export function OfficerWorkloadBubble({ data, title }: OfficerWorkloadBubbleProps) {
  // Group by role for series
  const roleGroups = useMemo(() => {
    const groups = new Map<string, WorkloadPoint[]>();
    data.forEach((d) => {
      const arr = groups.get(d.role) ?? [];
      arr.push(d);
      groups.set(d.role, arr);
    });
    return Array.from(groups.entries());
  }, [data]);

  const option = useMemo(() => ({
    animation: true,
    tooltip: {
      formatter: (params: unknown) => {
        const p = params as { data: [number, number, number, string, string] };
        const [x, y, size, name, role] = p.data;
        return `<div style="font-size:11px"><b>${name}</b> (${role.replace(/_/g, " ")})<br/>Queue: ${y} ACRs<br/>Oldest: ${x}d ago<br/>Overdue: ${size}</div>`;
      },
      backgroundColor: "var(--card, #fff)",
      borderColor: "var(--fia-gray-200, #e5e7eb)",
      borderRadius: 12,
      textStyle: { fontSize: 11, color: "var(--fia-gray-800)" },
    },
    legend: {
      top: 0,
      right: 0,
      itemWidth: 8,
      itemHeight: 8,
      itemGap: 12,
      textStyle: { fontSize: 10, color: "var(--fia-gray-600)" },
    },
    grid: { top: 28, right: 24, bottom: 48, left: 56 },
    xAxis: {
      name: "Days since oldest ACR",
      nameTextStyle: { fontSize: 9, color: "var(--fia-gray-400)" },
      nameLocation: "middle" as const,
      nameGap: 28,
      type: "value" as const,
      splitLine: { lineStyle: { color: "var(--fia-gray-100)", type: "dashed" as const } },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: "var(--fia-gray-400)" },
    },
    yAxis: {
      name: "Queue depth",
      nameTextStyle: { fontSize: 9, color: "var(--fia-gray-400)" },
      nameLocation: "middle" as const,
      nameGap: 30,
      type: "value" as const,
      splitLine: { lineStyle: { color: "var(--fia-gray-100)", type: "dashed" as const } },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { fontSize: 10, color: "var(--fia-gray-400)" },
    },
    series: roleGroups.map(([role, points], i) => ({
      name: role.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
      type: "scatter" as const,
      symbolSize: (val: number[]) => Math.max(8, Math.min(40, val[2] * 4 + 8)),
      data: points.map((p) => [p.daysSinceOldest, p.queueDepth, p.overdueCount, p.name, p.role]),
      itemStyle: {
        color: ROLE_COLORS[role] ?? CHART_PALETTE[i % CHART_PALETTE.length],
        opacity: 0.8,
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.6)",
      },
      emphasis: { itemStyle: { opacity: 1, shadowBlur: 8 } },
    })),
  }), [roleGroups]);

  return (
    <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
      {title ? <h3 className="mb-3 text-sm font-bold text-[var(--fia-gray-900)]">{title}</h3> : null}
      <ReactECharts option={option} style={{ height: 210 }} opts={{ renderer: "svg" }} />
    </div>
  );
}
