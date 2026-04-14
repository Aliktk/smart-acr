"use client";

interface TurnaroundLollipopProps {
  data: Array<{ label: string; avgDays: number }>;
  title?: string;
}

const STAGE_COLORS = ["#94A3B8", "#F59E0B", "#3B82F6", "#0EA5E9", "#10B981"];

export function TurnaroundLollipop({ data, title }: TurnaroundLollipopProps) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.avgDays), 1);

  return (
    <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
      {title ? <h3 className="mb-3 text-sm font-bold text-[var(--fia-gray-900)]">{title}</h3> : null}
      <div className="space-y-3">
        {data.map((item, index) => {
          const pct = (item.avgDays / max) * 100;
          const color = STAGE_COLORS[index % STAGE_COLORS.length];
          return (
            <div key={item.label} className="group">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--fia-gray-700)]">{item.label}</span>
                <span className="text-xs font-bold" style={{ color }}>{item.avgDays}d</span>
              </div>
              <div className="relative h-2.5 overflow-hidden rounded-full bg-[var(--fia-gray-100)]">
                <div
                  className="h-full rounded-full transition-all duration-700 group-hover:opacity-90"
                  style={{ width: `${pct}%`, backgroundColor: color }}
                />
                {/* Lollipop dot */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-white shadow-sm transition-all"
                  style={{ left: `calc(${pct}% - 8px)`, backgroundColor: color }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
