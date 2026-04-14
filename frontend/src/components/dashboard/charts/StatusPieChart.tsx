"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface StatusPieChartProps {
  data: Array<{ label: string; value: number }>;
  title?: string;
}

const COLORS = ["#10B981", "#3B82F6", "#F59E0B", "#0EA5E9", "#EF4444", "#8B5CF6", "#6366F1", "#94A3B8"];

export function StatusPieChart({ data, title }: StatusPieChartProps) {
  const filtered = data.filter((d) => d.value > 0);
  if (filtered.length === 0) return null;

  return (
    <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
      {title ? <h3 className="mb-3 text-sm font-bold text-[var(--fia-gray-900)]">{title}</h3> : null}
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={filtered}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            strokeWidth={0}
          >
            {filtered.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--card, #fff)",
              border: "1px solid var(--fia-gray-200, #e5e7eb)",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              fontSize: "12px",
              padding: "8px 12px",
            }}
            formatter={(value) => `${value} ACRs`}
          />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: "11px", lineHeight: "22px" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
