"use client";

interface MiniBarProps {
  data: Array<{ value: number; label?: string; color?: string }>;
  height?: number;
  maxWidth?: number;
  barColor?: string;
}

export function MiniBar({
  data,
  height = 28,
  maxWidth = 140,
  barColor = "var(--fia-cyan, #0095D9)",
}: MiniBarProps) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = Math.max(4, Math.floor(maxWidth / data.length) - 2);
  const gap = 2;
  const totalWidth = data.length * (barWidth + gap) - gap;

  return (
    <svg width={totalWidth} height={height} viewBox={`0 0 ${totalWidth} ${height}`} className="block">
      {data.map((item, index) => {
        const barHeight = Math.max(2, (item.value / max) * (height - 2));
        const x = index * (barWidth + gap);
        const y = height - barHeight;

        return (
          <rect
            key={index}
            x={x}
            y={y}
            width={barWidth}
            height={barHeight}
            rx={2}
            fill={item.color ?? barColor}
            opacity={0.85}
          >
            {item.label ? <title>{`${item.label}: ${item.value}`}</title> : null}
          </rect>
        );
      })}
    </svg>
  );
}
