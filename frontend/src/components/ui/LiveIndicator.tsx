"use client";

interface LiveIndicatorProps {
  label?: string;
  intervalLabel?: string; // e.g. "90s"
}

export function LiveIndicator({
  label = "Live",
  intervalLabel,
}: LiveIndicatorProps) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {/* Pulsing green dot */}
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
      </span>
      <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
        {label}
      </span>
      {intervalLabel ? (
        <span className="text-[10px] text-[var(--fia-gray-400)]">
          · refreshes every {intervalLabel}
        </span>
      ) : null}
    </span>
  );
}
