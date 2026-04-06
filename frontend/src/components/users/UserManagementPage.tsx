"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  KeyRound,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCog,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  createManagedUser,
  deactivateManagedUser,
  getManagedUserDetail,
  getManagedUsers,
  getUserManagementOptions,
  reactivateManagedUser,
  resetManagedUserPassword,
  updateManagedUser,
} from "@/api/client";
import { EmptyState, PortalPageHeader, PortalSurface, SegmentedTabs } from "@/components/portal/PortalPrimitives";
import { FloatingToast } from "@/components/ui";
import type {
  CreateManagedUserPayload,
  ManagedUserSummary,
  ManagedUserStatus,
  UpdateManagedUserPayload,
  UserRoleCode,
} from "@/types/contracts";

type DrawerMode = "create" | "edit" | "view";

type UserCreationFlash = {
  userId: string;
  fullName: string;
  username: string;
  temporaryPassword: string;
};

type UserFormState = {
  fullName: string;
  username: string;
  email: string;
  badgeNo: string;
  mobileNumber: string;
  departmentName: string;
  roles: UserRoleCode[];
  wingId: string;
  zoneId: string;
  officeId: string;
  temporaryPassword: string;
  isActive: boolean;
  mustChangePassword: boolean;
};

const DEFAULT_FORM: UserFormState = {
  fullName: "",
  username: "",
  email: "",
  badgeNo: "",
  mobileNumber: "",
  departmentName: "",
  roles: [],
  wingId: "",
  zoneId: "",
  officeId: "",
  temporaryPassword: "",
  isActive: true,
  mustChangePassword: true,
};

