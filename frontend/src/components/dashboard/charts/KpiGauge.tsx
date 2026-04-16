"use client";

import ReactECharts from "echarts-for-react";
import { DT } from "@/styles/dashboard-tokens";
import { useMemo } from "react";

interface KpiGaugeProps {
  value: number;         // 0-100 percentage
  target?: number;       // optional target line
  label: string;
  sublabel?: string;
  size?: number;         // px, default 140
}

export function KpiGauge({ value, target, label, sublabel, size = 140 }: KpiGaugeProps) {
  const threshold = target ?? 80;
  const color = value >= threshold
    ? DT.teal[500]
    : value >= threshold * 0.85
      ? DT.amber[500]
      : DT.crimson[500];

  const option = useMemo(() => ({
    animation: true,
    animationDuration: 800,
    series: [
      {
        type: "gauge" as const,
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        radius: "88%",
        center: ["50%", "58%"],
        progress: {
          show: true,
          width: 12,
          itemStyle: { color },
        },
        axisLine: {
          lineStyle: {
            width: 10,
            color: [[1, DT.slate[200]]] as [number, string][],
          },
        },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        detail: {
          valueAnimation: true,
          formatter: "{value}%",
          color,
          fontSize: 18,
          fontWeight: "bold" as const,
          offsetCenter: [0, "-5%"] as [number | string, number | string],
          fontFamily: "inherit",
        },
        data: [{ value: Math.round(value) }],
      },
      ...(target != null ? [{
        type: "gauge" as const,
        startAngle: 200,
        endAngle: -20,
        min: 0,
        max: 100,
        radius: "88%",
        center: ["50%", "58%"],
        progress: { show: false },
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: {
          show: true,
          length: 12,
          lineStyle: { color: DT.slate[400], width: 2, type: "dashed" as const },
          distance: -12,
        },
        axisLabel: { show: false },
        pointer: { show: false },
        detail: { show: false },
        data: [{ value: target }],
      }] : []),
    ],
  }), [value, target, color]);

  return (
    <div className="flex flex-col items-center">
      <ReactECharts
        option={option}
        style={{ height: size, width: size }}
        opts={{ renderer: "svg" }}
      />
      <p className="mt-0.5 text-xs font-semibold text-[var(--fia-gray-800)] text-center leading-tight">{label}</p>
      {sublabel ? <p className="text-[10px] text-[var(--fia-gray-400)] text-center">{sublabel}</p> : null}
    </div>
  );
}
