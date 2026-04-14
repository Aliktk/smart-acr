"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

interface PerformanceBarChartProps {
  data: Array<{ label: string; total: number; completed?: number; overdue?: number; pending?: number }>;
  title?: string;
  subtitle?: string;
  layout?: "vertical" | "horizontal";
}

export function PerformanceBarChart({ data, title, subtitle, layout = "vertical" }: PerformanceBarChartProps) {
  if (data.length === 0) return null;

  const isHorizontal = layout === "horizontal";

  return (
    <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
      {title ? (
        <div className="mb-3">
          <h3 className="text-sm font-bold text-[var(--fia-gray-900)]">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-[11px] text-[var(--fia-gray-500)]">{subtitle}</p> : null}
        </div>
      ) : null}
      <div className="mb-2 flex flex-wrap gap-3">
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--fia-gray-600)]">
          <span className="h-2 w-2 rounded-full bg-[#10B981]" /> Completed
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--fia-gray-600)]">
          <span className="h-2 w-2 rounded-full bg-[#3B82F6]" /> Pending
        </span>
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--fia-gray-600)]">
          <span className="h-2 w-2 rounded-full bg-[#EF4444]" /> Overdue
        </span>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(200, data.length * (isHorizontal ? 36 : 0) + (isHorizontal ? 20 : 220))}>
        <BarChart
          data={data}
          layout={isHorizontal ? "vertical" : "horizontal"}
          margin={{ top: 5, right: 5, bottom: 5, left: isHorizontal ? 80 : -20 }}
          barGap={2}
          barSize={isHorizontal ? 14 : undefined}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--fia-gray-200, #e5e7eb)" strokeOpacity={0.5} />
          {isHorizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 10, fill: "var(--fia-gray-400)" }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "var(--fia-gray-600)" }} tickLine={false} axisLine={false} width={75} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--fia-gray-400)" }} tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 10, fill: "var(--fia-gray-400)" }} tickLine={false} axisLine={false} />
            </>
          )}
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
          <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[4, 4, 0, 0]} stackId="stack" />
          <Bar dataKey="pending" name="Pending" fill="#3B82F6" radius={[0, 0, 0, 0]} stackId="stack" />
          <Bar dataKey="overdue" name="Overdue" fill="#EF4444" radius={[0, 0, 4, 4]} stackId="stack" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
