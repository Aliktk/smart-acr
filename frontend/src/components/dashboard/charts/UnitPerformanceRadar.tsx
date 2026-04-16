"use client";

import ReactECharts from "echarts-for-react";
import { CHART_PALETTE } from "@/styles/dashboard-tokens";
import { useMemo } from "react";

interface RadarSeries {
  name: string;
  values: number[]; // 0-100 for each indicator
}

interface UnitPerformanceRadarProps {
  series: RadarSeries[];
  title?: string;
}

const INDICATORS = [
  { name: "Completion\nRate", max: 100 },
  { name: "Turnaround\nSpeed", max: 100 },
  { name: "On-time\nRate", max: 100 },
  { name: "Low Return\nRate", max: 100 },
  { name: "Throughput", max: 100 },
];

export function UnitPerformanceRadar({ series, title }: UnitPerformanceRadarProps) {
  const option = useMemo(() => ({
    animation: true,
    tooltip: {
      backgroundColor: "var(--card, #fff)",
      borderColor: "var(--fia-gray-200, #e5e7eb)",
      borderRadius: 12,
      textStyle: { fontSize: 11, color: "var(--fia-gray-800)" },
    },
    legend: {
      bottom: 4,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { fontSize: 10, color: "var(--fia-gray-600)" },
      data: series.map((s) => s.name),
    },
    radar: {
      indicator: INDICATORS,
      center: ["50%", "48%"],
      radius: "62%",
      axisName: { fontSize: 9, color: "var(--fia-gray-500)", lineHeight: 14 },
      splitLine: { lineStyle: { color: "var(--fia-gray-100, #f1f5f9)" } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: "var(--fia-gray-200, #e5e7eb)" } },
    },
    series: [{
      type: "radar" as const,
      data: series.map((s, i) => ({
        name: s.name,
        value: s.values,
        lineStyle: { width: 2.5, color: CHART_PALETTE[i % CHART_PALETTE.length] },
        itemStyle: { color: CHART_PALETTE[i % CHART_PALETTE.length] },
        areaStyle: {
          color: CHART_PALETTE[i % CHART_PALETTE.length],
          opacity: 0.18,
        },
        symbol: "circle",
        symbolSize: 5,
      })),
    }],
  }), [series]);

  return (
    <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
      {title ? <h3 className="mb-3 text-sm font-bold text-[var(--fia-gray-900)]">{title}</h3> : null}
      <ReactECharts option={option} style={{ height: 260 }} opts={{ renderer: "svg" }} />
    </div>
  );
}
