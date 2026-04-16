import React from "react";
import {
  CheckCircle,
  Clock,
  RotateCcw,
} from "lucide-react";

export interface TimelineItem {
  id: string;
  action: string;
  actor: string;
  role: string;
  timestamp: string;
  status: "completed" | "active" | "pending" | "returned";
  remarks?: string;
}

const iconMap: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  completed: CheckCircle,
  active: Clock,
  pending: Clock,
  returned: RotateCcw,
};

const colorMap = {
  completed: {
    icon: "text-green-600 dark:text-green-400",
    bg: "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800/60",
    dot: "bg-green-500 dark:bg-green-400",
    connector: "bg-green-200 dark:bg-green-800/60",
  },
  active: {
    icon: "text-[#049DD9]",
    bg: "bg-cyan-50 border-cyan-200 dark:bg-cyan-900/20 dark:border-cyan-800/60",
    dot: "bg-[#049DD9]",
    connector: "bg-gray-200 dark:bg-gray-700",
  },
  pending: {
    icon: "text-gray-400",
    bg: "bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700",
    dot: "bg-gray-300 dark:bg-gray-600",
    connector: "bg-gray-200 dark:bg-gray-700",
  },
  returned: {
    icon: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800/60",
    dot: "bg-rose-500 dark:bg-rose-400",
    connector: "bg-gray-200 dark:bg-gray-700",
  },
};

interface TimelineProps {
  items: TimelineItem[];
}

export function Timeline({ items }: TimelineProps) {
  return (
    <div className="space-y-1">
      {items.map((item, idx) => {
        const colors = colorMap[item.status];
        const Icon = iconMap[item.status] || Clock;
        const isLast = idx === items.length - 1;

        return (
          <div key={item.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                  item.status === "completed"
                    ? "border-green-500 bg-green-50 dark:bg-green-900/30"
                    : item.status === "active"
                      ? "border-[#049DD9] bg-cyan-50 dark:bg-cyan-900/30"
                      : item.status === "returned"
                        ? "border-rose-500 bg-rose-50 dark:bg-rose-900/30"
                        : "border-gray-300 bg-gray-50 dark:bg-gray-800/50"
                }`}
              >
                <Icon size={14} className={colors.icon} />
              </div>
              {!isLast && <div className={`my-1 min-h-5 w-0.5 flex-1 ${colors.connector}`} />}
            </div>

            <div className="flex-1 pb-3">
              <div className={`rounded-2xl border px-3.5 py-3 ${colors.bg}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[#0D0D0D] dark:text-[var(--fia-gray-900)]">
                      {item.action}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {item.actor} •{" "}
                      <span className="text-[#4B498C] font-medium dark:text-[var(--fia-navy-400)]">
                        {item.role}
                      </span>
                    </p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {item.timestamp}
                  </span>
                </div>
                {item.remarks && (
                  <p className="mt-2 rounded-xl border border-white/60 bg-white/60 px-3 py-2 text-xs text-gray-600 dark:border-white/10 dark:bg-white/5 dark:text-[var(--fia-gray-600)]">
                    {item.remarks}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
