"use client";

import { useState } from "react";

interface RegionData {
  id: string;
  label: string;
  count: number;
  completion?: number;
}

interface PakistanMapProps {
  regions?: RegionData[];
  title?: string;
  subtitle?: string;
  onRegionClick?: (regionId: string) => void;
}

interface ProvinceConfig {
  id: string;
  name: string;
  pathData: string;
  cx?: number;
  cy?: number;
  r?: number;
}

const provinces: ProvinceConfig[] = [
  {
    id: "balochistan",
    name: "Balochistan",
    pathData:
      "M 60,200 L 80,160 L 120,140 L 160,130 L 180,110 L 220,100 L 240,115 L 250,140 L 260,170 L 265,200 L 270,230 L 265,260 L 260,290 L 250,320 L 240,350 L 220,370 L 200,390 L 180,400 L 160,410 L 140,420 L 120,430 L 100,440 L 80,450 L 65,440 L 55,420 L 50,390 L 48,360 L 50,330 L 52,300 L 55,270 L 58,240 Z",
  },
  {
    id: "sindh",
    name: "Sindh",
    pathData:
      "M 240,350 L 250,320 L 260,290 L 265,260 L 270,230 L 300,240 L 330,250 L 350,270 L 360,300 L 370,330 L 375,360 L 370,390 L 360,410 L 340,430 L 310,440 L 280,445 L 260,440 L 240,430 L 220,420 L 220,410 L 220,390 L 220,370 Z",
  },
  {
    id: "punjab",
    name: "Punjab",
    pathData:
      "M 250,140 L 280,130 L 310,125 L 340,120 L 360,115 L 380,118 L 390,130 L 400,150 L 405,175 L 400,200 L 395,225 L 380,245 L 360,260 L 340,268 L 320,272 L 300,268 L 280,260 L 265,245 L 262,225 L 265,200 L 265,175 L 265,150 Z",
  },
  {
    id: "kpk",
    name: "Khyber Pakhtunkhwa",
    pathData:
      "M 220,100 L 240,80 L 250,60 L 255,40 L 265,30 L 280,35 L 295,45 L 300,60 L 295,75 L 290,90 L 300,100 L 310,115 L 310,125 L 280,130 L 250,140 L 240,115 Z",
  },
  {
    id: "gilgit-baltistan",
    name: "Gilgit-Baltistan",
    pathData:
      "M 255,40 L 265,20 L 280,10 L 300,5 L 320,8 L 340,15 L 360,25 L 370,40 L 360,55 L 340,60 L 320,62 L 300,60 L 295,45 L 280,35 L 265,30 Z",
  },
  {
    id: "ajk",
    name: "Azad Jammu & Kashmir",
    pathData:
      "M 340,60 L 360,55 L 380,65 L 385,80 L 375,90 L 360,92 L 345,85 L 340,72 Z",
  },
  {
    id: "fata",
    name: "FATA",
    pathData:
      "M 295,45 L 310,40 L 325,45 L 330,60 L 320,62 L 300,60 L 295,45 Z",
  },
];

const cities = [
  { name: "Karachi", cx: 350, cy: 390 },
  { name: "Lahore", cx: 360, cy: 195 },
  { name: "Islamabad", cx: 310, cy: 118 },
  { name: "Peshawar", cx: 270, cy: 80 },
  { name: "Quetta", cx: 145, cy: 295 },
];

function getColorIntensity(
  count: number,
  maxCount: number,
  baseColor: string
): string {
  if (maxCount === 0) return "rgba(148, 163, 184, 0.2)";
  const ratio = Math.min(count / maxCount, 1);
  const alpha = 0.12 + ratio * 0.73;
  return `rgba(26, 28, 110, ${alpha})`;
}

function matchRegionToProvince(provinceName: string, regionData: RegionData[]): RegionData | undefined {
  const provinceLower = provinceName.toLowerCase();
  return regionData.find((r) =>
    provinceLower.includes(r.label.toLowerCase().split(" ")[0]) ||
    r.label.toLowerCase().includes(provinceLower)
  );
}

