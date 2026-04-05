"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Archive } from "lucide-react";
import { PortalPageHeader, PortalSurface, EmptyState } from "@/components/portal/PortalPrimitives";
import { StatCard } from "@/components/ui";
import { StatusChip } from "@/components/ui";
import { getArchive } from "@/api/client";

export default function ArchivePage() {
  const { data } = useQuery({
    queryKey: ["archive"],
    queryFn: getArchive,
  });

  return (
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-5 p-5">
      <PortalPageHeader
        eyebrow="Secret Branch archive"
        title="Archive"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Archived Records" value={data?.items.length ?? 0} subtitle="Visible final packets" icon={<Archive size={18} />} accent="green" />
      </div>

      <PortalSurface title="Archive records">
        {!data?.items.length ? (
          <EmptyState
            title="No archived records available"
            description="Finalized packets will appear here once they reach Secret Branch and are stored as authoritative records."
          />
        ) : (
          <div className="space-y-2.5">
            {data.items.map((item) => (
              <div key={item.id} className="rounded-[18px] border border-gray-200 bg-white px-4 py-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/acr/${item.id}`} className="font-semibold text-[#1A1C6E] hover:text-[#0095D9]">
                      {item.acrNo}
                    </Link>
                    <p className="mt-0.5 text-sm text-gray-500">{item.employee.name} · {item.reportingPeriod}</p>
                    <p className="mt-1.5 text-xs text-gray-400">Archive reference: {item.archiveReference ?? "Pending snapshot path"}</p>
                  </div>
                  <StatusChip status={item.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </PortalSurface>
    </div>
  );
}
