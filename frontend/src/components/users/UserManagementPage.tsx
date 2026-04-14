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
import { useShell } from "@/hooks/useShell";
import type {
  CreateManagedUserPayload,
  ManagedUserSummary,
  ManagedUserStatus,
  OrgScopeTrack,
  SecretBranchDeskCode,
  UpdateManagedUserPayload,
  UserRoleCode,
} from "@/types/contracts";
import { canManageUserAccounts } from "@/utils/portal-access";

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
  cnic: string;
  positionTitle: string;
  scopeTrack: OrgScopeTrack;
  departmentName: string;
  departmentId: string;
  roles: UserRoleCode[];
  wingId: string;
  directorateId: string;
  regionId: string;
  zoneId: string;
  circleId: string;
  stationId: string;
  branchId: string;
  cellId: string;
  officeId: string;
  secretBranchDeskCode: SecretBranchDeskCode | "";
  secretBranchCanManageUsers: boolean;
  secretBranchCanVerify: boolean;
  secretBranchIsActive: boolean;
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
  cnic: "",
  positionTitle: "",
  scopeTrack: "WING",
  departmentName: "",
  departmentId: "",
  roles: [],
  wingId: "",
  directorateId: "",
  regionId: "",
  zoneId: "",
  circleId: "",
  stationId: "",
  branchId: "",
  cellId: "",
  officeId: "",
  secretBranchDeskCode: "",
  secretBranchCanManageUsers: false,
  secretBranchCanVerify: false,
  secretBranchIsActive: true,
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

function formatCnicInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

function statusTone(status: ManagedUserStatus) {
  return status === "active" ? "bg-[#ECFDF5] text-[#15803D]" : "bg-[#FFF1F2] text-[#BE123C]";
}

function filterClassName() {
  return "rounded-full border border-[var(--fia-border,#D8DEE8)] bg-[var(--card)] px-3 py-1.5 text-sm text-[var(--fia-gray-700)] outline-none transition hover:border-[var(--fia-gray-300)] focus:border-[var(--fia-cyan)] focus:ring-2 focus:ring-[var(--fia-cyan)]/10";
}

function fieldClassName(invalid = false) {
  return `w-full rounded-2xl border px-4 py-2.5 text-sm text-[var(--fia-gray-900)] outline-none transition ${
    invalid
      ? "border-[#FCA5A5] bg-[#FFF5F5] focus:border-[#DC2626] focus:ring-4 focus:ring-[#FCA5A5]/20"
      : "border-[var(--fia-border,#D8DEE8)] bg-[var(--card)] focus:border-[var(--fia-cyan)] focus:ring-4 focus:ring-[var(--fia-cyan)]/10"
  }`;
}

function FieldLabel({ label, required, error }: { label: string; required?: boolean; error?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">
        {label}{required ? <span className="ml-0.5 text-[#DC2626]">*</span> : null}
      </span>
      {error ? <span className="text-[10px] font-medium text-[#DC2626]">{error}</span> : null}
    </div>
  );
}

function PasswordStrengthBar({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password),
  ];
  const strength = checks.filter(Boolean).length;
  const labels = ["Very Weak", "Weak", "Fair", "Good", "Strong"];
  const colors = ["#DC2626", "#F59E0B", "#F59E0B", "#22C55E", "#16A34A"];

  if (!password) return null;

  return (
    <div className="mt-1.5 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all"
            style={{ backgroundColor: i < strength ? colors[strength - 1] : "var(--fia-gray-200)" }}
          />
        ))}
      </div>
      <p className="text-[10px] font-medium" style={{ color: colors[strength - 1] }}>
        {labels[strength - 1] ?? ""}
        {strength < 5 ? " — " + ["8+ chars", "uppercase", "lowercase", "digit", "special char"].filter((_, i) => !checks[i]).join(", ") + " needed" : ""}
      </p>
    </div>
  );
}