export function PakistanMap({
  regions = [],
  title,
  subtitle,
  onRegionClick,
}: PakistanMapProps) {
  const [hoveredProvinceId, setHoveredProvinceId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [tooltipData, setTooltipData] = useState<RegionData | null>(null);

  const maxCount = Math.max(
    1,
    ...regions.map((r) => r.count)
  );

  const handleProvinceHover = (
    e: React.MouseEvent<SVGPathElement>,
    province: ProvinceConfig
  ) => {
    const matchedRegion = matchRegionToProvince(province.name, regions);
    if (matchedRegion) {
      setHoveredProvinceId(province.id);
      const rect = e.currentTarget.getBoundingClientRect();
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: rect.top,
      });
      setTooltipData(matchedRegion);
    }
  };

  const handleProvinceLeave = () => {
    setHoveredProvinceId(null);
    setTooltipPos(null);
    setTooltipData(null);
  };

  const handleProvinceClick = (province: ProvinceConfig) => {
    const matchedRegion = matchRegionToProvince(province.name, regions);
    if (matchedRegion && onRegionClick) {
      onRegionClick(matchedRegion.id);
    }
  };

  return (
    <div className="rounded-[24px] border border-[var(--fia-gray-200)] bg-[var(--card)] shadow-sm p-5">
      {title && (
        <div className="mb-1 text-[1.02rem] font-semibold text-[var(--fia-gray-950)]">
          {title}
        </div>
      )}
      {subtitle && (
        <div className="mb-4 text-sm text-[var(--fia-gray-500)]">{subtitle}</div>
      )}

      {/* SVG Map Container */}
      <div className="relative mb-4">
        <svg
          viewBox="0 0 520 480"
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          className="block"
        >
          {/* Provinces */}
          {provinces.map((province) => {
            const matchedRegion = matchRegionToProvince(province.name, regions);
            const fillColor = matchedRegion
              ? getColorIntensity(matchedRegion.count, maxCount, "rgb(26, 28, 110)")
              : "rgba(148, 163, 184, 0.2)";

            const isHovered = hoveredProvinceId === province.id;
            const strokeColor = isHovered
              ? "rgba(26, 28, 110, 0.8)"
              : "rgba(26, 28, 110, 0.2)";
            const strokeWidth = isHovered ? 2 : 1;

            return (
              <path
                key={province.id}
                d={province.pathData}
                fill={fillColor}
                stroke={strokeColor}
                strokeWidth={strokeWidth}
                className="transition-all duration-200 cursor-pointer hover:opacity-85"
                onMouseEnter={(e) => handleProvinceHover(e, province)}
                onMouseLeave={handleProvinceLeave}
                onClick={() => handleProvinceClick(province)}
              />
            );
          })}

          {/* City Markers */}
          {cities.map((city) => (
            <g key={city.name}>
              <circle
                cx={city.cx}
                cy={city.cy}
                r="4"
                fill="white"
                stroke="rgba(26, 28, 110, 0.8)"
                strokeWidth="1.5"
              />
              <text
                x={city.cx}
                y={city.cy - 8}
                textAnchor="middle"
                fontSize="9"
                fontWeight="500"
                fill="rgba(26, 28, 110, 0.7)"
              >
                {city.name}
              </text>
            </g>
          ))}
        </svg>

        {/* Tooltip */}
        {tooltipData && tooltipPos && (
          <div
            className="absolute bg-[var(--card)] border border-[var(--fia-gray-200)] rounded-lg shadow-lg p-3 text-xs whitespace-nowrap z-50"
            style={{
              left: `${tooltipPos.x}px`,
              top: `${tooltipPos.y - 80}px`,
              transform: "translateX(-50%)",
              pointerEvents: "none",
            }}
          >
            <div className="font-semibold text-[var(--fia-gray-900)]">
              {tooltipData.label}
            </div>
            <div className="text-[var(--fia-gray-600)] mt-0.5">
              ACR Count: <span className="font-semibold">{tooltipData.count}</span>
            </div>
            {tooltipData.completion !== undefined && (
              <div className="text-[var(--fia-gray-600)] mt-0.5">
                Completion:{" "}
                <span className="font-semibold">{tooltipData.completion}%</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-[var(--fia-gray-600)] uppercase tracking-[0.05em]">
          Intensity Scale
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-4 rounded-full overflow-hidden bg-gradient-to-r from-[rgba(26,28,110,0.12)] to-[rgba(26,28,110,0.85)] border border-[var(--fia-gray-200)]" />
          <div className="flex justify-between w-32 text-xs text-[var(--fia-gray-500)]">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </div>
    </div>
  );
}
