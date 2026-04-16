"use client";

import ReactECharts from "echarts-for-react";
import { useMemo, useState, useCallback } from "react";
import { DT, CHART_PALETTE } from "@/styles/dashboard-tokens";

interface TrendSeries {
  key: string;
  label: string;
  color: string;
}

interface TrendPoint {
  label: string;
  [key: string]: string | number | null | undefined;
}

interface EChartsAreaTrendProps {
  data: TrendPoint[];
  series: TrendSeries[];
  title?: string;
  subtitle?: string;
  defaultSeries?: string[];
  height?: number;
}

const TONE_MAP: Record<string, string> = {
  navy:   "#6366F1",  // sapphire — more vibrant than dark navy
  cyan:   "#0EA5E9",  // sky blue — vivid
  green:  "#10B981",  // emerald
  amber:  "#F59E0B",  // amber
  red:    "#EF4444",  // red
  slate:  "#64748B",  // slate
  purple: "#8B5CF6",  // violet
};

function resolveColor(color: string, index: number): string {
  return (
    TONE_MAP[color] ??
    (color.startsWith("#") || color.startsWith("rgb")
      ? color
      : CHART_PALETTE[index % CHART_PALETTE.length])
  );
}

export function EChartsAreaTrend({
  data,
  series,
  title,
  subtitle,
  defaultSeries,
  height = 300,
}: EChartsAreaTrendProps) {
  const [activeSeries, setActiveSeries] = useState<string[]>(
    defaultSeries ?? series.slice(0, 3).map((s) => s.key),
  );

  const toggleSeries = useCallback((key: string) => {
    setActiveSeries((prev) =>
      prev.includes(key)
        ? prev.length > 1
          ? prev.filter((k) => k !== key)
          : prev
        : [...prev, key],
    );
  }, []);

  const visible = series.filter((s) => activeSeries.includes(s.key));

  const option = useMemo(
    () => ({
      animation: true,
      animationDuration: 600,
      grid: { top: 16, right: 20, bottom: 56, left: 44 },
      tooltip: {
        trigger: "axis" as const,
        axisPointer: {
          type: "cross" as const,
          crossStyle: { color: "var(--fia-gray-300)" },
        },
        backgroundColor: "var(--card, #fff)",
        borderColor: "var(--fia-gray-200, #e5e7eb)",
        borderRadius: 14,
        padding: [10, 14],
        textStyle: {
          fontSize: 12,
          color: "var(--fia-gray-800, #1e293b)",
        },
        formatter: (
          params: {
            seriesName: string;
            value: number;
            axisValueLabel: string;
            color: string;
          }[],
        ) => {
          const period = params[0]?.axisValueLabel ?? "";
          const rows = params
            .filter((p) => p.value != null)
            .map(
              (p) =>
                `<div style="display:flex;align-items:center;gap:6px;margin:2px 0"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span><span style="color:var(--fia-gray-600)">${p.seriesName}</span><b style="margin-left:auto;padding-left:12px">${p.value}</b></div>`,
            )
            .join("");
          return `<div style="font-size:11px"><div style="font-weight:700;margin-bottom:6px;color:var(--fia-gray-900)">${period}</div>${rows}</div>`;
        },
      },
      xAxis: {
        type: "category" as const,
        data: data.map((d) => d.label),
        axisLabel: {
          fontSize: 10,
          color: "var(--fia-gray-400)",
          rotate: data.length > 12 ? -30 : 0,
        },
        axisLine: { lineStyle: { color: "var(--fia-gray-200)" } },
        axisTick: { show: false },
        boundaryGap: false,
      },
      yAxis: {
        type: "value" as const,
        axisLabel: { fontSize: 10, color: "var(--fia-gray-400)" },
        splitLine: {
          lineStyle: {
            color: "var(--fia-gray-100, #f1f5f9)",
            type: "dashed" as const,
          },
        },
        axisLine: { show: false },
        axisTick: { show: false },
        minInterval: 1,
      },
      dataZoom: [
        {
          type: "inside" as const,
          start: 0,
          end: 100,
        },
        {
          type: "slider" as const,
          bottom: 4,
          height: 20,
          handleSize: 14,
          fillerColor: `${DT.sapphire[500]}22`,
          borderColor: "var(--fia-gray-200)",
          textStyle: { fontSize: 9, color: "var(--fia-gray-400)" },
          showDetail: false,
        },
      ],
      series: visible.map((s, i) => {
        const color = resolveColor(s.color, i);
        return {
          name: s.label,
          type: "line" as const,
          data: data.map((d) => d[s.key] ?? 0),
          smooth: 0.35,
          symbol: "circle" as const,
          symbolSize: 4,
          showSymbol: false,
          lineStyle: { width: 3, color },
          itemStyle: { color },
          areaStyle: {
            color: {
              type: "linear" as const,
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: color + "55" },
                { offset: 1, color: color + "06" },
              ],
            },
          },
          emphasis: { focus: "series" as const, lineStyle: { width: 3 } },
        };
      }),
    }),
    [data, visible],
  );

  if (data.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
      {title ? (
        <div className="mb-3">
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
      {/* Series toggle pills */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {series.map((s, i) => {
          const color = resolveColor(s.color, i);
          const active = activeSeries.includes(s.key);
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => toggleSeries(s.key)}
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all"
              style={
                active
                  ? {
                      background: color,
                      borderColor: color,
                      color: "#fff",
                    }
                  : {
                      background: "transparent",
                      borderColor: "var(--fia-gray-200)",
                      color: "var(--fia-gray-600)",
                    }
              }
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  background: active ? "rgba(255,255,255,0.8)" : color,
                }}
              />
              {s.label}
            </button>
          );
        })}
      </div>
      <ReactECharts
        option={option}
        style={{ height }}
        opts={{ renderer: "svg" }}
      />
    </div>
  );
}
