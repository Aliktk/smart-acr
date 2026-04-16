"use client";

interface PriorityBadgeProps {
  priority?: boolean;
}

interface OverdueBadgeProps {
  days?: number;
}

export function PriorityBadge({ priority = false }: PriorityBadgeProps) {
  if (!priority) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:border-orange-800/50 dark:bg-orange-900/30 dark:text-orange-300">
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-orange-500 dark:bg-orange-400" />
      Priority
    </span>
  );
}

export function OverdueBadge({ days }: OverdueBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:border-red-800/50 dark:bg-red-900/30 dark:text-red-300">
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-500 dark:bg-red-400" />
      {days ? `${days}d overdue` : "Overdue"}
    </span>
  );
}
