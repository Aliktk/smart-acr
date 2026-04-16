import React from "react";

type AcrStatus = string;

interface StatusChipProps {
  status: AcrStatus | string;
  size?: "sm" | "md";
}

const statusConfig: Record<string, { chip: string; dot: string }> = {
  Draft:                      { chip: "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-300",          dot: "bg-gray-400 dark:bg-gray-500" },
  Initiated:                  { chip: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",            dot: "bg-blue-500 dark:bg-blue-400" },
  "In Review":                { chip: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",               dot: "bg-sky-500 dark:bg-sky-400" },
  "Pending Reporting Officer":{ chip: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",       dot: "bg-amber-500 dark:bg-amber-400" },
  "Pending Countersigning":   { chip: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",   dot: "bg-violet-500 dark:bg-violet-400" },
  "Pending Countersigning Officer": { chip: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300", dot: "bg-violet-500 dark:bg-violet-400" },
  "Pending Secret Branch Review": { chip: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",       dot: "bg-blue-500 dark:bg-blue-400" },
  "Pending Secret Branch Verification": { chip: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",   dot: "bg-sky-500 dark:bg-sky-400" },
  "Submitted to Secret Branch": { chip: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300", dot: "bg-indigo-500 dark:bg-indigo-400" },
  Overdue:                    { chip: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",               dot: "bg-red-500 dark:bg-red-400" },
  Priority:                   { chip: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",   dot: "bg-orange-500 dark:bg-orange-400" },
  Archived:                   { chip: "bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-400",       dot: "bg-slate-400 dark:bg-slate-500" },
  Returned:                   { chip: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",           dot: "bg-rose-500 dark:bg-rose-400" },
  "Returned to Clerk":        { chip: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",           dot: "bg-rose-500 dark:bg-rose-400" },
  "Returned to Reporting Officer": { chip: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",     dot: "bg-rose-500 dark:bg-rose-400" },
  "Returned to Countersigning Officer": { chip: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", dot: "bg-rose-500 dark:bg-rose-400" },
  "Returned to Admin Office": { chip: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", dot: "bg-rose-500 dark:bg-rose-400" },
  Completed:                  { chip: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",       dot: "bg-green-500 dark:bg-green-400" },
  Active:                     { chip: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",       dot: "bg-green-500 dark:bg-green-400" },
  Inactive:                   { chip: "bg-gray-100 text-gray-600 dark:bg-gray-800/60 dark:text-gray-400",          dot: "bg-gray-400 dark:bg-gray-500" },
  Suspended:                  { chip: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",               dot: "bg-red-500 dark:bg-red-400" },
};

export function StatusChip({ status, size = "md" }: StatusChipProps) {
  const config = statusConfig[status] ?? statusConfig["Draft"];
  const padClass = size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1";

  return (
    <span
      data-testid="status-chip"
      className={`inline-flex items-center gap-1.5 rounded-md font-medium text-xs ${padClass} ${config.chip}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${config.dot}`} />
      {status}
    </span>
  );
}

