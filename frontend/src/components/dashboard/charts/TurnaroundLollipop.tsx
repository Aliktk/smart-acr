"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
  Label,
  LabelList,
} from "recharts";

interface TurnaroundLollipopProps {
  data: Array<{ label: string; avgDays: number }>;
  title?: string;
}

const STAGE_COLORS = [
  "#6366F1",  // sapphire — Draft / Admin Office
  "#F97316",  // orange — Reporting Officer
  "#3B82F6",  // blue — Countersigning Officer
  "#8B5CF6",  // violet — Secret Branch
  "#10B981",  // emerald — Archived
  "#0EA5E9",  // sky — extra
  "#F43F5E",  // crimson — extra
];

export function TurnaroundLollipop({ data, title }: TurnaroundLollipopProps) {
  if (data.length === 0) return null;

  const maxLabelLen = Math.max(...data.map((d) => d.label.length), 1);
  const yAxisWidth = Math.min(Math.max(maxLabelLen * 6, 80), 130);

  return (
    <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
      {title ? <h3 className="mb-3 text-sm font-bold text-[var(--fia-gray-900)]">{title}</h3> : null}
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 38 + 48)}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 40, bottom: 24, left: 4 }}
          barSize={12}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--fia-gray-200, #e5e7eb)"
            strokeOpacity={0.5}
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "var(--fia-gray-400)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--fia-gray-200)", strokeOpacity: 0.6 }}
            unit="d"
            allowDecimals={false}
          >
            <Label
              value="Avg days"
              offset={-8}
              position="insideBottom"
              style={{ fontSize: 9, fill: "var(--fia-gray-400)", textTransform: "uppercase", letterSpacing: "0.04em" }}
            />
          </XAxis>
          <YAxis
            type="category"
            dataKey="label"
            width={yAxisWidth}
            tick={{ fontSize: 10, fill: "var(--fia-gray-600)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--card, #fff)",
              border: "1px solid var(--fia-gray-200, #e5e7eb)",
              borderRadius: "12px",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
              fontSize: "12px",
              padding: "8px 12px",
            }}
            formatter={(value) => [`${value} days`, "Avg turnaround"]}
          />
          <Bar dataKey="avgDays" name="Avg turnaround" radius={[0, 6, 6, 0]}>
            {data.map((_, index) => (
              <Cell key={index} fill={STAGE_COLORS[index % STAGE_COLORS.length]} />
            ))}
            <LabelList
              dataKey="avgDays"
              position="right"
              formatter={(v: unknown) => `${v}d`}
              style={{ fontSize: 10, fill: "var(--fia-gray-600)", fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
