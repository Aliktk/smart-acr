"use client";

import ReactECharts from "echarts-for-react";
import { DT, CHART_PALETTE } from "@/styles/dashboard-tokens";
import { useMemo } from "react";

interface SankeyNode { name: string; }
interface SankeyLink { source: string; target: string; value: number; }

interface AcrFlowSankeyProps {
  nodes: SankeyNode[];
  links: SankeyLink[];
  title?: string;
}

const NODE_COLORS: Record<string, string> = {
  "Initiated": DT.slate[400],
  "Pending Reporting": DT.amber[500],
  "Pending Countersigning": DT.amber[600],
  "Secret Branch Review": DT.violet[500],
  "Archived": DT.teal[500],
  "Returned to Clerk": DT.crimson[400],
  "Returned to RO": DT.crimson[500],
  "Returned to CSO": DT.crimson[600],
};

export function AcrFlowSankey({ nodes, links, title }: AcrFlowSankeyProps) {
  const option = useMemo(() => ({
    animation: true,
    tooltip: {
      trigger: "item" as const,
      triggerOn: "mousemove" as const,
      backgroundColor: "var(--card, #fff)",
      borderColor: "var(--fia-gray-200, #e5e7eb)",
      borderRadius: 12,
      textStyle: { fontSize: 12, color: "var(--fia-gray-800, #1e293b)" },
    },
    series: [{
      type: "sankey" as const,
      layout: "none" as const,
      emphasis: { focus: "adjacency" as const },
      nodeAlign: "left" as const,
      nodeGap: 12,
      nodeWidth: 16,
      lineStyle: { color: "gradient" as const, opacity: 0.3 },
      label: {
        position: "right" as const,
        fontSize: 11,
        color: "var(--fia-gray-700, #374151)",
        fontFamily: "inherit",
      },
      data: nodes.map((n, idx) => ({
        name: n.name,
        itemStyle: { color: NODE_COLORS[n.name] ?? CHART_PALETTE[idx % CHART_PALETTE.length] },
      })),
      links,
    }],
  }), [nodes, links]);

  return (
    <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] p-4 shadow-sm">
      {title ? <h3 className="mb-3 text-sm font-bold text-[var(--fia-gray-900)]">{title}</h3> : null}
      <ReactECharts option={option} style={{ height: 280 }} opts={{ renderer: "svg" }} />
    </div>
  );
}
