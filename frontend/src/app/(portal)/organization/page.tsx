"use client";

import { useQuery } from "@tanstack/react-query";
import { getOrganizationSummary } from "@/api/client";

export default function OrganizationPage() {
  const { data } = useQuery({
    queryKey: ["organization"],
    queryFn: getOrganizationSummary,
  });

  return (
    <div className="mx-auto max-w-screen-xl space-y-5 p-6">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Organization Structure</h1>
        <p className="mt-0.5 text-sm text-gray-500">Wings, zones, and office-level staffing coverage.</p>
      </div>

      <div className="space-y-4">
        {data?.map((wing) => (
          <section key={wing.id} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-[#111827]">{wing.name}</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              {wing.zones.map((zone) => (
                <div key={zone.id} className="rounded-lg border border-gray-100 bg-[#F9FAFB] p-4">
                  <p className="font-semibold text-[#1A1C6E]">{zone.name}</p>
                  <div className="mt-3 space-y-2">
                    {zone.offices.map((office) => (
                      <div key={office.id} className="flex items-center justify-between text-sm">
                        <span className="text-[#111827]">{office.name}</span>
                        <span className="text-gray-500">{office.employeeCount} employees · {office.userCount} users</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
