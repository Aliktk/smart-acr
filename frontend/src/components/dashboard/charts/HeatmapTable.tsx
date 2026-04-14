"use client";

import type { DashboardHeatmap } from "@/types/contracts";

interface HeatmapTableProps {
  heatmap: DashboardHeatmap;
}

function getHeatColor(value: number, max: number): string {
  if (max === 0) return "transparent";
  const intensity = value / max;
  if (intensity > 0.75) return "rgba(239, 68, 68, 0.25)";
  if (intensity > 0.5) return "rgba(245, 158, 11, 0.2)";
  if (intensity > 0.25) return "rgba(59, 130, 246, 0.15)";
  if (intensity > 0) return "rgba(16, 185, 129, 0.1)";
  return "transparent";
}

export function HeatmapTable({ heatmap }: HeatmapTableProps) {
  if (heatmap.rows.length === 0) return null;

  const allValues = heatmap.rows.flatMap((row) => Object.values(row.values));
  const maxValue = Math.max(...allValues, 1);

  return (
    <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-[var(--fia-gray-900)]">{heatmap.title}</h3>
        {heatmap.subtitle ? <p className="mt-0.5 text-[11px] text-[var(--fia-gray-500)]">{heatmap.subtitle}</p> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--fia-gray-200)]">
              <th className="pb-2 pr-3 text-left font-semibold text-[var(--fia-gray-500)]">Unit</th>
              {heatmap.columns.map((col) => (
                <th key={col.key} className="px-2 pb-2 text-center font-semibold text-[var(--fia-gray-500)]">
                  {col.label}
                </th>
              ))}
              <th className="px-2 pb-2 text-center font-semibold text-[var(--fia-gray-500)]">Rate</th>
              <th className="pl-2 pb-2 text-center font-semibold text-[var(--fia-gray-500)]">Total</th>
            </tr>
          </thead>
          <tbody>
            {heatmap.rows.map((row) => (
              <tr key={row.id} className="border-b border-[var(--fia-gray-100)] last:border-0 hover:bg-[var(--fia-gray-50)] transition-colors">
                <td className="py-2 pr-3 font-medium text-[var(--fia-gray-800)]">{row.label}</td>
                {heatmap.columns.map((col) => {
                  const value = row.values[col.key] ?? 0;
                  return (
                    <td key={col.key} className="px-2 py-2 text-center">
                      <span
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold"
                        style={{ backgroundColor: getHeatColor(value, maxValue), color: value > 0 ? "var(--fia-gray-800)" : "var(--fia-gray-400)" }}
                        title={`${row.label} — ${col.label}: ${value}`}
                      >
                        {value || "–"}
                      </span>
                    </td>
                  );
                })}
                <td className="px-2 py-2 text-center">
                  <span className={`text-[11px] font-bold ${row.completionRate >= 80 ? "text-emerald-600" : row.completionRate >= 50 ? "text-amber-600" : "text-red-500"}`}>
                    {row.completionRate}%
                  </span>
                </td>
                <td className="pl-2 py-2 text-center font-semibold text-[var(--fia-gray-700)]">{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
