"use client";

import ReactECharts from "echarts-for-react";
import { useMemo, useCallback } from "react";

interface StackedBarEntry {
  label: string;
  id?: string;
  completed?: number;
  pending?: number;
  overdue?: number;
  [key: string]: string | number | undefined;
}

interface EChartsStackedBarProps {
  data: StackedBarEntry[];
  title?: string;
  subtitle?: string;
  selectedId?: string;
  onSelect?: (id?: string) => void;
  height?: number;
}

// Gradient pairs: [top-start, bottom-end] for each stack
const STACK_GRADIENTS = {
  completed: {
    start: "#14B8A6",   // teal-500 — bright top
    end:   "#0D9488",   // teal-600 — deep bottom
    legend: "#0D9488",
  },
  pending: {
    start: "#818CF8",   // indigo-400 — lighter top
    end:   "#4F46E5",   // indigo-600 — deep bottom
    legend: "#4F46E5",
  },
  overdue: {
    start: "#FB7185",   // rose-400 — bright top
    end:   "#E11D48",   // rose-600 — deep bottom
    legend: "#E11D48",
  },
} as const;

const STACK_KEYS = ["completed", "pending", "overdue"] as const;

// ECharts linear gradient object (no import needed)
function linearGrad(start: string, end: string) {
  return {
    type: "linear" as const,
    x: 0, y: 0, x2: 0, y2: 1,
    colorStops: [
      { offset: 0, color: start },
      { offset: 1, color: end },
    ],
  };
}

export function EChartsStackedBar({
  data,
  title,
  subtitle,
  selectedId,
  onSelect,
  height = 260,
}: EChartsStackedBarProps) {
  const option = useMemo(
    () => ({
      animation: true,
      animationDuration: 600,
      animationEasing: "cubicOut" as const,
      // Top-level color array drives legend colours correctly
      color: STACK_KEYS.map((k) => STACK_GRADIENTS[k].legend),
      grid: { top: 12, right: 20, bottom: data.length > 5 ? 72 : 52, left: 4, containLabel: true },
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        backgroundColor: "#0F172A",
        borderColor: "transparent",
        borderRadius: 14,
        padding: [10, 14],
        textStyle: { fontSize: 11, color: "#E2E8F0" },
        formatter: (
          params: {
            seriesName: string;
            value: number;
            color: string;
            axisValueLabel: string;
          }[],
        ) => {
          const label = params[0]?.axisValueLabel ?? "";
          const totalVal = params.reduce((s, p) => s + p.value, 0);
          const rows = params
            .map(
              (p) =>
                `<div style="display:flex;align-items:center;gap:8px;margin:3px 0"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${p.color}"></span><span style="color:#94A3B8">${p.seriesName}</span><b style="margin-left:auto;padding-left:12px;color:#F1F5F9">${p.value}</b></div>`,
            )
            .join("");
          return `<div style="font-size:11px"><div style="font-weight:700;margin-bottom:6px;color:#F8FAFC">${label}</div>${rows}<div style="margin-top:6px;border-top:1px solid rgba(255,255,255,0.1);padding-top:5px;color:#94A3B8;display:flex;justify-content:space-between">Total <b style="color:#F1F5F9">${totalVal}</b></div></div>`;
        },
      },
      legend: {
        bottom: 0,
        itemWidth: 10,
        itemHeight: 10,
        itemGap: 16,
        borderRadius: 3,
        textStyle: { fontSize: 11, color: "#64748B" },
        // Explicitly wire legend items to their correct colors
        data: STACK_KEYS.map((key) => ({
          name: key.charAt(0).toUpperCase() + key.slice(1),
          itemStyle: { color: STACK_GRADIENTS[key].legend },
        })),
      },
      xAxis: {
        type: "category" as const,
        data: data.map((d) => d.label),
        axisLabel: {
          fontSize: 10,
          color: "#94A3B8",
          rotate: data.length > 4 ? -35 : 0,
          interval: 0,
          formatter: (v: string) =>
            v.length > 12 ? v.substring(0, 12) + "\u2026" : v,
        },
        axisLine: { lineStyle: { color: "#E2E8F0" } },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value" as const,
        axisLabel: { fontSize: 10, color: "#94A3B8" },
        splitLine: {
          lineStyle: { color: "#F1F5F9", type: "dashed" as const },
        },
        axisLine: { show: false },
        axisTick: { show: false },
        minInterval: 1,
      },
      series: STACK_KEYS.map((key, i) => ({
        name: key.charAt(0).toUpperCase() + key.slice(1),
        type: "bar" as const,
        stack: "total",
        barMaxWidth: 40,
        // Series-level itemStyle: gradient color + rounding
        itemStyle: {
          color: linearGrad(STACK_GRADIENTS[key].start, STACK_GRADIENTS[key].end),
          borderRadius:
            i === 2
              ? ([5, 5, 0, 0] as [number, number, number, number])
              : i === 0
                ? ([0, 0, 5, 5] as [number, number, number, number])
                : ([0, 0, 0, 0] as [number, number, number, number]),
        },
        // Per-item: only opacity (no color override — inherits from series)
        data: data.map((d) => ({
          value: d[key] ?? 0,
          itemStyle: {
            opacity: selectedId && d.id && d.id !== selectedId ? 0.25 : 1,
          },
        })),
        emphasis: {
          focus: "series" as const,
          itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,0.15)" },
        },
      })),
    }),
    [data, selectedId],
  );

  const handleClick = useCallback(
    (params: { dataIndex: number }) => {
      if (!onSelect) return;
      const entry = data[params.dataIndex];
      onSelect(
        entry?.id && selectedId === entry.id ? undefined : entry?.id,
      );
    },
    [data, onSelect, selectedId],
  );

  if (data.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
      {title ? (
        <div className="mb-2">
          <h3 className="text-sm font-bold text-[var(--fia-gray-900)]">
            {title}
          </h3>
          {subtitle ? (
            <p className="mt-0.5 text-[11px] text-[var(--fia-gray-500)]">
              {subtitle}
            </p>
          ) : null}
        </div>
      ) : null}
      <ReactECharts
        option={option}
        style={{ height }}
        opts={{ renderer: "svg" }}
        onEvents={onSelect ? { click: handleClick } : undefined}
      />
    </div>
  );
}
