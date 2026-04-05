"use client";

import { useQuery } from "@tanstack/react-query";
import { getAnalytics, getDashboardOverview, getSession } from "@/api/client";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";
import { getDashboardMode } from "@/utils/acr";

const leadershipModes = new Set(["executive", "secret-branch"]);

export default function DashboardPage() {
  const sessionQuery = useQuery({
    queryKey: ["session"],
    queryFn: getSession,
  });

  const overviewQuery = useQuery({
    queryKey: ["dashboard-overview"],
    queryFn: getDashboardOverview,
  });

  const mode = sessionQuery.data ? getDashboardMode(sessionQuery.data.activeRoleCode) : "clerk";
  const analyticsQuery = useQuery({
    queryKey: ["analytics", mode],
    queryFn: getAnalytics,
    enabled: leadershipModes.has(mode),
  });

  if (sessionQuery.isLoading || overviewQuery.isLoading) {
    return <div className="p-6 text-sm text-[var(--fia-gray-500)]">Loading dashboard...</div>;
  }

  return (
    <RoleDashboard
      session={sessionQuery.data}
      overview={overviewQuery.data}
      analytics={analyticsQuery.data}
    />
  );
}
