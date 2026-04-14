"use client";

interface MiniDonutProps {
  segments: Array<{ value: number; color: string; label?: string }>;
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string;
}

export function MiniDonut({
  segments,
  size = 64,
  strokeWidth = 8,
  centerLabel,
  centerValue,
}: MiniDonutProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  let accumulated = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block -rotate-90">
        {segments.map((segment, index) => {
          const dashLength = (segment.value / total) * circumference;
          const dashOffset = -(accumulated / total) * circumference;
          accumulated += segment.value;

          return (
            <circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      {(centerLabel || centerValue) ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {centerValue ? <span className="text-sm font-bold text-[var(--fia-gray-900)] leading-none">{centerValue}</span> : null}
          {centerLabel ? <span className="text-[8px] font-medium text-[var(--fia-gray-500)] uppercase tracking-wider">{centerLabel}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
