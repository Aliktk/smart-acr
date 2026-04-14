"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { getEmployeeProfile, updateEmployeePortalProfile } from "@/api/client";
import { PortalPageHeader, PortalSurface } from "@/components/portal/PortalPrimitives";

function fieldClassName() {
  return "w-full rounded-2xl border border-[#D8DEE8] dark:border-slate-700 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-[#0095D9]";
}

export function EmployeeProfilePage() {
  const profileQuery = useQuery({
    queryKey: ["employee-profile"],
    queryFn: getEmployeeProfile,
  });
  const [form, setForm] = useState({
    mobile: "",
    email: "",
    posting: "",
    address: "",
  });

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }

    setForm(profileQuery.data.editableFields);
  }, [profileQuery.data]);

  const mutation = useMutation({
    mutationFn: updateEmployeePortalProfile,
    onSuccess: (updated) => {
      setForm(updated.editableFields);
    },
  });
  const formUnchanged = useMemo(() => {
    if (!profileQuery.data) {
      return true;
    }

    return JSON.stringify(form) === JSON.stringify(profileQuery.data.editableFields);
  }, [form, profileQuery.data]);

  if (profileQuery.isLoading) {
    return <div className="p-6 text-sm text-[var(--fia-gray-500)]">Loading employee profile...</div>;
  }

  const profile = profileQuery.data;

  if (!profile) {
    return <div className="p-6 text-sm text-[var(--fia-danger)]">Employee profile could not be loaded.</div>;
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-6 py-8">
      <PortalPageHeader
        eyebrow="Employee profile"
        title="My Profile"
        description="Update the metadata fields allowed in the employee portal. Confidential ACR content remains hidden."
      />

      <PortalSurface title="Employee summary" subtitle="Reference data linked to your current employee profile.">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Name", value: profile.name },
            { label: "Service Number", value: profile.serviceNumber ?? "Not assigned" },
            { label: "Rank", value: profile.rank },
            { label: "Designation", value: profile.designation ?? "Not recorded" },
            { label: "Position Title", value: profile.positionTitle ?? "Not recorded" },
            { label: "BPS", value: `BPS-${profile.bps}` },
            { label: "Wing", value: profile.wing ?? "Not assigned" },
            { label: "Region", value: profile.region ?? "Not assigned" },
            { label: "Zone", value: profile.zone ?? "Not assigned" },
            { label: "Office", value: profile.office ?? "Not assigned" },
            { label: "Reporting Officer", value: profile.readOnlyFields.reportingOfficer ?? "Not assigned" },
            { label: "Countersigning Officer", value: profile.readOnlyFields.countersigningOfficer ?? "Not assigned" },
            { label: "Template Family", value: profile.templateFamily },
          ].map((item) => (
            <div key={item.label} className="rounded-2xl border border-[#E2E8F0] bg-[#FBFCFE] px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">{item.label}</p>
              <p className="mt-2 text-sm font-medium text-[#111827] dark:text-slate-100">{item.value}</p>
            </div>
          ))}
        </div>
      </PortalSurface>

      <PortalSurface
        title="Editable metadata"
        subtitle="These values are reused during future ACR initiation."
        action={(
          <button
            type="button"
            disabled={mutation.isPending || formUnchanged}
            onClick={() => mutation.mutate(form)}
            className="rounded-2xl bg-[var(--fia-navy)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mutation.isPending ? "Saving..." : "Save profile changes"}
          </button>
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Mobile</span>
            <input value={form.mobile} onChange={(event) => setForm((current) => ({ ...current, mobile: event.target.value }))} className={fieldClassName()} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Email</span>
            <input value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className={fieldClassName()} />
          </label>
          <label className="space-y-2 text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Posting</span>
            <input value={form.posting} onChange={(event) => setForm((current) => ({ ...current, posting: event.target.value }))} className={fieldClassName()} />
          </label>
          <label className="space-y-2 text-sm md:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Address</span>
            <textarea value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} rows={4} className={fieldClassName()} />
          </label>
        </div>
        <p className="mt-4 text-sm text-[var(--fia-gray-500)]">
          Office, wing, zone, and officer assignments are kept read-only in the employee portal and continue to be managed through official organizational controls.
        </p>
        {mutation.isError ? <p className="mt-4 text-sm text-[var(--fia-danger)]">{mutation.error.message}</p> : null}
        {mutation.isSuccess ? <p className="mt-4 text-sm text-[var(--fia-success)]">Employee metadata updated successfully.</p> : null}
      </PortalSurface>
    </div>
  );
}