function humanDate(value?: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString("en-PK", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function passwordSuggestion() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#";
  return Array.from({ length: 12 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function statusTone(status: ManagedUserStatus) {
  return status === "active" ? "bg-[#ECFDF5] text-[#15803D]" : "bg-[#FFF1F2] text-[#BE123C]";
}

function fieldClassName(invalid = false) {
  return `w-full rounded-2xl border px-4 py-2.5 text-sm text-[#111827] outline-none transition ${
    invalid
      ? "border-[#FCA5A5] bg-[#FFF5F5] focus:border-[#DC2626] focus:ring-4 focus:ring-[#FCA5A5]/20"
      : "border-[#D8DEE8] bg-white focus:border-[#0095D9] focus:ring-4 focus:ring-[#0095D9]/10"
  }`;
}

export function UserManagementPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"" | UserRoleCode>("");
  const [status, setStatus] = useState<"all" | ManagedUserStatus>("all");
  const [wingId, setWingId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [page, setPage] = useState(1);
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState(passwordSuggestion());
  const [resetMustChangePassword, setResetMustChangePassword] = useState(true);
  const [toast, setToast] = useState<{ title: string; message?: string; tone?: "success" | "info" | "warning" | "danger" } | null>(null);
  const [createdUserFlash, setCreatedUserFlash] = useState<UserCreationFlash | null>(null);

  const optionsQuery = useQuery({
    queryKey: ["user-management", "options"],
    queryFn: getUserManagementOptions,
    staleTime: 60_000,
  });

  const usersQuery = useQuery({
    queryKey: ["user-management", "list", { query, role, status, wingId, zoneId, officeId, page }],
    queryFn: () =>
      getManagedUsers({
        page,
        query: query.trim() || undefined,
        role: role || undefined,
        status: status === "all" ? undefined : status,
        wingId: wingId || undefined,
        zoneId: zoneId || undefined,
        officeId: officeId || undefined,
      }),
  });

  const detailQuery = useQuery({
    queryKey: ["user-management", "detail", selectedUserId],
    queryFn: () => getManagedUserDetail(selectedUserId ?? ""),
    enabled: Boolean(selectedUserId && drawerMode !== "create"),
  });

  const filteredZones = useMemo(() => {
    if (!optionsQuery.data) return [];
    return wingId ? optionsQuery.data.zones.filter((zone) => zone.wingId === wingId) : optionsQuery.data.zones;
  }, [optionsQuery.data, wingId]);

  const filteredOffices = useMemo(() => {
    if (!optionsQuery.data) return [];
    return optionsQuery.data.offices.filter((office) => {
      if (zoneId) return office.zoneId === zoneId;
      if (wingId) return office.wingId === wingId;
      return true;
    });
  }, [optionsQuery.data, wingId, zoneId]);

  useEffect(() => {
    setPage(1);
  }, [query, role, status, wingId, zoneId, officeId]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!detailQuery.data || drawerMode === "create") {
      return;
    }

    const detail = detailQuery.data;
    setForm({
      fullName: detail.fullName,
      username: detail.username,
      email: detail.email,
      badgeNo: detail.badgeNo,
      mobileNumber: detail.mobileNumber ?? "",
      departmentName: detail.scope.departmentName ?? "",
      roles: detail.roles,
      wingId: detail.scope.wingId ?? "",
      zoneId: detail.scope.zoneId ?? "",
      officeId: detail.scope.officeId ?? "",
      temporaryPassword: "",
      isActive: detail.isActive,
      mustChangePassword: detail.mustChangePassword,
    });
    setResetPassword(passwordSuggestion());
    setResetMustChangePassword(true);
    setFormError(null);
  }, [detailQuery.data, drawerMode]);

  function closeDrawer() {
    setDrawerMode(null);
    setSelectedUserId(null);
    setForm(DEFAULT_FORM);
    setResetPassword(passwordSuggestion());
    setFormError(null);
    setCreatedUserFlash(null);
  }

  function openCreate() {
    setForm({ ...DEFAULT_FORM, temporaryPassword: passwordSuggestion() });
    setSelectedUserId(null);
    setDrawerMode("create");
    setFormError(null);
    setCreatedUserFlash(null);
  }

  function openDetail(userId: string, mode: DrawerMode) {
    setSelectedUserId(userId);
    setDrawerMode(mode);
    setFormError(null);
    setCreatedUserFlash((current) => current?.userId === userId ? current : null);
  }

  function toggleRole(nextRole: UserRoleCode) {
    setForm((current) => ({
      ...current,
      roles: current.roles.includes(nextRole)
        ? current.roles.filter((roleCode) => roleCode !== nextRole)
        : [...current.roles, nextRole],
    }));
  }

  function validateForm(mode: DrawerMode) {
    if (!form.fullName.trim() || !form.username.trim() || !form.email.trim() || !form.badgeNo.trim()) {
      return "Full name, username, email, and badge number are required.";
    }
    if (form.roles.length === 0) {
      return "Assign at least one role to the account.";
    }
    if (mode === "create" && form.temporaryPassword.trim().length < 8) {
      return "The temporary password must be at least 8 characters.";
    }
    return null;
  }

  function handleCreateSuccess(created: ManagedUserSummary, temporaryPassword: string) {
    setPage(1);
    setSelectedUserId(created.id);
    setDrawerMode("view");
    setCreatedUserFlash({
      userId: created.id,
      fullName: created.fullName,
      username: created.username,
      temporaryPassword,
    });
    setToast({
      title: "User created successfully",
      message: `${created.fullName} (${created.username}) is now available in the managed user directory.`,
      tone: "success",
    });
    setFormError(null);
    setResetPassword(passwordSuggestion());
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateManagedUserPayload) => createManagedUser(payload),
    onSuccess: async (created, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["user-management"] });
      handleCreateSuccess(created, variables.temporaryPassword);
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : "User creation failed."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateManagedUserPayload }) => updateManagedUser(id, payload),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["user-management"] });
      setSelectedUserId(updated.id);
      setDrawerMode("view");
      setCreatedUserFlash(null);
      setToast({
        title: "User updated successfully",
        message: `${updated.fullName} has been updated and the directory has been refreshed.`,
        tone: "success",
      });
      setFormError(null);
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : "User update failed."),
  });

  const resetMutation = useMutation({
    mutationFn: ({ id, nextPassword, mustChangePassword }: { id: string; nextPassword: string; mustChangePassword: boolean }) =>
      resetManagedUserPassword(id, { nextPassword, mustChangePassword }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["user-management"] });
      setResetPassword(passwordSuggestion());
      setToast({
        title: "Password reset completed",
        message: "The new temporary password is ready and the user will be prompted to change it at sign-in if selected.",
        tone: "success",
      });
      setFormError(null);
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : "Password reset failed."),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => (active ? reactivateManagedUser(id) : deactivateManagedUser(id)),
    onSuccess: async (updated) => {
      await queryClient.invalidateQueries({ queryKey: ["user-management"] });
      if (selectedUserId === updated.id) {
        setSelectedUserId(updated.id);
      }
      setToast({
        title: updated.isActive ? "User reactivated" : "User deactivated",
        message: `${updated.fullName} is now ${updated.isActive ? "active" : "inactive"} in the directory.`,
        tone: updated.isActive ? "success" : "warning",
      });
    },
  });

  function handleCreateOrUpdate() {
    if (!drawerMode) return;
    const validation = validateForm(drawerMode);
    if (validation) {
      setFormError(validation);
      return;
    }

    if (drawerMode === "create") {
      createMutation.mutate({
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        badgeNo: form.badgeNo.trim(),
        mobileNumber: form.mobileNumber.trim() || undefined,
        temporaryPassword: form.temporaryPassword,
        roles: form.roles,
        isActive: form.isActive,
        mustChangePassword: form.mustChangePassword,
        scope: {
          wingId: form.wingId || undefined,
          zoneId: form.zoneId || undefined,
          officeId: form.officeId || undefined,
          departmentName: form.departmentName.trim() || undefined,
        },
      });
      return;
    }

    if (!selectedUserId) return;
    updateMutation.mutate({
      id: selectedUserId,
      payload: {
        fullName: form.fullName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        badgeNo: form.badgeNo.trim(),
        mobileNumber: form.mobileNumber.trim() || undefined,
        roles: form.roles,
        isActive: form.isActive,
        mustChangePassword: form.mustChangePassword,
        scope: {
          wingId: form.wingId || undefined,
          zoneId: form.zoneId || undefined,
          officeId: form.officeId || undefined,
          departmentName: form.departmentName.trim() || undefined,
        },
      },
    });
  }

  const stats = useMemo(() => {
    const items = usersQuery.data?.items ?? [];
    return {
      active: items.filter((item) => item.isActive).length,
      inactive: items.filter((item) => !item.isActive).length,
      mustChange: items.filter((item) => item.mustChangePassword).length,
    };
  }, [usersQuery.data?.items]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-5 px-5 py-5">
      <FloatingToast
        visible={Boolean(toast)}
        title={toast?.title ?? ""}
        message={toast?.message}
        tone={toast?.tone}
      />
      <PortalPageHeader
        eyebrow="Administration"
        title="User Management"
        description="Provision internal users, assign roles and scope, and maintain password and lifecycle controls from one admin workspace."
        actions={
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--fia-navy)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--fia-navy-500)]"
          >
            <Plus size={16} />
            Create User
          </button>
        }
      />

      <div className="grid gap-3 md:grid-cols-3">
        <PortalSurface>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">Active Accounts</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--fia-gray-950)]">{stats.active}</p>
        </PortalSurface>
        <PortalSurface>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">Inactive Accounts</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--fia-gray-950)]">{stats.inactive}</p>
        </PortalSurface>
        <PortalSurface>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">Password Change Required</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--fia-gray-950)]">{stats.mustChange}</p>
        </PortalSurface>
      </div>

      <PortalSurface title="User Directory" subtitle="Search by identity, role, or organizational scope.">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,180px))]">
          <label className="relative block">
            <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, username, email, or badge number"
              className="w-full rounded-2xl border border-[#D8DEE8] bg-[#F8FAFC] py-2.5 pl-10 pr-4 text-sm text-[#111827] outline-none transition focus:border-[#0095D9] focus:bg-white focus:ring-4 focus:ring-[#0095D9]/10"
            />
          </label>
          <select value={role} onChange={(event) => setRole(event.target.value as UserRoleCode | "")} className={fieldClassName()}>
            <option value="">All roles</option>
            {(optionsQuery.data?.roles ?? []).map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.label}
              </option>
            ))}
          </select>
          <select
            value={wingId}
            onChange={(event) => {
              setWingId(event.target.value);
              setZoneId("");
              setOfficeId("");
            }}
            className={fieldClassName()}
          >
            <option value="">All wings</option>
            {(optionsQuery.data?.wings ?? []).map((wing) => (
              <option key={wing.id} value={wing.id}>
                {wing.name}
              </option>
            ))}
          </select>
          <select
            value={zoneId}
            onChange={(event) => {
              setZoneId(event.target.value);
              setOfficeId("");
            }}
            className={fieldClassName()}
          >
            <option value="">All zones</option>
            {filteredZones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
          <select value={officeId} onChange={(event) => setOfficeId(event.target.value)} className={fieldClassName()}>
            <option value="">All offices</option>
            {filteredOffices.map((office) => (
              <option key={office.id} value={office.id}>
                {office.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <SegmentedTabs
            value={status}
            onChange={(next) => setStatus(next as "all" | ManagedUserStatus)}
            tabs={[
              { key: "all", label: "All accounts", count: usersQuery.data?.total ?? 0 },
              { key: "active", label: "Active", count: stats.active },
              { key: "inactive", label: "Inactive", count: stats.inactive },
            ]}
          />
          <p className="text-sm text-[var(--fia-gray-500)]">
            {usersQuery.isFetching ? "Refreshing user directory..." : `Showing ${usersQuery.data?.items.length ?? 0} of ${usersQuery.data?.total ?? 0} accounts`}
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F8FAFD] text-left text-[11px] uppercase tracking-[0.16em] text-[#64748B]">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Roles</th>
                <th className="px-4 py-3 font-semibold">Scope</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Lifecycle</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading ? (
                [...Array(8)].map((_, index) => (
                  <tr key={index} className="border-t border-[#EEF2F7]">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-14 animate-pulse rounded-2xl bg-[#F8FAFC]" />
                    </td>
                  </tr>
                ))
              ) : usersQuery.data?.items.length ? (
                usersQuery.data.items.map((user) => (
                  <tr key={user.id} className="border-t border-[#EEF2F7] transition hover:bg-[#FBFCFE]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[#111827]">{user.fullName}</p>
                      <p className="mt-1 text-xs text-[#64748B]">
                        {user.username} <span className="text-[#CBD5E1]">·</span> {user.email}
                      </p>
                      <p className="mt-1 text-xs text-[#94A3B8]">{user.badgeNo}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {user.roleLabels.map((label) => (
                          <span key={label} className="inline-flex rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[11px] font-semibold text-[#4338CA]">
                            {label}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#475569]">
                      <p>{user.scope.officeName ?? user.scope.zoneName ?? user.scope.wingName ?? "FIA"}</p>
                      {user.scope.departmentName ? <p className="mt-1 text-xs text-[#94A3B8]">{user.scope.departmentName}</p> : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusTone(user.status)}`}>
                          {user.status}
                        </span>
                        {user.mustChangePassword ? (
                          <span className="inline-flex rounded-full bg-[#FFF7ED] px-2.5 py-1 text-[11px] font-semibold text-[#C2410C]">
                            Password update required
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#475569]">
                      <div className="space-y-1 text-xs leading-5">
                        <p>
                          <span className="font-semibold text-[#334155]">Created:</span> {humanDate(user.createdAt)}
                        </p>
                        <p>
                          <span className="font-semibold text-[#334155]">Updated:</span> {humanDate(user.updatedAt)}
                        </p>
                        <p>
                          <span className="font-semibold text-[#334155]">Last login:</span> {humanDate(user.lastLoginAt)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => openDetail(user.id, "view")} className="rounded-full border border-[#D8DEE8] px-3 py-1.5 text-xs font-semibold text-[#334155] transition hover:bg-[#F8FAFC]">
                          View
                        </button>
                        <button type="button" onClick={() => openDetail(user.id, "edit")} className="inline-flex items-center gap-1 rounded-full border border-[#D8DEE8] px-3 py-1.5 text-xs font-semibold text-[#334155] transition hover:bg-[#F8FAFC]">
                          <Pencil size={12} />
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-6">
                    <EmptyState
                      title="No user accounts match the current filters"
                      description="Change the filters or create a new internal account from this panel."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--fia-gray-500)]">
            Page {usersQuery.data?.page ?? 1} of {usersQuery.data?.totalPages ?? 1}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={(usersQuery.data?.page ?? 1) <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="rounded-full border border-[#D8DEE8] px-3.5 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={(usersQuery.data?.page ?? 1) >= (usersQuery.data?.totalPages ?? 1)}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-full border border-[#D8DEE8] px-3.5 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </PortalSurface>

      {drawerMode ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#0F172A]/28 backdrop-blur-[2px]">
          <button type="button" className="flex-1 cursor-default" onClick={closeDrawer} />
          <aside className="flex h-full w-full max-w-[620px] flex-col border-l border-[#E2E8F0] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
              <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] px-5 py-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Account Provisioning</p>
                  <h2 className="mt-1 text-xl font-semibold text-[#111827]">
                    {drawerMode === "create" ? "Create User" : drawerMode === "edit" ? "Edit User" : "User Details"}
                  </h2>
                </div>
                <button type="button" onClick={closeDrawer} className="rounded-full border border-[#E2E8F0] p-2 text-[#64748B] transition hover:bg-[#F8FAFC]">
                  <X size={16} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {formError ? <div className="mb-4 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">{formError}</div> : null}
                {createdUserFlash && createdUserFlash.userId === selectedUserId ? (
                  <div className="mb-4 rounded-[20px] border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#166534]">User account created successfully</p>
                        <p className="mt-1 text-sm leading-6 text-[#15803D]">
                          {createdUserFlash.fullName} is provisioned. Temporary sign-in password: <span className="font-semibold">{createdUserFlash.temporaryPassword}</span>
                        </p>
                        <p className="mt-2 text-xs leading-5 text-[#15803D]">
                          Username: {createdUserFlash.username}. Share this password securely and require the user to change it on first login.
                        </p>
                      </div>
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#16A34A]" />
                    </div>
                  </div>
                ) : null}
                {detailQuery.isLoading && drawerMode !== "create" ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, index) => (
                      <div key={index} className="h-16 animate-pulse rounded-2xl bg-[#F8FAFC]" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-5">
                    <PortalSurface title="Identity" className="shadow-none">
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Full Name</span><input value={form.fullName} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} className={fieldClassName(!form.fullName.trim() && drawerMode !== "view")} /></label>
                        <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Badge Number</span><input value={form.badgeNo} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, badgeNo: event.target.value }))} className={fieldClassName(!form.badgeNo.trim() && drawerMode !== "view")} /></label>
                        <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Username</span><input value={form.username} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} className={fieldClassName(!form.username.trim() && drawerMode !== "view")} /></label>
                        <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Email</span><input type="email" value={form.email} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className={fieldClassName(!form.email.trim() && drawerMode !== "view")} /></label>
                        <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Mobile</span><input value={form.mobileNumber} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, mobileNumber: event.target.value }))} className={fieldClassName()} /></label>
                        <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Department / Branch</span><input value={form.departmentName} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, departmentName: event.target.value }))} className={fieldClassName()} /></label>
                      </div>
                    </PortalSurface>

                    <PortalSurface title="Role & Scope" className="shadow-none">
                      <div className="grid gap-4 md:grid-cols-3">
                        <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Wing</span><select value={form.wingId} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, wingId: event.target.value, zoneId: "", officeId: "" }))} className={fieldClassName()}><option value="">Unassigned</option>{(optionsQuery.data?.wings ?? []).map((wing) => <option key={wing.id} value={wing.id}>{wing.name}</option>)}</select></label>
                        <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Zone</span><select value={form.zoneId} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, zoneId: event.target.value, officeId: "" }))} className={fieldClassName()}><option value="">Unassigned</option>{(form.wingId ? filteredZones : optionsQuery.data?.zones ?? []).map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>
                        <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Office</span><select value={form.officeId} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, officeId: event.target.value }))} className={fieldClassName()}><option value="">Unassigned</option>{(form.zoneId || form.wingId ? filteredOffices : optionsQuery.data?.offices ?? []).map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}</select></label>
                      </div>
                      <div className="mt-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Assigned Roles</p>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {(optionsQuery.data?.roles ?? []).map((entry) => {
                            const checked = form.roles.includes(entry.code);
                            return (
                              <button
                                key={entry.code}
                                type="button"
                                disabled={drawerMode === "view"}
                                onClick={() => toggleRole(entry.code)}
                                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${checked ? "border-[#C7D2FE] bg-[#EEF2FF] text-[#312E81]" : "border-[#E2E8F0] bg-white text-[#334155] hover:bg-[#F8FAFC]"} ${drawerMode === "view" ? "cursor-default" : ""}`}
                              >
                                <span className="text-sm font-medium">{entry.label}</span>
                                {checked ? <CheckCircle2 size={16} /> : <div className="h-4 w-4 rounded-full border border-[#CBD5E1]" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </PortalSurface>

                    <PortalSurface title={drawerMode === "create" ? "Provisioning" : "Account Controls"} className="shadow-none">
                      {drawerMode === "create" ? (
                        <div className="space-y-4">
                          <label className="block space-y-2">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Temporary Password</span>
                            <div className="flex gap-2">
                              <input value={form.temporaryPassword} onChange={(event) => setForm((current) => ({ ...current, temporaryPassword: event.target.value }))} className={fieldClassName(!form.temporaryPassword.trim())} />
                              <button type="button" onClick={() => setForm((current) => ({ ...current, temporaryPassword: passwordSuggestion() }))} className="rounded-2xl border border-[#D8DEE8] px-3 py-2 text-sm font-semibold text-[#334155] transition hover:bg-[#F8FAFC]">Generate</button>
                            </div>
                          </label>
                          <label className="flex items-center gap-3 text-sm text-[#334155]"><input type="checkbox" checked={form.mustChangePassword} onChange={(event) => setForm((current) => ({ ...current, mustChangePassword: event.target.checked }))} className="h-4 w-4 rounded border-[#CBD5E1]" />Force password change on first login</label>
                          <label className="flex items-center gap-3 text-sm text-[#334155]"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 rounded border-[#CBD5E1]" />Account starts as active</label>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <label className="flex items-center gap-3 text-sm text-[#334155]"><input type="checkbox" checked={form.mustChangePassword} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, mustChangePassword: event.target.checked }))} className="h-4 w-4 rounded border-[#CBD5E1]" />Require password update at next sign-in</label>
                          <label className="flex items-center gap-3 text-sm text-[#334155]"><input type="checkbox" checked={form.isActive} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 rounded border-[#CBD5E1]" />Account is active</label>
                          {drawerMode !== "view" && selectedUserId ? (
                            <div className="rounded-[20px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-[#111827]">Administrative Password Reset</p>
                                  <p className="mt-1 text-xs leading-5 text-[#64748B]">Set a new temporary password and require the user to update it after login.</p>
                                </div>
                                <KeyRound size={18} className="text-[#475569]" />
                              </div>
                              <div className="mt-3 flex gap-2">
                                <input value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} className={fieldClassName(resetPassword.trim().length < 8)} />
                                <button type="button" onClick={() => setResetPassword(passwordSuggestion())} className="rounded-2xl border border-[#D8DEE8] px-3 py-2 text-sm font-semibold text-[#334155] transition hover:bg-white">Generate</button>
                              </div>
                              <label className="mt-3 flex items-center gap-3 text-sm text-[#334155]"><input type="checkbox" checked={resetMustChangePassword} onChange={(event) => setResetMustChangePassword(event.target.checked)} className="h-4 w-4 rounded border-[#CBD5E1]" />Require password change immediately after admin reset</label>
                              <button type="button" onClick={() => selectedUserId && resetMutation.mutate({ id: selectedUserId, nextPassword: resetPassword, mustChangePassword: resetMustChangePassword })} disabled={resetMutation.isPending || resetPassword.trim().length < 8} className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-[#D8DEE8] bg-white px-4 py-2.5 text-sm font-semibold text-[#334155] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw size={15} />{resetMutation.isPending ? "Resetting..." : "Reset Password"}</button>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </PortalSurface>

                    {drawerMode !== "create" && detailQuery.data ? (
                      <PortalSurface title="Lifecycle" className="shadow-none">
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="rounded-2xl border border-[#E2E8F0] bg-[#FBFCFE] px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Created</p>
                            <p className="mt-2 text-sm font-semibold text-[#111827]">{humanDate(detailQuery.data.createdAt)}</p>
                          </div>
                          <div className="rounded-2xl border border-[#E2E8F0] bg-[#FBFCFE] px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Last Updated</p>
                            <p className="mt-2 text-sm font-semibold text-[#111827]">{humanDate(detailQuery.data.updatedAt)}</p>
                          </div>
                          <div className="rounded-2xl border border-[#E2E8F0] bg-[#FBFCFE] px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#64748B]">Last Login</p>
                            <p className="mt-2 text-sm font-semibold text-[#111827]">{humanDate(detailQuery.data.lastLoginAt)}</p>
                          </div>
                        </div>
                      </PortalSurface>
                    ) : null}

                    {drawerMode !== "create" && detailQuery.data ? (
                      <PortalSurface title="Recent Audit Activity" className="shadow-none">
                        <div className="space-y-3">
                          {detailQuery.data.recentAudit.length ? detailQuery.data.recentAudit.map((entry) => (
                            <div key={entry.id} className="rounded-2xl border border-[#E2E8F0] bg-[#FBFCFE] px-4 py-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-[#111827]">{entry.action}</p>
                                  <p className="mt-1 text-xs text-[#64748B]">{entry.actorName} · {entry.actorRole}</p>
                                </div>
                                <span className="text-xs text-[#94A3B8]">{humanDate(entry.createdAt)}</span>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-[#475569]">{entry.details}</p>
                            </div>
                          )) : <p className="text-sm text-[#64748B]">No recent audit activity is linked to this account yet.</p>}
                        </div>
                      </PortalSurface>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="border-t border-[#E2E8F0] px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex gap-2">
                    {drawerMode !== "create" && selectedUserId ? (
                      <button type="button" onClick={() => toggleStatusMutation.mutate({ id: selectedUserId, active: !form.isActive })} disabled={toggleStatusMutation.isPending} className="inline-flex items-center gap-2 rounded-2xl border border-[#D8DEE8] px-4 py-2.5 text-sm font-semibold text-[#334155] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-50">
                        {form.isActive ? <UserMinus size={15} /> : <UserPlus size={15} />}
                        {form.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={closeDrawer} className="rounded-2xl border border-[#D8DEE8] px-4 py-2.5 text-sm font-semibold text-[#334155] transition hover:bg-[#F8FAFC]">Close</button>
                    {drawerMode !== "view" ? (
                      <button type="button" onClick={handleCreateOrUpdate} disabled={createMutation.isPending || updateMutation.isPending} className="inline-flex items-center gap-2 rounded-2xl bg-[var(--fia-navy)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--fia-navy-500)] disabled:cursor-not-allowed disabled:opacity-70">
                        {drawerMode === "create" ? <UserCog size={15} /> : <ShieldCheck size={15} />}
                        {createMutation.isPending || updateMutation.isPending ? drawerMode === "create" ? "Creating..." : "Saving..." : drawerMode === "create" ? "Create User" : "Save Changes"}
                      </button>
                    ) : detailQuery.data ? (
                      <button type="button" onClick={() => setDrawerMode("edit")} className="inline-flex items-center gap-2 rounded-2xl bg-[var(--fia-navy)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--fia-navy-500)]">
                        <Pencil size={15} />
                        Edit User
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
