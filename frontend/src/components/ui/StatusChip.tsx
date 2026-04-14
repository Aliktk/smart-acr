import React from "react";

type AcrStatus = string;

interface StatusChipProps {
  status: AcrStatus | string;
  size?: "sm" | "md";
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  Draft:                      { bg: "#F3F4F6", text: "#4B5563",  dot: "#9CA3AF" },
  Initiated:                  { bg: "#EFF6FF", text: "#1D4ED8",  dot: "#3B82F6" },
  "In Review":                { bg: "#EEF6FC", text: "#0369A1",  dot: "#0095D9" },
  "Pending Reporting Officer":{ bg: "#FFFBEB", text: "#B45309",  dot: "#D97706" },
  "Pending Countersigning":   { bg: "#F5F3FF", text: "#6D28D9",  dot: "#7C3AED" },
  "Pending Countersigning Officer": { bg: "#F5F3FF", text: "#6D28D9",  dot: "#7C3AED" },
  "Pending Secret Branch Review": { bg: "#EEF6FF", text: "#1D4ED8", dot: "#2563EB" },
  "Pending Secret Branch Verification": { bg: "#E0F2FE", text: "#0369A1", dot: "#0284C7" },
  "Submitted to Secret Branch": { bg: "#EEF2FF", text: "#3730A3", dot: "#4F46E5" },
  Overdue:                    { bg: "#FEF2F2", text: "#B91C1C",  dot: "#DC2626" },
  Priority:                   { bg: "#FFF7ED", text: "#C2410C",  dot: "#EA580C" },
  Archived:                   { bg: "#F8FAFC", text: "#475569",  dot: "#94A3B8" },
  Returned:                   { bg: "#FFF1F2", text: "#BE123C",  dot: "#E11D48" },
  "Returned to Clerk":        { bg: "#FFF1F2", text: "#BE123C",  dot: "#E11D48" },
  "Returned to Reporting Officer": { bg: "#FFF1F2", text: "#BE123C", dot: "#E11D48" },
  "Returned to Countersigning Officer": { bg: "#FFF1F2", text: "#BE123C", dot: "#E11D48" },
  Completed:                  { bg: "#F0FDF4", text: "#15803D",  dot: "#16A34A" },
  Active:                     { bg: "#F0FDF4", text: "#15803D",  dot: "#16A34A" },
  Inactive:                   { bg: "#F3F4F6", text: "#6B7280",  dot: "#9CA3AF" },
  Suspended:                  { bg: "#FEF2F2", text: "#B91C1C",  dot: "#DC2626" },
};

export function StatusChip({ status, size = "md" }: StatusChipProps) {
  const config = statusConfig[status] ?? statusConfig["Draft"];
  const padClass = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";

  return (
    <span
      data-testid="status-chip"
      className={`inline-flex items-center gap-1.5 rounded-md font-medium text-xs ${padClass}`}
      style={{ background: config.bg, color: config.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: config.dot }} />
      {status}
    </span>
  );
}

export function PriorityBadge({ priority = false }: { priority?: boolean }) {
  if (!priority) return null;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold"
      style={{ background: "#FFF7ED", color: "#C2410C", border: "1px solid #FED7AA" }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#EA580C" }} />
      Priority
    </span>
  );
}

export function OverdueBadge({ days }: { days?: number }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold"
      style={{ background: "#FEF2F2", color: "#B91C1C", border: "1px solid #FECACA" }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "#DC2626" }} />
      {days ? `${days}d overdue` : "Overdue"}
    </span>
  );
}