export function UserManagementPage() {
  const queryClient = useQueryClient();
  const { user } = useShell();
  const hasUserAdminAccess = !user || canManageUserAccounts(user);
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"" | UserRoleCode>("");
  const [status, setStatus] = useState<"all" | ManagedUserStatus>("all");
  const [scopeTrack, setScopeTrack] = useState<"" | OrgScopeTrack>("");
  const [wingId, setWingId] = useState("");
  const [regionId, setRegionId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [page, setPage] = useState(1);
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(DEFAULT_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [showFieldErrors, setShowFieldErrors] = useState(false);
  const [resetPassword, setResetPassword] = useState(passwordSuggestion());
  const [resetMustChangePassword, setResetMustChangePassword] = useState(true);
  const [toast, setToast] = useState<{ title: string; message?: string; tone?: "success" | "info" | "warning" | "danger" } | null>(null);
  const [createdUserFlash, setCreatedUserFlash] = useState<UserCreationFlash | null>(null);

  const optionsQuery = useQuery({
    queryKey: ["user-management", "options"],
    queryFn: getUserManagementOptions,
    staleTime: 60_000,
    enabled: hasUserAdminAccess,
  });

  const usersQuery = useQuery({
    queryKey: ["user-management", "list", { query, role, status, scopeTrack, wingId, regionId, zoneId, officeId, page }],
    queryFn: () =>
      getManagedUsers({
        page,
        query: query.trim() || undefined,
        role: role || undefined,
        status: status === "all" ? undefined : status,
        scopeTrack: scopeTrack || undefined,
        wingId: wingId || undefined,
        regionId: regionId || undefined,
        zoneId: zoneId || undefined,
        officeId: officeId || undefined,
      }),
    enabled: hasUserAdminAccess,
  });

  const detailQuery = useQuery({
    queryKey: ["user-management", "detail", selectedUserId],
    queryFn: () => getManagedUserDetail(selectedUserId ?? ""),
    enabled: hasUserAdminAccess && Boolean(selectedUserId && drawerMode !== "create"),
  });

  const filteredZones = useMemo(() => {
    if (!optionsQuery.data) return [];
    if (form.scopeTrack === "REGIONAL") {
      return form.regionId ? optionsQuery.data.zones.filter((zone) => zone.regionId === form.regionId) : optionsQuery.data.zones;
    }
    return [];
  }, [form.regionId, form.scopeTrack, optionsQuery.data]);

  const filteredDirectorates = useMemo(() => {
    if (!optionsQuery.data) return [];
    if (form.scopeTrack !== "WING") return [];
    return form.wingId ? optionsQuery.data.directorates.filter((directorate) => directorate.wingId === form.wingId) : optionsQuery.data.directorates;
  }, [form.scopeTrack, form.wingId, optionsQuery.data]);

  const filteredRegions = useMemo(() => {
    if (!optionsQuery.data) return [];
    if (form.scopeTrack !== "REGIONAL") return [];
    return optionsQuery.data.regions;
  }, [form.scopeTrack, optionsQuery.data]);

  const filteredCircles = useMemo(() => {
    if (!optionsQuery.data) return [];
    if (form.zoneId) return optionsQuery.data.circles.filter((circle) => circle.zoneId === form.zoneId);
    return optionsQuery.data.circles;
  }, [form.zoneId, optionsQuery.data]);

  const filteredStations = useMemo(() => {
    if (!optionsQuery.data) return [];
    if (form.circleId) return optionsQuery.data.stations.filter((station) => station.circleId === form.circleId);
    if (form.zoneId) return optionsQuery.data.stations.filter((station) => station.zoneId === form.zoneId);
    return optionsQuery.data.stations;
  }, [form.circleId, form.zoneId, optionsQuery.data]);

  const filteredBranches = useMemo(() => {
    if (!optionsQuery.data) return [];
    if (form.stationId) return optionsQuery.data.branches.filter((branch) => branch.stationId === form.stationId);
    if (form.zoneId) return optionsQuery.data.branches.filter((branch) => branch.zoneId === form.zoneId);
    return optionsQuery.data.branches;
  }, [form.stationId, form.zoneId, optionsQuery.data]);

  const filteredCells = useMemo(() => {
    if (!optionsQuery.data) return [];
    if (form.branchId) return optionsQuery.data.cells.filter((cell) => cell.branchId === form.branchId);
    return optionsQuery.data.cells;
  }, [form.branchId, optionsQuery.data]);

  const filteredOffices = useMemo(() => {
    if (!optionsQuery.data) return [];
    return optionsQuery.data.offices.filter((office) => {
      if (office.scopeTrack !== form.scopeTrack) return false;
      if (form.scopeTrack === "WING") {
        if (form.directorateId) return office.directorateId === form.directorateId;
        if (form.wingId) return office.wingId === form.wingId;
        return true;
      }
      if (form.cellId) return office.cellId === form.cellId;
      if (form.branchId) return office.branchId === form.branchId;
      if (form.stationId) return office.stationId === form.stationId;
      if (form.circleId) return office.circleId === form.circleId;
      if (form.zoneId) return office.zoneId === form.zoneId;
      if (form.regionId) return office.regionId === form.regionId;
      return true;
    });
  }, [form.branchId, form.cellId, form.circleId, form.directorateId, form.regionId, form.scopeTrack, form.stationId, form.wingId, form.zoneId, optionsQuery.data]);

  const filteredDepartments = useMemo(() => {
    if (!optionsQuery.data) return [];
    return form.officeId ? optionsQuery.data.departments.filter((department) => department.officeId === form.officeId) : optionsQuery.data.departments;
  }, [form.officeId, optionsQuery.data]);

  const listRegions = useMemo(() => {
    if (!optionsQuery.data) return [];
    return optionsQuery.data.regions;
  }, [optionsQuery.data]);

  const listZones = useMemo(() => {
    if (!optionsQuery.data) return [];
    return regionId ? optionsQuery.data.zones.filter((zone) => zone.regionId === regionId) : optionsQuery.data.zones;
  }, [regionId, optionsQuery.data]);

  const listOffices = useMemo(() => {
    if (!optionsQuery.data) return [];
    return optionsQuery.data.offices.filter((office) => {
      if (scopeTrack && office.scopeTrack !== scopeTrack) return false;
      if (officeId && office.id === officeId) return true;
      if (zoneId) return office.zoneId === zoneId;
      if (regionId) return office.regionId === regionId;
      if (wingId) return office.wingId === wingId;
      return true;
    });
  }, [officeId, regionId, scopeTrack, wingId, zoneId, optionsQuery.data]);

  useEffect(() => {
    setPage(1);
  }, [query, role, status, scopeTrack, wingId, regionId, zoneId, officeId]);

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
      cnic: detail.cnic ?? "",
      positionTitle: detail.positionTitle ?? "",
      scopeTrack: detail.scope.scopeTrack ?? (detail.scope.regionId ? "REGIONAL" : "WING"),
      departmentName: detail.scope.departmentName ?? "",
      departmentId: detail.scope.departmentId ?? "",
      roles: detail.roles,
      wingId: detail.scope.wingId ?? "",
      directorateId: detail.scope.directorateId ?? "",
      regionId: detail.scope.regionId ?? "",
      zoneId: detail.scope.zoneId ?? "",
      circleId: detail.scope.circleId ?? "",
      stationId: detail.scope.stationId ?? "",
      branchId: detail.scope.branchId ?? "",
      cellId: detail.scope.cellId ?? "",
      officeId: detail.scope.officeId ?? "",
      secretBranchDeskCode: detail.secretBranchProfile?.deskCode ?? "",
      secretBranchCanManageUsers: detail.secretBranchProfile?.canManageUsers ?? false,
      secretBranchCanVerify: detail.secretBranchProfile?.canVerify ?? false,
      secretBranchIsActive: detail.secretBranchProfile?.isActive ?? true,
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
    setShowFieldErrors(false);
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

  function getFieldErrors(mode: DrawerMode): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!form.fullName.trim()) errors.fullName = "Full name is required.";
    if (!form.username.trim()) errors.username = "Username is required.";
    else if (form.username.trim().length < 3) errors.username = "Username must be at least 3 characters.";
    if (!form.email.trim()) errors.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = "Enter a valid email address.";
    if (!form.badgeNo.trim()) errors.badgeNo = "Badge number is required.";
    if (form.mobileNumber.trim() && !/^03\d{2}-?\d{7}$/.test(form.mobileNumber.trim())) errors.mobileNumber = "Format: 03xx-xxxxxxx";
    if (form.cnic.trim() && !/^\d{5}-\d{7}-\d$/.test(form.cnic.trim())) errors.cnic = "Format: 12345-1234567-1";
    if (form.roles.length === 0) errors.roles = "Assign at least one role.";
    if (form.roles.includes("SECRET_BRANCH") && !form.secretBranchDeskCode) errors.secretBranchDeskCode = "Select a desk assignment for Secret Branch.";
    if (mode === "create") {
      const pw = form.temporaryPassword.trim();
      if (pw.length < 8) errors.temporaryPassword = "Password must be at least 8 characters.";
      else if (!/[A-Z]/.test(pw)) errors.temporaryPassword = "Password needs an uppercase letter.";
      else if (!/[a-z]/.test(pw)) errors.temporaryPassword = "Password needs a lowercase letter.";
      else if (!/\d/.test(pw)) errors.temporaryPassword = "Password needs a digit.";
      else if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(pw)) errors.temporaryPassword = "Password needs a special character.";
    }
    return errors;
  }

  function validateForm(mode: DrawerMode) {
    const errors = getFieldErrors(mode);
    const firstError = Object.values(errors)[0];
    return firstError ?? null;
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
    setShowFieldErrors(true);
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
        cnic: form.cnic.trim() || undefined,
        positionTitle: form.positionTitle.trim() || undefined,
        temporaryPassword: form.temporaryPassword,
        roles: form.roles,
        isActive: form.isActive,
        mustChangePassword: form.mustChangePassword,
        scope: {
          scopeTrack: form.scopeTrack,
          wingId: form.wingId || undefined,
          directorateId: form.directorateId || undefined,
          regionId: form.regionId || undefined,
          zoneId: form.zoneId || undefined,
          circleId: form.circleId || undefined,
          stationId: form.stationId || undefined,
          branchId: form.branchId || undefined,
          cellId: form.cellId || undefined,
          officeId: form.officeId || undefined,
          departmentId: form.departmentId || undefined,
          departmentName: form.departmentName.trim() || undefined,
        },
        secretBranchProfile: form.roles.includes("SECRET_BRANCH")
          ? {
              deskCode: form.secretBranchDeskCode || undefined,
              canManageUsers: form.secretBranchCanManageUsers,
              canVerify: form.secretBranchCanVerify,
              isActive: form.secretBranchIsActive,
            }
          : undefined,
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
        cnic: form.cnic.trim() || null,
        positionTitle: form.positionTitle.trim() || null,
        roles: form.roles,
        isActive: form.isActive,
        mustChangePassword: form.mustChangePassword,
        scope: {
          scopeTrack: form.scopeTrack,
          wingId: form.wingId || undefined,
          directorateId: form.directorateId || undefined,
          regionId: form.regionId || undefined,
          zoneId: form.zoneId || undefined,
          circleId: form.circleId || undefined,
          stationId: form.stationId || undefined,
          branchId: form.branchId || undefined,
          cellId: form.cellId || undefined,
          officeId: form.officeId || undefined,
          departmentId: form.departmentId || undefined,
          departmentName: form.departmentName.trim() || undefined,
        },
        secretBranchProfile: form.roles.includes("SECRET_BRANCH")
          ? {
              deskCode: form.secretBranchDeskCode || undefined,
              canManageUsers: form.secretBranchCanManageUsers,
              canVerify: form.secretBranchCanVerify,
              isActive: form.secretBranchIsActive,
            }
          : undefined,
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

  if (user && !hasUserAdminAccess) {
    return (
      <div className="mx-auto max-w-[1100px] space-y-5 px-5 py-5">
        <PortalPageHeader
          eyebrow="Administration"
          title="User Management"
          description="This workspace is reserved for Super Admin and delegated Secret Branch admin accounts."
        />
        <PortalSurface>
          <EmptyState
            title="Access is restricted"
            description="Switch to Super Admin, or use a Secret Branch profile with delegated user-management authority to provision and maintain user accounts."
          />
        </PortalSurface>
      </div>
    );
  }

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
        <label className="relative block">
          <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--fia-gray-400)]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, username, email, or badge number"
            className="w-full rounded-2xl border border-[var(--fia-border,#D8DEE8)] bg-[var(--fia-gray-50)] py-2.5 pl-10 pr-4 text-sm text-[var(--fia-gray-900)] outline-none transition placeholder:text-[var(--fia-gray-400)] focus:border-[var(--fia-cyan)] focus:bg-[var(--card)] focus:ring-4 focus:ring-[var(--fia-cyan)]/10"
          />
        </label>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--fia-gray-400)]">Filters</span>
          <select value={role} onChange={(event) => setRole(event.target.value as UserRoleCode | "")} className={filterClassName()}>
            <option value="">All roles</option>
            {(optionsQuery.data?.roles ?? []).map((entry) => (
              <option key={entry.code} value={entry.code}>{entry.label}</option>
            ))}
          </select>
          <select
            value={scopeTrack}
            onChange={(event) => {
              const nextTrack = event.target.value as "" | OrgScopeTrack;
              setScopeTrack(nextTrack);
              setWingId("");
              setRegionId("");
              setZoneId("");
              setOfficeId("");
            }}
            className={filterClassName()}
          >
            <option value="">All tracks</option>
            <option value="WING">Wing track</option>
            <option value="REGIONAL">Regional track</option>
          </select>
          <select value={wingId} onChange={(event) => { setWingId(event.target.value); setZoneId(""); setOfficeId(""); }} className={filterClassName()}>
            <option value="">All wings</option>
            {(optionsQuery.data?.wings ?? []).map((wing) => (
              <option key={wing.id} value={wing.id}>{wing.name}</option>
            ))}
          </select>
          <select value={regionId} onChange={(event) => { setRegionId(event.target.value); setZoneId(""); setOfficeId(""); }} className={filterClassName()}>
            <option value="">All regions</option>
            {listRegions.map((region) => (
              <option key={region.id} value={region.id}>{region.name}</option>
            ))}
          </select>
          <select value={zoneId} onChange={(event) => { setZoneId(event.target.value); setOfficeId(""); }} className={filterClassName()}>
            <option value="">All zones</option>
            {listZones.map((zone) => (
              <option key={zone.id} value={zone.id}>{zone.name}</option>
            ))}
          </select>
          <select value={officeId} onChange={(event) => setOfficeId(event.target.value)} className={filterClassName()}>
            <option value="">All offices</option>
            {listOffices.map((office) => (
              <option key={office.id} value={office.id}>{office.name}</option>
            ))}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value as "all" | ManagedUserStatus)} className={filterClassName()}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        <div className="mt-3 flex items-center justify-end">
          <p className="text-sm text-[var(--fia-gray-500)]">
            {usersQuery.isFetching ? "Refreshing..." : `Showing ${usersQuery.data?.items.length ?? 0} of ${usersQuery.data?.total ?? 0} accounts`}
          </p>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[var(--fia-gray-50)] text-left text-[11px] uppercase tracking-[0.16em] text-[var(--fia-gray-400)]">
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
                  <tr key={index} className="border-t border-[var(--fia-gray-200)]">
                    <td colSpan={6} className="px-4 py-3">
                      <div className="h-14 animate-pulse rounded-2xl bg-[var(--fia-gray-50)]" />
                    </td>
                  </tr>
                ))
              ) : usersQuery.data?.items.length ? (
                usersQuery.data.items.map((user) => (
                  <tr key={user.id} className="border-t border-[var(--fia-gray-200)] transition hover:bg-[var(--fia-gray-50)]">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--fia-gray-900)]">{user.fullName}</p>
                      <p className="mt-1 text-xs text-[var(--fia-gray-500)]">
                        {user.username} <span className="text-[var(--fia-gray-300)]">·</span> {user.email}
                      </p>
                      <p className="mt-1 text-xs text-[var(--fia-gray-400)]">{user.badgeNo}</p>
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
                    <td className="px-4 py-3 text-[var(--fia-gray-600)]">
                      <p>{user.scope.officeName ?? user.scope.zoneName ?? user.scope.wingName ?? "FIA"}</p>
                      {user.scope.departmentName ? <p className="mt-1 text-xs text-[var(--fia-gray-400)]">{user.scope.departmentName}</p> : null}
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
                    <td className="px-4 py-3 text-[var(--fia-gray-600)]">
                      <div className="space-y-1 text-xs leading-5">
                        <p>
                          <span className="font-semibold text-[var(--fia-gray-700)]">Created:</span> {humanDate(user.createdAt)}
                        </p>
                        <p>
                          <span className="font-semibold text-[var(--fia-gray-700)]">Updated:</span> {humanDate(user.updatedAt)}
                        </p>
                        <p>
                          <span className="font-semibold text-[var(--fia-gray-700)]">Last login:</span> {humanDate(user.lastLoginAt)}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => openDetail(user.id, "view")} className="rounded-full border border-[var(--fia-border,#D8DEE8)] px-3 py-1.5 text-xs font-semibold text-[var(--fia-gray-700)] transition hover:bg-[var(--fia-gray-50)]">
                          View
                        </button>
                        <button type="button" onClick={() => openDetail(user.id, "edit")} className="inline-flex items-center gap-1 rounded-full border border-[var(--fia-border,#D8DEE8)] px-3 py-1.5 text-xs font-semibold text-[var(--fia-gray-700)] transition hover:bg-[var(--fia-gray-50)]">
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
              className="rounded-full border border-[var(--fia-border,#D8DEE8)] px-3.5 py-2 text-sm font-semibold text-[var(--fia-gray-700)] transition hover:bg-[var(--fia-gray-50)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={(usersQuery.data?.page ?? 1) >= (usersQuery.data?.totalPages ?? 1)}
              onClick={() => setPage((current) => current + 1)}
              className="rounded-full border border-[var(--fia-border,#D8DEE8)] px-3.5 py-2 text-sm font-semibold text-[var(--fia-gray-700)] transition hover:bg-[var(--fia-gray-50)] disabled:cursor-not-allowed disabled:opacity-50"
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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Account Provisioning</p>
                  <h2 className="mt-1 text-xl font-semibold text-[var(--fia-gray-900)]">
                    {drawerMode === "create" ? "Create User" : drawerMode === "edit" ? "Edit User" : "User Details"}
                  </h2>
                </div>
                <button type="button" onClick={closeDrawer} className="rounded-full border border-[#E2E8F0] p-2 text-[var(--fia-gray-500)] transition hover:bg-[var(--fia-gray-50)]">
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
                          {createdUserFlash.fullName} is provisioned.
                        </p>
                        <div className="mt-2 flex items-center gap-2 rounded-lg border border-[#BBF7D0] bg-white px-3 py-2">
                          <div className="flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#15803D]">Temporary Password</p>
                            <p className="font-mono text-sm font-bold text-[#166534]">{createdUserFlash.temporaryPassword}</p>
                          </div>
                          <button type="button" onClick={() => navigator.clipboard.writeText(createdUserFlash!.temporaryPassword)} className="shrink-0 rounded-lg border border-[#BBF7D0] px-2 py-1 text-xs font-semibold text-[#15803D] hover:bg-[#DCFCE7]">Copy</button>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-[#15803D]">
                          Username: <span className="font-semibold">{createdUserFlash.username}</span>. Share credentials securely — user must change password on first login.
                        </p>
                      </div>
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#16A34A]" />
                    </div>
                  </div>
                ) : null}
                {detailQuery.isLoading && drawerMode !== "create" ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, index) => (
                      <div key={index} className="h-16 animate-pulse rounded-2xl bg-[var(--fia-gray-50)]" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-5">
                    <PortalSurface title="Identity" className="shadow-none">
                      {(() => { const fe = showFieldErrors && drawerMode !== "view" ? getFieldErrors(drawerMode!) : {}; return (
                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block space-y-1.5"><FieldLabel label="Full Name" required error={fe.fullName} /><input value={form.fullName} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} placeholder="Officer full name" aria-label="Full Name" className={fieldClassName(Boolean(fe.fullName))} /></label>
                        <label className="block space-y-1.5"><FieldLabel label="Badge Number" required error={fe.badgeNo} /><input value={form.badgeNo} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, badgeNo: event.target.value }))} placeholder="e.g. FIA-2024-001" aria-label="Badge Number" className={fieldClassName(Boolean(fe.badgeNo))} /></label>
                        <label className="block space-y-1.5"><FieldLabel label="Username" required error={fe.username} /><input value={form.username} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} placeholder="e.g. clerk.isb" aria-label="Username" className={fieldClassName(Boolean(fe.username))} /></label>
                        <label className="block space-y-1.5"><FieldLabel label="Email" required error={fe.email} /><input type="email" value={form.email} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="user@fia.gov.pk" aria-label="Email" className={fieldClassName(Boolean(fe.email))} /></label>
                        <label className="block space-y-1.5"><FieldLabel label="Mobile" error={fe.mobileNumber} /><input value={form.mobileNumber} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, mobileNumber: event.target.value }))} placeholder="03xx-xxxxxxx" aria-label="Mobile" className={fieldClassName(Boolean(fe.mobileNumber))} /></label>
                        <label className="block space-y-1.5"><FieldLabel label="CNIC" error={fe.cnic} /><input value={form.cnic} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, cnic: formatCnicInput(event.target.value) }))} placeholder="12345-1234567-1" maxLength={15} aria-label="CNIC" className={fieldClassName(Boolean(fe.cnic))} /></label>
                        <label className="block space-y-1.5"><FieldLabel label="Position Title" /><input value={form.positionTitle} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, positionTitle: event.target.value }))} placeholder="e.g. Deputy Director" aria-label="Position Title" className={fieldClassName()} /></label>
                        <label className="block space-y-1.5 md:col-span-2"><FieldLabel label="Department" /><input value={form.departmentName} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, departmentName: event.target.value }))} placeholder="e.g. Administration, HRM, Immigration" aria-label="Department" className={fieldClassName()} /></label>
                      </div>
                      ); })()}
                    </PortalSurface>

                    <PortalSurface title="Role & Scope" className="shadow-none">
                      <div className="grid gap-4 md:grid-cols-3">
                        <label className="block space-y-2">
                          <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Scope Track</span>
                          <select
                            value={form.scopeTrack}
                            disabled={drawerMode === "view"}
                            onChange={(event) => setForm((current) => ({
                              ...current,
                              scopeTrack: event.target.value as OrgScopeTrack,
                              wingId: "",
                              directorateId: "",
                              regionId: "",
                              zoneId: "",
                              circleId: "",
                              stationId: "",
                              branchId: "",
                              cellId: "",
                              officeId: "",
                              departmentId: "",
                            }))}
                            className={fieldClassName()}
                          >
                            <option value="WING">Wing track</option>
                            <option value="REGIONAL">Regional track</option>
                          </select>
                        </label>
                        {form.scopeTrack === "WING" ? (
                          <>
                            <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Wing</span><select value={form.wingId} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, wingId: event.target.value, directorateId: "", officeId: "", departmentId: "" }))} className={fieldClassName()}><option value="">Unassigned</option>{(optionsQuery.data?.wings ?? []).map((wing) => <option key={wing.id} value={wing.id}>{wing.name}</option>)}</select></label>
                            <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Directorate</span><select value={form.directorateId} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, directorateId: event.target.value, officeId: "", departmentId: "" }))} className={fieldClassName()}><option value="">Unassigned</option>{filteredDirectorates.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
                          </>
                        ) : (
                          <>
                            <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Region</span><select value={form.regionId} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, regionId: event.target.value, zoneId: "", circleId: "", stationId: "", branchId: "", cellId: "", officeId: "", departmentId: "" }))} className={fieldClassName()}><option value="">Unassigned</option>{filteredRegions.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
                            <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Zone</span><select value={form.zoneId} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, zoneId: event.target.value, circleId: "", stationId: "", branchId: "", cellId: "", officeId: "", departmentId: "" }))} className={fieldClassName()}><option value="">Unassigned</option>{filteredZones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}</select></label>
                            <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Circle</span><select value={form.circleId} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, circleId: event.target.value, stationId: "", branchId: "", cellId: "", officeId: "", departmentId: "" }))} className={fieldClassName()}><option value="">Unassigned</option>{filteredCircles.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
                            <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Station</span><select value={form.stationId} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, stationId: event.target.value, branchId: "", cellId: "", officeId: "", departmentId: "" }))} className={fieldClassName()}><option value="">Unassigned</option>{filteredStations.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
                            <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Branch</span><select value={form.branchId} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, branchId: event.target.value, cellId: "", officeId: "", departmentId: "" }))} className={fieldClassName()}><option value="">Unassigned</option>{filteredBranches.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
                            <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Cell</span><select value={form.cellId} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, cellId: event.target.value, officeId: "", departmentId: "" }))} className={fieldClassName()}><option value="">Unassigned</option>{filteredCells.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
                          </>
                        )}
                        <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Office</span><select value={form.officeId} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, officeId: event.target.value, departmentId: "" }))} className={fieldClassName()}><option value="">Unassigned</option>{filteredOffices.map((office) => <option key={office.id} value={office.id}>{office.name}</option>)}</select></label>
                        <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Department</span><select value={form.departmentId} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, departmentId: event.target.value, departmentName: filteredDepartments.find((department) => department.id === event.target.value)?.name ?? current.departmentName }))} className={fieldClassName()}><option value="">Unassigned</option>{filteredDepartments.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>
                      </div>
                      <div className="mt-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Assigned Roles</p>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {(optionsQuery.data?.roles ?? []).map((entry) => {
                            const checked = form.roles.includes(entry.code);
                            return (
                              <button
                                key={entry.code}
                                type="button"
                                disabled={drawerMode === "view"}
                                onClick={() => toggleRole(entry.code)}
                                className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${checked ? "border-[#C7D2FE] bg-[#EEF2FF] text-[#312E81]" : "border-[#E2E8F0] bg-white text-[var(--fia-gray-700)] hover:bg-[var(--fia-gray-50)]"} ${drawerMode === "view" ? "cursor-default" : ""}`}
                              >
                                <span className="text-sm font-medium">{entry.label}</span>
                                {checked ? <CheckCircle2 size={16} /> : <div className="h-4 w-4 rounded-full border border-[#CBD5E1] dark:border-slate-600" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      {form.roles.includes("SECRET_BRANCH") ? (
                        <div className="mt-5 rounded-[20px] border border-[#E2E8F0] bg-[var(--fia-gray-50)] p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Secret Branch Profile</p>
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <label className="block space-y-2"><span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Desk code</span><select value={form.secretBranchDeskCode} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, secretBranchDeskCode: event.target.value as SecretBranchDeskCode | "" }))} className={fieldClassName()}><option value="">Select desk</option>{(optionsQuery.data?.secretBranchDeskCodes ?? []).map((entry) => <option key={entry.code} value={entry.code}>{entry.label}</option>)}</select></label>
                            <div className="space-y-3 pt-1">
                              <label className="flex items-center gap-3 text-sm text-[var(--fia-gray-700)]"><input type="checkbox" checked={form.secretBranchCanManageUsers} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, secretBranchCanManageUsers: event.target.checked }))} className="h-4 w-4 rounded border-[#CBD5E1] dark:border-slate-600" />Can manage users</label>
                              <label className="flex items-center gap-3 text-sm text-[var(--fia-gray-700)]"><input type="checkbox" checked={form.secretBranchCanVerify} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, secretBranchCanVerify: event.target.checked }))} className="h-4 w-4 rounded border-[#CBD5E1] dark:border-slate-600" />Can verify archive stage</label>
                              <label className="flex items-center gap-3 text-sm text-[var(--fia-gray-700)]"><input type="checkbox" checked={form.secretBranchIsActive} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, secretBranchIsActive: event.target.checked }))} className="h-4 w-4 rounded border-[#CBD5E1] dark:border-slate-600" />Secret Branch profile active</label>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </PortalSurface>

                    <PortalSurface title={drawerMode === "create" ? "Provisioning" : "Account Controls"} className="shadow-none">
                      {drawerMode === "create" ? (
                        <div className="space-y-4">
                          {(() => { const fe = showFieldErrors ? getFieldErrors("create") : {}; return (
                          <label className="block space-y-1.5">
                            <FieldLabel label="Temporary Password" required error={fe.temporaryPassword} />
                            <div className="flex gap-2">
                              <input value={form.temporaryPassword} onChange={(event) => setForm((current) => ({ ...current, temporaryPassword: event.target.value }))} aria-label="Temporary Password" className={fieldClassName(Boolean(fe.temporaryPassword))} />
                              <button type="button" onClick={() => setForm((current) => ({ ...current, temporaryPassword: passwordSuggestion() }))} className="shrink-0 rounded-2xl border border-[var(--fia-border,#D8DEE8)] px-3 py-2 text-sm font-semibold text-[var(--fia-gray-700)] transition hover:bg-[var(--fia-gray-50)]">Generate</button>
                              <button type="button" onClick={() => { navigator.clipboard.writeText(form.temporaryPassword); }} title="Copy password" className="shrink-0 rounded-2xl border border-[var(--fia-border,#D8DEE8)] px-3 py-2 text-sm font-semibold text-[var(--fia-gray-700)] transition hover:bg-[var(--fia-gray-50)]">Copy</button>
                            </div>
                            <PasswordStrengthBar password={form.temporaryPassword} />
                          </label>
                          ); })()}
                          <label className="flex items-center gap-3 text-sm text-[var(--fia-gray-700)]"><input type="checkbox" checked={form.mustChangePassword} onChange={(event) => setForm((current) => ({ ...current, mustChangePassword: event.target.checked }))} className="h-4 w-4 rounded border-[#CBD5E1] dark:border-slate-600" />Force password change on first login</label>
                          <label className="flex items-center gap-3 text-sm text-[var(--fia-gray-700)]"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 rounded border-[#CBD5E1] dark:border-slate-600" />Account starts as active</label>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <label className="flex items-center gap-3 text-sm text-[var(--fia-gray-700)]"><input type="checkbox" checked={form.mustChangePassword} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, mustChangePassword: event.target.checked }))} className="h-4 w-4 rounded border-[#CBD5E1] dark:border-slate-600" />Require password update at next sign-in</label>
                          <label className="flex items-center gap-3 text-sm text-[var(--fia-gray-700)]"><input type="checkbox" checked={form.isActive} disabled={drawerMode === "view"} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))} className="h-4 w-4 rounded border-[#CBD5E1] dark:border-slate-600" />Account is active</label>
                          {drawerMode !== "view" && selectedUserId ? (
                            <div className="rounded-[20px] border border-[#E2E8F0] bg-[var(--fia-gray-50)] p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-[var(--fia-gray-900)]">Administrative Password Reset</p>
                                  <p className="mt-1 text-xs leading-5 text-[var(--fia-gray-500)]">Set a new temporary password and require the user to update it after login.</p>
                                </div>
                                <KeyRound size={18} className="text-[var(--fia-gray-600)]" />
                              </div>
                              <div className="mt-3 flex gap-2">
                                <input value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} className={fieldClassName(resetPassword.trim().length < 8)} />
                                <button type="button" onClick={() => setResetPassword(passwordSuggestion())} className="rounded-2xl border border-[var(--fia-border,#D8DEE8)] px-3 py-2 text-sm font-semibold text-[var(--fia-gray-700)] transition hover:bg-white">Generate</button>
                              </div>
                              <label className="mt-3 flex items-center gap-3 text-sm text-[var(--fia-gray-700)]"><input type="checkbox" checked={resetMustChangePassword} onChange={(event) => setResetMustChangePassword(event.target.checked)} className="h-4 w-4 rounded border-[#CBD5E1] dark:border-slate-600" />Require password change immediately after admin reset</label>
                              <button type="button" onClick={() => selectedUserId && resetMutation.mutate({ id: selectedUserId, nextPassword: resetPassword, mustChangePassword: resetMustChangePassword })} disabled={resetMutation.isPending || resetPassword.trim().length < 8} className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-[var(--fia-border,#D8DEE8)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--fia-gray-700)] transition hover:bg-[var(--fia-gray-50)] disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw size={15} />{resetMutation.isPending ? "Resetting..." : "Reset Password"}</button>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </PortalSurface>

                    {drawerMode !== "create" && detailQuery.data ? (
                      <PortalSurface title="Lifecycle" className="shadow-none">
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="rounded-2xl border border-[#E2E8F0] bg-[#FBFCFE] px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Created</p>
                            <p className="mt-2 text-sm font-semibold text-[var(--fia-gray-900)]">{humanDate(detailQuery.data.createdAt)}</p>
                          </div>
                          <div className="rounded-2xl border border-[#E2E8F0] bg-[#FBFCFE] px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Last Updated</p>
                            <p className="mt-2 text-sm font-semibold text-[var(--fia-gray-900)]">{humanDate(detailQuery.data.updatedAt)}</p>
                          </div>
                          <div className="rounded-2xl border border-[#E2E8F0] bg-[#FBFCFE] px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--fia-gray-500)]">Last Login</p>
                            <p className="mt-2 text-sm font-semibold text-[var(--fia-gray-900)]">{humanDate(detailQuery.data.lastLoginAt)}</p>
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
                                  <p className="text-sm font-semibold text-[var(--fia-gray-900)]">{entry.action}</p>
                                  <p className="mt-1 text-xs text-[var(--fia-gray-500)]">{entry.actorName} · {entry.actorRole}</p>
                                </div>
                                <span className="text-xs text-[var(--fia-gray-400)]">{humanDate(entry.createdAt)}</span>
                              </div>
                              <p className="mt-2 text-sm leading-6 text-[var(--fia-gray-600)]">{entry.details}</p>
                            </div>
                          )) : <p className="text-sm text-[var(--fia-gray-500)]">No recent audit activity is linked to this account yet.</p>}
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
                      <button type="button" onClick={() => toggleStatusMutation.mutate({ id: selectedUserId, active: !form.isActive })} disabled={toggleStatusMutation.isPending} className="inline-flex items-center gap-2 rounded-2xl border border-[var(--fia-border,#D8DEE8)] px-4 py-2.5 text-sm font-semibold text-[var(--fia-gray-700)] transition hover:bg-[var(--fia-gray-50)] disabled:cursor-not-allowed disabled:opacity-50">
                        {form.isActive ? <UserMinus size={15} /> : <UserPlus size={15} />}
                        {form.isActive ? "Deactivate" : "Reactivate"}
                      </button>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={closeDrawer} className="rounded-2xl border border-[var(--fia-border,#D8DEE8)] px-4 py-2.5 text-sm font-semibold text-[var(--fia-gray-700)] transition hover:bg-[var(--fia-gray-50)]">Close</button>
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
