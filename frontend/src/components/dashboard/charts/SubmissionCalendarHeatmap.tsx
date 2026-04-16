"use client";

import ReactECharts from "echarts-for-react";
import { DT } from "@/styles/dashboard-tokens";
import { useMemo } from "react";

interface CalendarPoint { date: string; count: number; } // date: "2025-01-15"

interface SubmissionCalendarHeatmapProps {
  data: CalendarPoint[];
  year?: number;
  title?: string;
}

export function SubmissionCalendarHeatmap({ data, year, title }: SubmissionCalendarHeatmapProps) {
  const displayYear = year ?? new Date().getFullYear();
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const option = useMemo(() => ({
    animation: true,
    tooltip: {
      formatter: (params: unknown) => {
        const p = params as { data?: [string, number] };
        if (!p.data) return "";
        return `<div style="font-size:11px"><b>${p.data[0]}</b><br/>${p.data[1]} submissions</div>`;
      },
      backgroundColor: "var(--card, #fff)",
      borderColor: "var(--fia-gray-200, #e5e7eb)",
      borderRadius: 8,
    },
    visualMap: {
      min: 0,
      max: maxCount,
      calculable: false,
      orient: "horizontal" as const,
      left: "right",
      top: 0,
      inRange: {
        color: [DT.sapphire[100], DT.sapphire[300], DT.sapphire[500], DT.sapphire[700]],
      },
      textStyle: { fontSize: 10, color: "var(--fia-gray-500)" },
      itemHeight: 8,
      itemWidth: 80,
    },
    calendar: {
      top: 32,
      left: 40,
      right: 16,
      cellSize: ["auto", 14] as [string, number],
      range: String(displayYear),
      itemStyle: {
        borderWidth: 1,
        borderColor: "var(--fia-gray-100, #f1f5f9)",
        borderRadius: 2,
      },
      yearLabel: { show: false },
      monthLabel: { fontSize: 10, color: "var(--fia-gray-400)" },
      dayLabel: { fontSize: 9, color: "var(--fia-gray-400)", firstDay: 1 },
      splitLine: { show: false },
    },
    series: [{
      type: "heatmap" as const,
      coordinateSystem: "calendar" as const,
      data: data.map((d) => [d.date, d.count]),
      emphasis: {
        itemStyle: { shadowBlur: 6, shadowColor: DT.sapphire[300] },
      },
    }],
  }), [data, displayYear, maxCount]);

  return (
    <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
      {title ? <h3 className="mb-3 text-sm font-bold text-[var(--fia-gray-900)]">{title}</h3> : null}
      <ReactECharts option={option} style={{ height: 160 }} opts={{ renderer: "svg" }} />
    </div>
  );
}
