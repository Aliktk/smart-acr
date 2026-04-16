"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Label } from "recharts";

interface TrendAreaChartProps {
  data: Array<{ label: string; [key: string]: string | number | null | undefined }>;
  series: Array<{ key: string; label: string; color: string }>;
  title?: string;
  subtitle?: string;
  yAxisLabel?: string;
}

const TONE_COLORS: Record<string, string> = {
  navy: "#1A1C6E",
  cyan: "#0095D9",
  green: "#10B981",
  amber: "#F59E0B",
  red: "#EF4444",
  slate: "#64748B",
};

export function TrendAreaChart({ data, series, title, subtitle, yAxisLabel = "Count" }: TrendAreaChartProps) {
  if (data.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
      {title ? (
        <div className="mb-3">
          <h3 className="text-sm font-bold text-[var(--fia-gray-900)]">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[11px] text-[var(--fia-gray-500)]">{subtitle}</p> : null}
        </div>
      ) : null}
      <div className="mb-2 flex flex-wrap gap-3">
        {series.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[11px] text-[var(--fia-gray-600)]">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TONE_COLORS[s.color] ?? s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={230}>
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 24, left: 12 }}>
          <defs>
            {series.map((s) => {
              const color = TONE_COLORS[s.color] ?? s.color;
              return (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--fia-gray-200, #e5e7eb)" strokeOpacity={0.5} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "var(--fia-gray-400)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--fia-gray-200)", strokeOpacity: 0.6 }}
            interval="preserveStartEnd"
          >
            <Label
              value="Period"
              offset={-8}
              position="insideBottom"
              style={{ fontSize: 9, fill: "var(--fia-gray-400)", textTransform: "uppercase", letterSpacing: "0.04em" }}
            />
          </XAxis>
          <YAxis
            tick={{ fontSize: 10, fill: "var(--fia-gray-400)" }}
            tickLine={false}
            axisLine={false}
            width={36}
            allowDecimals={false}
          >
            <Label
              value={yAxisLabel}
              angle={-90}
              position="insideLeft"
              offset={8}
              style={{ fontSize: 9, fill: "var(--fia-gray-400)", textTransform: "uppercase", letterSpacing: "0.04em" }}
            />
          </YAxis>
          <Tooltip
            contentStyle={{
              background: "var(--card, #fff)",
              border: "1px solid var(--fia-gray-200, #e5e7eb)",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              fontSize: "12px",
              padding: "8px 12px",
            }}
          />
          {series.map((s) => {
            const color = TONE_COLORS[s.color] ?? s.color;
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={color}
                strokeWidth={2}
                fill={`url(#grad-${s.key})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2 }}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
