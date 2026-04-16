"use client";

import ReactECharts from "echarts-for-react";
import { useMemo, useCallback } from "react";
import { CHART_PALETTE } from "@/styles/dashboard-tokens";

interface DonutItem {
  key?: string;
  label: string;
  value: number;
  filterValue?: string;
}

interface EChartsDonutProps {
  data: DonutItem[];
  title?: string;
  subtitle?: string;
  height?: number;
  selectedKey?: string;
  onSelect?: (key?: string) => void;
  showLegend?: boolean;
}

export function EChartsDonut({
  data,
  title,
  subtitle,
  height = 260,
  selectedKey,
  onSelect,
  showLegend = true,
}: EChartsDonutProps) {
  const total = data.reduce((s, d) => s + d.value, 0);

  const option = useMemo(
    () => ({
      animation: true,
      animationDuration: 600,
      tooltip: {
        trigger: "item" as const,
        backgroundColor: "var(--card, #fff)",
        borderColor: "var(--fia-gray-200, #e5e7eb)",
        borderRadius: 12,
        padding: [8, 12],
        textStyle: { fontSize: 12, color: "var(--fia-gray-800)" },
        formatter: (params: {
          name: string;
          value: number;
          percent: number;
          color: string;
        }) =>
          `<div style="font-size:11px"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${params.color}"></span><b>${params.name}</b></div><div style="color:var(--fia-gray-600)">Count: <b>${params.value}</b></div><div style="color:var(--fia-gray-600)">Share: <b>${params.percent.toFixed(1)}%</b></div></div>`,
      },
      legend: showLegend
        ? {
            orient: "horizontal" as const,
            bottom: 0,
            itemWidth: 8,
            itemHeight: 8,
            itemGap: 12,
            textStyle: { fontSize: 10, color: "var(--fia-gray-600)" },
          }
        : { show: false },
      graphic: [
        {
          type: "text" as const,
          left: "center",
          top: "42%",
          style: {
            text: String(total),
            textAlign: "center" as const,
            fontSize: 24,
            fontWeight: "bold" as const,
            fill: "var(--fia-gray-900, #111)",
          },
        },
        {
          type: "text" as const,
          left: "center",
          top: "52%",
          style: {
            text: "total",
            textAlign: "center" as const,
            fontSize: 10,
            fill: "var(--fia-gray-400, #9ca3af)",
            fontWeight: "600" as const,
          },
        },
      ],
      series: [
        {
          type: "pie" as const,
          radius: ["46%", "70%"],
          center: ["50%", "48%"],
          avoidLabelOverlap: true,
          padAngle: 2,
          itemStyle: {
            borderRadius: 5,
            borderColor: "var(--card, #fff)",
            borderWidth: 2,
          },
          label: { show: false },
          emphasis: {
            itemStyle: {
              shadowBlur: 16,
              shadowColor: "rgba(0,0,0,0.12)",
            },
            label: {
              show: true,
              formatter: "{b}\n{c}",
              fontSize: 11,
              fontWeight: "bold" as const,
              color: "var(--fia-gray-900)",
            },
            scale: true,
            scaleSize: 8,
          },
          data: data.map((d, i) => ({
            name: d.label,
            value: d.value,
            itemStyle: {
              color: CHART_PALETTE[i % CHART_PALETTE.length],
              opacity:
                selectedKey &&
                selectedKey !== (d.filterValue ?? d.key ?? d.label)
                  ? 0.4
                  : 1,
            },
          })),
        },
      ],
    }),
    [data, total, selectedKey, showLegend],
  );

  const handleClick = useCallback(
    (params: { name: string }) => {
      if (!onSelect) return;
      const item = data.find((d) => d.label === params.name);
      const key = item?.filterValue ?? item?.key ?? item?.label;
      onSelect(selectedKey === key ? undefined : key);
    },
    [data, onSelect, selectedKey],
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
