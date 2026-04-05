"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getTemplates } from "@/api/client";
import { FormPreview } from "../../../components/FormPreview";

export default function FormTemplatesPage() {
  const { data } = useQuery({
    queryKey: ["templates"],
    queryFn: getTemplates,
  });
  const [activeFamily, setActiveFamily] = useState<string | null>(null);

  const activeTemplate = data?.items.find((item) => item.family === (activeFamily ?? data.items[0]?.family));

  return (
    <div className="mx-auto max-w-screen-xl space-y-5 p-6">
      <div>
        <h1 className="text-xl font-bold text-[#111827]">Approved Form Templates</h1>
        <p className="mt-0.5 text-sm text-gray-500">Digital reference views for the approved FIA ACR/PER template families.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {data?.items.map((template) => (
          <button
            key={template.id}
            onClick={() => setActiveFamily(template.family)}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              template.family === (activeFamily ?? data.items[0]?.family)
                ? "bg-[#1A1C6E] text-white"
                : "bg-white text-[#1A1C6E] shadow-sm"
            }`}
          >
            {template.title}
          </button>
        ))}
      </div>

      {activeTemplate ? (
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <p className="text-sm font-semibold text-[#111827]">{activeTemplate.title}</p>
            <p className="mt-1 text-xs text-gray-500">
              {activeTemplate.code} · Version {activeTemplate.version} · {activeTemplate.pageCount} pages
            </p>
          </div>
          <div className="overflow-auto rounded-xl bg-gray-100 p-6">
            <div className="origin-top scale-[0.7]">
              <FormPreview templateFamily={activeTemplate.family} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
