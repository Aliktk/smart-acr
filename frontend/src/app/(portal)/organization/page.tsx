"use client";

import { useQuery } from "@tanstack/react-query";
import { getOrganizationMasterData } from "@/api/client";
import { EmptyState, PortalPageHeader, PortalSurface } from "@/components/portal/PortalPrimitives";

function Section({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: Array<{ id: string; name: string; code: string; meta: string }>;
}) {
  return (
    <PortalSurface title={title} subtitle={subtitle}>
      {rows.length === 0 ? (
        <EmptyState title={`No ${title.toLowerCase()} found`} description="Seeded and configured organization master data will appear here." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <div key={row.id} className="rounded-2xl border border-[#E2E8F0] dark:border-[var(--fia-gray-200)] bg-[#FBFCFE] dark:bg-[var(--fia-gray-50)] px-4 py-3">
              <p className="text-sm font-semibold text-[#111827] dark:text-[var(--fia-gray-900)]">{row.name}</p>
              <p className="mt-1 text-xs text-[#64748B] dark:text-[var(--fia-gray-500)]">{row.code}</p>
              <p className="mt-2 text-xs leading-5 text-[#475569] dark:text-[var(--fia-gray-600)]">{row.meta}</p>
            </div>
          ))}
        </div>
      )}
    </PortalSurface>
  );
}

export default function OrganizationPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["organization-master-data"],
    queryFn: getOrganizationMasterData,
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-[var(--fia-gray-500)]">Loading organization master data...</div>;
  }

  return (
    <div className="mx-auto max-w-screen-2xl space-y-5 p-6">
      <PortalPageHeader
        eyebrow="Organization master data"
        title="Organization Hierarchy"
        description="Read-only hierarchy explorer for wings, directorates, regions, zones, circles, stations, branches, cells, offices, and departments."
      />

      <Section
        title="Wings"
        subtitle="Top-level FIA organizational wings."
        rows={(data?.wings ?? []).map((item) => ({ id: item.id, name: item.name, code: item.code, meta: "Top-level organizational scope" }))}
      />
      <Section
        title="Directorates"
        subtitle="Directorates grouped under wings."
        rows={(data?.directorates ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          code: item.code,
          meta: `Wing: ${(data?.wings ?? []).find((wing) => wing.id === item.wingId)?.name ?? "Unknown"}`,
        }))}
      />
      <Section
        title="Regions"
        subtitle="Top-level regional structure used for North/South routing and analytics."
        rows={(data?.regions ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          code: item.code,
          meta: [
            item.directorateId ? `Directorate: ${(data?.directorates ?? []).find((entry) => entry.id === item.directorateId)?.name ?? "Unknown"}` : null,
            item.wingId ? `Wing link: ${(data?.wings ?? []).find((wing) => wing.id === item.wingId)?.name ?? "Unknown"}` : "Regional top-level unit",
          ].filter(Boolean).join(" · "),
        }))}
      />
      <Section
        title="Zones"
        subtitle="Operational zones under each region."
        rows={(data?.zones ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          code: item.code,
          meta: `Region: ${(data?.regions ?? []).find((entry) => entry.id === item.regionId)?.name ?? "Unknown"}`,
        }))}
      />
      <Section
        title="Circles & Stations"
        subtitle="Configurable circles and station-level units, including airport and seaport examples."
        rows={[
          ...((data?.circles ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            code: item.code,
            meta: `Circle · Zone: ${(data?.zones ?? []).find((entry) => entry.id === item.zoneId)?.name ?? "Unknown"}`,
          }))),
          ...((data?.stations ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            code: item.code,
            meta: `Station · Circle: ${(data?.circles ?? []).find((entry) => entry.id === item.circleId)?.name ?? "Optional"} · Zone: ${(data?.zones ?? []).find((entry) => entry.id === item.zoneId)?.name ?? "Unknown"}`,
          }))),
        ]}
      />
      <Section
        title="Branches & Cells"
        subtitle="Branch and cell units used for operational and Secret Branch routing."
        rows={[
          ...((data?.branches ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            code: item.code,
            meta: `Branch · Zone: ${(data?.zones ?? []).find((entry) => entry.id === item.zoneId)?.name ?? "Unknown"}`,
          }))),
          ...((data?.cells ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            code: item.code,
            meta: `Cell · Branch: ${(data?.branches ?? []).find((entry) => entry.id === item.branchId)?.name ?? "Unassigned"}`,
          }))),
        ]}
      />
      <Section
        title="Offices & Departments"
        subtitle="Office and department scope used by employees and user assignments."
        rows={[
          ...((data?.offices ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            code: item.code,
            meta: item.scopeTrack === "WING"
              ? `Wing office · Directorate: ${(data?.directorates ?? []).find((entry) => entry.id === item.directorateId)?.name ?? "Optional"} · Wing: ${(data?.wings ?? []).find((entry) => entry.id === item.wingId)?.name ?? "Unknown"}`
              : `Regional office · Zone: ${(data?.zones ?? []).find((entry) => entry.id === item.zoneId)?.name ?? "Unknown"} · Region: ${(data?.regions ?? []).find((entry) => entry.id === item.regionId)?.name ?? "Unknown"}`,
          }))),
          ...((data?.departments ?? []).map((item) => ({
            id: item.id,
            name: item.name,
            code: item.code,
            meta: `Department · Office: ${(data?.offices ?? []).find((entry) => entry.id === item.officeId)?.name ?? "Unknown"}`,
          }))),
        ]}
      />
    </div>
  );
}
