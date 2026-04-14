"use client";

import { AlertTriangle, Calendar } from "lucide-react";
import type { RetirementWarning } from "@/types/contracts";

interface RetirementWarningsProps {
  warnings: RetirementWarning[];
}

export function RetirementWarnings({ warnings }: RetirementWarningsProps) {
  if (warnings.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 dark:border-[rgba(217,119,6,0.3)] dark:bg-[rgba(217,119,6,0.08)]">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle size={18} className="text-amber-600" />
        <h3 className="text-base font-semibold text-amber-800 dark:text-amber-300">Retirement — Pending ACRs</h3>
        <span className="text-xs text-amber-500 dark:text-amber-400">FIA Standing Order No. 02/2023, Item xiv</span>
      </div>
      <p className="mb-3 text-sm text-amber-700 dark:text-amber-400">
        Retiring officers must initiate/countersign ACRs for subordinates who have served 3+ months before their retirement date.
      </p>
      <div className="space-y-2">
        {warnings.map((warning) => (
          <div
            key={warning.employeeId}
            className="flex items-center justify-between rounded-xl border border-amber-200 bg-white px-3 py-2 dark:border-[rgba(217,119,6,0.2)] dark:bg-[var(--card)]"
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{warning.employeeName}</p>
              <p className="text-xs text-gray-500">
                {warning.designation} · BPS-{warning.bps}
              </p>
            </div>
            <div className="flex items-center gap-2 text-right">
              <Calendar size={14} className="text-amber-500" />
              <div>
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  {warning.daysUntilRetirement} days left
                </p>
                <p className="text-xs text-gray-500">
                  Retires {new Date(warning.retirementDate).toLocaleDateString("en-PK", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
