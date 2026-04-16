"use client";

import ReactECharts from "echarts-for-react";
import { useMemo, useCallback } from "react";

interface BarMetric {
  key: string;
  label: string;
  color: string;
}

interface BarEntry {
  id?: string;
  label: string;
  [key: string]: string | number | undefined;
}

interface EChartsHorizontalBarProps {
  data: BarEntry[];
  metrics: BarMetric[];
  title?: string;
  subtitle?: string;
  selectedId?: string;
  onSelect?: (id?: string) => void;
  height?: number;
  compact?: boolean;
}

export function EChartsHorizontalBar({
  data,
  metrics,
  title,
  subtitle,
  selectedId,
  onSelect,
  compact = false,
}: EChartsHorizontalBarProps) {
  const barHeight = compact ? 14 : 18;
  const height = Math.max(
    200,
    data.length * (metrics.length * (barHeight + 4) + 24) + 48,
  );

  const option = useMemo(
    () => ({
      animation: true,
      animationDuration: 500,
      grid: { top: 8, right: 60, bottom: 32, left: 4, containLabel: true },
      tooltip: {
        trigger: "axis" as const,
        axisPointer: { type: "shadow" as const },
        backgroundColor: "var(--card, #fff)",
        borderColor: "var(--fia-gray-200, #e5e7eb)",
        borderRadius: 12,
        padding: [8, 12],
        textStyle: { fontSize: 11, color: "var(--fia-gray-800)" },
      },
      legend: {
        bottom: 0,
        itemWidth: 8,
        itemHeight: 8,
        itemGap: 12,
        textStyle: { fontSize: 10, color: "var(--fia-gray-600)" },
        data: metrics.map((m) => m.label),
      },
      xAxis: {
        type: "value" as const,
        axisLabel: { fontSize: 10, color: "var(--fia-gray-400)" },
        splitLine: {
          lineStyle: {
            color: "var(--fia-gray-100)",
            type: "dashed" as const,
          },
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "category" as const,
        data: data.map((d) => d.label),
        axisLabel: {
          fontSize: 10,
          color: "var(--fia-gray-700)",
          formatter: (v: string) =>
            v.length > 18 ? v.substring(0, 18) + "\u2026" : v,
        },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: metrics.map((m) => ({
        name: m.label,
        type: "bar" as const,
        barMaxWidth: barHeight,
        barGap: "20%",
        data: data.map((d) => ({
          value: Number(d[m.key] ?? 0),
          itemStyle: {
            color: m.color,
            opacity:
              selectedId && d.id && d.id !== selectedId ? 0.35 : 1,
            borderRadius: [0, 4, 4, 0] as [number, number, number, number],
          },
        })),
        label: {
          show: true,
          position: "right" as const,
          fontSize: 9,
          color: "var(--fia-gray-500)",
          formatter: (params: { value: number }) =>
            params.value > 0 ? String(params.value) : "",
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 6,
            shadowColor: "rgba(0,0,0,0.10)",
          },
        },
      })),
    }),
    [data, metrics, selectedId, barHeight],
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
