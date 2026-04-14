"use client";

import { CheckCircle2 } from "lucide-react";

interface PipelineStage {
  label: string;
  count: number;
  color: string;
}

interface WorkflowPipelineProps {
  stages: PipelineStage[];
  title?: string;
}

export function WorkflowPipeline({ stages, title = "Workflow Pipeline" }: WorkflowPipelineProps) {
  const total = stages.reduce((sum, s) => sum + s.count, 0) || 1;
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
      {/* Header row */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-[var(--fia-gray-900)]">{title}</h3>
          <p className="mt-0.5 text-[11px] text-[var(--fia-gray-500)]">
            {total.toLocaleString()} total records across {stages.length} stages
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] px-2.5 py-1">
          <CheckCircle2 size={11} className="text-[var(--fia-success)]" />
          <span className="text-[11px] font-semibold text-[var(--fia-gray-600)]">
            {stages.find((s) => s.label === "Archived")?.count ?? 0} archived
          </span>
        </div>
      </div>

      {/* Progress band — proportional width per stage */}
      <div className="mb-4 flex h-2 overflow-hidden rounded-full bg-[var(--fia-gray-100)]">
        {stages.map((stage, index) => {
          const widthPct = Math.max(3, (stage.count / total) * 100);
          return (
            <div
              key={index}
              className="transition-all duration-500"
              style={{ width: `${widthPct}%`, backgroundColor: stage.color, opacity: stage.count === 0 ? 0.25 : 1 }}
              title={`${stage.label}: ${stage.count}`}
            />
          );
        })}
      </div>

      {/* Stage cards with flow arrows */}
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${stages.length}, minmax(0, 1fr))` }}>
        {stages.map((stage, index) => {
          const pct = Math.round((stage.count / maxCount) * 100);
          const isLast = index === stages.length - 1;
          return (
            <div key={index} className="group relative">
              {/* Card */}
              <div
                className="flex flex-col rounded-xl px-2 py-2.5 transition-all hover:brightness-95"
                style={{
                  backgroundColor: `${stage.color}12`,
                  borderTop: `2px solid ${stage.color}`,
                }}
              >
                {/* Count */}
                <span
                  className="text-[1.1rem] font-bold leading-none"
                  style={{ color: stage.count === 0 ? "var(--fia-gray-400)" : stage.color }}
                >
                  {stage.count.toLocaleString()}
                </span>
                {/* Label */}
                <span className="mt-1 text-[10px] font-medium leading-tight text-[var(--fia-gray-500)]">
                  {stage.label}
                </span>
                {/* Utilization mini bar */}
                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-[var(--fia-gray-200)]">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: stage.color,
                      opacity: stage.count === 0 ? 0.3 : 1,
                    }}
                  />
                </div>
                {/* Percentage of total */}
                <span className="mt-1.5 text-[9px] font-semibold text-[var(--fia-gray-400)]">
                  {Math.round((stage.count / total) * 100)}%
                </span>
              </div>
              {/* Arrow connector — not on last stage */}
              {!isLast ? (
                <div
                  className="absolute -right-[7px] top-1/2 z-10 flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--fia-gray-200)] bg-[var(--card)] text-[var(--fia-gray-300)]"
                  style={{ fontSize: "9px" }}
                >
                  ›
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
