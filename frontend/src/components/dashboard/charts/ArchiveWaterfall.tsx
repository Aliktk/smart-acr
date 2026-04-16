"use client";

import ReactECharts from "echarts-for-react";
import { DT } from "@/styles/dashboard-tokens";
import { useMemo } from "react";

interface WaterfallPoint {
  label: string;  // e.g. "Jul 2024"
  value: number;  // monthly delta (positive = growth)
  cumulative: number; // running total
}

interface ArchiveWaterfallProps {
  data: WaterfallPoint[];
  title?: string;
}

export function ArchiveWaterfall({ data, title }: ArchiveWaterfallProps) {
  const option = useMemo(() => {
    // Waterfall: transparent base + colored delta bars
    const bases = data.map((d) => d.cumulative - Math.abs(d.value));
    const positives = data.map((d) => d.value >= 0 ? d.value : 0);
    const negatives = data.map((d) => d.value < 0 ? Math.abs(d.value) : 0);

    return {
      animation: true,
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        formatter: (params: unknown) => {
          const arr = params as { dataIndex: number }[];
          const idx = arr[0]?.dataIndex ?? 0;
          const d = data[idx];
          if (!d) return "";
          return `<div style="font-size:11px"><b>${d.label}</b><br/>Archived this period: ${d.value > 0 ? "+" : ""}${d.value}<br/>Running total: ${d.cumulative}</div>`;
        },
        backgroundColor: "var(--card, #fff)",
        borderColor: "var(--fia-gray-200)",
        borderRadius: 12,
        textStyle: { fontSize: 11, color: "var(--fia-gray-800)" },
      },
      legend: {
        data: ["Growth", "Reduction"],
        bottom: 0,
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 16,
        textStyle: { fontSize: 10, color: "var(--fia-gray-600)" },
      },
      grid: { top: 16, right: 20, bottom: 72, left: 44 },
      xAxis: {
        type: "category" as const,
        data: data.map((d) => d.label),
        axisLabel: {
          fontSize: 9,
          color: "var(--fia-gray-400)",
          rotate: -35,
          interval: 0,
          hideOverlap: true,
        },
        axisLine: { lineStyle: { color: "var(--fia-gray-200)" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value" as const,
        axisLabel: { fontSize: 10, color: "var(--fia-gray-400)" },
        splitLine: { lineStyle: { color: "var(--fia-gray-100)", type: "dashed" as const } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: "Base",
          type: "bar" as const,
          stack: "total",
          itemStyle: { borderColor: "transparent", color: "transparent" },
          emphasis: { itemStyle: { borderColor: "transparent", color: "transparent" } },
          data: bases,
        },
        {
          name: "Growth",
          type: "bar" as const,
          stack: "total",
          barMaxWidth: 32,
          data: positives,
          itemStyle: { color: DT.teal[600], borderRadius: [4, 4, 0, 0] as number[] },
          emphasis: { itemStyle: { color: DT.teal[500] } },
          label: {
            show: true,
            position: "top" as const,
            fontSize: 9,
            color: DT.teal[700],
            formatter: (params: unknown) => {
              const p = params as { value: number };
              return p.value > 0 ? `+${p.value}` : "";
            },
          },
        },
        {
          name: "Reduction",
          type: "bar" as const,
          stack: "total",
          barMaxWidth: 32,
          data: negatives,
          itemStyle: { color: DT.crimson[500], borderRadius: [4, 4, 0, 0] as number[] },
          emphasis: { itemStyle: { color: DT.crimson[400] } },
          label: {
            show: true,
            position: "top" as const,
            fontSize: 9,
            color: DT.crimson[700],
            formatter: (params: unknown) => {
              const p = params as { value: number };
              return p.value > 0 ? `-${p.value}` : "";
            },
          },
        },
      ],
    };
  }, [data]);

  return (
    <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
      {title ? <h3 className="mb-3 text-sm font-bold text-[var(--fia-gray-900)]">{title}</h3> : null}
      <ReactECharts option={option} style={{ height: 240 }} opts={{ renderer: "svg" }} />
    </div>
  );
}
