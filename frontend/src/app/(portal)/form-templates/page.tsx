"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getTemplates } from "@/api/client";
import { FormPreview } from "../../../components/FormPreview";
import type { TemplateFamilyCode } from "@/types/contracts";

const SHORT_LABELS: Record<string, string> = {
  ASSISTANT_UDC_LDC: "Assistants / UDC / LDC",
  APS_STENOTYPIST: "APS / Stenotypist",
  INSPECTOR_SI_ASI: "Inspector / SI / ASI",
  SUPERINTENDENT_AINCHARGE: "Superintendent / A.Incharge",
  CAR_DRIVERS_DESPATCH_RIDERS: "Car Drivers / Despatch Riders",
  PER_17_18_OFFICERS: "BPS 17 & 18 Officers",
};

export default function FormTemplatesPage() {
  const { data } = useQuery({
    queryKey: ["templates"],
    queryFn: getTemplates,
  });
  const [activeFamily, setActiveFamily] = useState<string | null>(null);

  const activeTemplate = data?.items.find((item) => item.family === (activeFamily ?? data.items[0]?.family));

  return (
    <div className="mx-auto max-w-screen-xl space-y-5 p-6">
      <h1 className="text-lg font-bold text-[var(--fia-gray-900)]">Form Templates</h1>

      <div className="flex flex-wrap gap-1.5">
        {data?.items.map((template) => {
          const isActive = template.family === (activeFamily ?? data.items[0]?.family);
          return (
            <button
              key={template.id}
              onClick={() => setActiveFamily(template.family)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-[var(--fia-navy,#1A1C6E)] text-white shadow-md"
                  : "border border-[var(--fia-gray-200)] bg-[var(--card)] text-[var(--fia-gray-700)] hover:border-[var(--fia-cyan)] hover:text-[var(--fia-cyan)]"
              }`}
            >
              {SHORT_LABELS[template.family] ?? template.title}
            </button>
          );
        })}
      </div>

      {activeTemplate ? (
        <div className="rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--card)] shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--fia-gray-200)] px-5 py-3">
            <div>
              <p className="text-sm font-bold text-[var(--fia-gray-900)]">{SHORT_LABELS[activeTemplate.family] ?? activeTemplate.title}</p>
              <p className="mt-0.5 text-[11px] text-[var(--fia-gray-500)]">
                {activeTemplate.code} · v{activeTemplate.version} · {activeTemplate.pageCount} pages
              </p>
            </div>
          </div>
          <div className="overflow-auto rounded-b-2xl bg-[var(--fia-gray-50)] p-4">
            <div className="origin-top scale-[0.7]">
              <FormPreview templateFamily={activeTemplate.family as TemplateFamilyCode} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
