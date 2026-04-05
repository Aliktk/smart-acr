"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Info, KeyRound, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  getCurrentUserAvatarUrl,
  getUserSettings,
  updateUserPassword,
  updateUserProfile,
  updateUserSettingsPreferences,
  uploadUserProfileAvatar,
} from "@/api/client";
import { PortalPageHeader, PortalSurface } from "@/components/portal/PortalPrimitives";
import { UserAvatar } from "@/components/ui";
import { useShell } from "@/hooks/useShell";
import type {
  UserDisplayPreferences,
  UserNotificationPreferences,
  UserSecurityPreferencesInput,
  UserSession,
  UserSettings,
} from "@/types/contracts";
import {
  COLOR_TOKENS,
  COMPONENT_VARIANTS,
  DEFAULT_DISPLAY_PREFERENCES,
  DEFAULT_NOTIFICATION_PREFERENCES,
  RADIUS_TOKENS,
  SETTINGS_TABS,
  SPACING_TOKENS,
  TYPOGRAPHY_TOKENS,
  type SettingsTab,
} from "./constants";

function readErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "The request could not be completed.";
  }

  try {
    const parsed = JSON.parse(error.message) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) {
      return parsed.message.join(" ");
    }
    return parsed.message ?? error.message;
  } catch {
    return error.message;
  }
}

function mergeSession(current: UserSession | null, settings: UserSettings) {
  if (!current) {
    return null;
  }

  return {
    ...current,
    name: settings.profile.fullName,
    email: settings.profile.email,
    badgeNo: settings.profile.badgeNo,
    hasAvatar: settings.profile.hasAvatar,
    avatarVersion: settings.profile.avatarVersion,
  } satisfies UserSession;
}

function Field(props: {
  label: string;
  value: string;
  type?: "text" | "email" | "password";
  disabled?: boolean;
  helperText?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--fia-gray-500)]">
        {props.label}
      </span>
      <input
        type={props.type ?? "text"}
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange?.(event.target.value)}
        className={`w-full rounded-[16px] border px-4 py-3 text-sm outline-none transition-all ${
          props.disabled
            ? "cursor-not-allowed border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] text-[var(--fia-gray-400)]"
            : "border-[var(--fia-gray-200)] bg-white text-[var(--fia-gray-900)] focus:border-[var(--fia-cyan)] focus:ring-4 focus:ring-[rgba(0,149,217,0.12)]"
        }`}
      />
      {props.helperText ? <p className="text-xs text-[var(--fia-gray-400)]">{props.helperText}</p> : null}
    </label>
  );
}

function ToggleRow(props: { label: string; description: string; enabled: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--fia-gray-100)] py-4 last:border-b-0">
      <div>
        <p className="text-sm font-semibold text-[var(--fia-gray-900)]">{props.label}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--fia-gray-500)]">{props.description}</p>
      </div>
      <button
        type="button"
        onClick={props.onToggle}
        className={`relative h-6 w-11 rounded-full transition-colors ${
          props.enabled ? "bg-[var(--fia-navy)]" : "bg-[var(--fia-gray-200)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
            props.enabled ? "left-[22px]" : "left-[2px]"
          }`}
        />
      </button>
    </div>
  );
}

function ActionButton(props: {
  label: string;
  busyLabel: string;
  successLabel: string;
  pending: boolean;
  success: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled || props.pending}
      className="inline-flex items-center gap-2 rounded-[16px] bg-[var(--fia-navy)] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--fia-navy-500)] disabled:cursor-not-allowed disabled:bg-[var(--fia-gray-300)]"
    >
      {props.success && !props.pending ? <Check size={16} /> : null}
      {props.pending ? props.busyLabel : props.success ? props.successLabel : props.label}
    </button>
  );
}

function TokenRow({ name, value, sample }: { name: string; value: string; sample?: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-[var(--fia-gray-100)] py-3 last:border-b-0">
      {sample ? <div className="h-7 w-7 rounded-[10px] border border-[var(--fia-gray-200)]" style={{ background: sample }} /> : null}
      <code className="flex-1 text-xs font-medium text-[var(--fia-navy)]">{name}</code>
      <code className="text-xs text-[var(--fia-gray-500)]">{value}</code>
    </div>
  );
}

export function UserSettingsPage({ initialTab = "profile" }: { initialTab?: SettingsTab }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { user, setUser, setSidebarCollapsed } = useShell();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [profileForm, setProfileForm] = useState({ displayName: "", email: "" });
  const [notificationForm, setNotificationForm] = useState<UserNotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [displayForm, setDisplayForm] = useState<UserDisplayPreferences>(DEFAULT_DISPLAY_PREFERENCES);
  const [securityForm, setSecurityForm] = useState<UserSecurityPreferencesInput>({ twoFactorEnabled: false });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", nextPassword: "", confirmPassword: "" });
  const [avatarValidationError, setAvatarValidationError] = useState<string | null>(null);

  const settingsQuery = useQuery({
    queryKey: ["settings", "me"],
    queryFn: getUserSettings,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!settingsQuery.data) {
      return;
    }
    setProfileForm({ displayName: settingsQuery.data.profile.fullName, email: settingsQuery.data.profile.email });
    setNotificationForm(settingsQuery.data.notifications);
    setDisplayForm(settingsQuery.data.display);
    setSecurityForm({ twoFactorEnabled: settingsQuery.data.security.twoFactorEnabled });
  }, [settingsQuery.data]);

  function syncSettings(nextSettings: UserSettings) {
    queryClient.setQueryData(["settings", "me"], nextSettings);
    const nextSession = mergeSession(user, nextSettings);
    if (nextSession) {
      setUser(nextSession);
      queryClient.setQueryData(["session"], nextSession);
    }
  }

  const profileMutation = useMutation({ mutationFn: updateUserProfile, onSuccess: syncSettings });
  const avatarMutation = useMutation({
    mutationFn: uploadUserProfileAvatar,
    onSuccess: (nextSettings) => {
      setAvatarValidationError(null);
      syncSettings(nextSettings);
    },
  });
  const preferencesMutation = useMutation({
    mutationFn: updateUserSettingsPreferences,
    onSuccess: (nextSettings, payload) => {
      syncSettings(nextSettings);
      if (payload.display) {
        setSidebarCollapsed(payload.display.compactSidebar);
      }
    },
  });
  const passwordMutation = useMutation({
    mutationFn: updateUserPassword,
    onSuccess: () => setPasswordForm({ currentPassword: "", nextPassword: "", confirmPassword: "" }),
  });

  const currentSettings = settingsQuery.data;
  const avatarSrc = currentSettings?.profile.hasAvatar ? getCurrentUserAvatarUrl(currentSettings.profile.avatarVersion) : null;
  const avatarError = avatarValidationError ?? readErrorMessage(avatarMutation.error);

  function handleProfileSave() {
    profileMutation.mutate({
      displayName: profileForm.displayName.trim(),
      email: profileForm.email.trim(),
    });
  }

  function handleAvatarSelect(file?: File | null) {
    if (!file) {
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAvatarValidationError("Please upload a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setAvatarValidationError("Profile photos must be 2 MB or smaller.");
      return;
    }
    setAvatarValidationError(null);
    avatarMutation.mutate(file);
  }

  function handlePasswordSave() {
    if (passwordForm.nextPassword !== passwordForm.confirmPassword) {
      return;
    }
    passwordMutation.mutate({
      currentPassword: passwordForm.currentPassword,
      nextPassword: passwordForm.nextPassword,
    });
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] space-y-6 px-6 py-8">
        <PortalPageHeader eyebrow="Account" title="Settings" description="Manage your account, preferences, and system information." />
        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <div className="h-[420px] rounded-[28px] border border-[var(--fia-gray-200)] bg-white" />
          <div className="h-[420px] rounded-[28px] border border-[var(--fia-gray-200)] bg-white" />
        </div>
      </div>
    );
  }

  if (!currentSettings) {
    return (
      <div className="mx-auto max-w-[1200px] px-6 py-8">
        <PortalSurface title="Settings unavailable" subtitle="The account settings payload could not be loaded.">
          <p className="text-sm text-[var(--fia-gray-500)]">Refresh the session and try again.</p>
        </PortalSurface>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] space-y-6 px-6 py-8">
      <PortalPageHeader eyebrow="Account" title="Settings" description="Manage your account, preferences, and system information." />

      <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
        <PortalSurface>
          <div className="space-y-5">
            <div className="rounded-[24px] border border-[var(--fia-gray-100)] bg-[linear-gradient(145deg,#F8FAFC_0%,#FFFFFF_100%)] p-5">
              <div className="flex items-center gap-4">
                <UserAvatar name={currentSettings.profile.fullName} src={avatarSrc} sizeClassName="h-16 w-16" textClassName="text-xl" />
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-[var(--fia-gray-950)]">{currentSettings.profile.fullName}</p>
                  <p className="mt-1 text-sm text-[var(--fia-gray-500)]">
                    {currentSettings.profile.badgeNo} <span className="text-[var(--fia-gray-300)]">·</span> {currentSettings.profile.roleLabel}
                  </p>
                  <p className="mt-1 text-xs text-[var(--fia-gray-400)]">{currentSettings.profile.officeName}</p>
                </div>
              </div>
            </div>

            <nav className="space-y-1.5">
              {SETTINGS_TABS.map((tab) => {
                const Icon = tab.icon;
                const active = tab.key === activeTab;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex w-full items-center gap-3 rounded-[18px] px-4 py-3 text-left text-sm transition-colors ${
                      active ? "bg-[var(--fia-navy-100)] text-[var(--fia-navy)]" : "text-[var(--fia-gray-600)] hover:bg-[var(--fia-gray-50)]"
                    }`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-[14px] ${active ? "bg-white text-[var(--fia-navy)]" : "bg-[var(--fia-gray-50)] text-[var(--fia-gray-500)]"}`}>
                      <Icon size={16} />
                    </span>
                    <span className={active ? "font-semibold" : "font-medium"}>{tab.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </PortalSurface>

        <div className="space-y-6">
          {activeTab === "profile" ? (
            <>
              <PortalSurface title="Profile" subtitle="Update your personal account details and photo.">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="rounded-[24px] border border-[var(--fia-gray-100)] bg-[linear-gradient(145deg,#FFFFFF_0%,#F8FAFC_100%)] p-5">
                    <div className="flex items-center gap-4">
                      <UserAvatar name={currentSettings.profile.fullName} src={avatarSrc} sizeClassName="h-20 w-20" textClassName="text-2xl" />
                      <div>
                        <p className="text-lg font-semibold text-[var(--fia-gray-950)]">{currentSettings.profile.fullName}</p>
                        <p className="mt-1 text-sm text-[var(--fia-gray-500)]">{currentSettings.profile.badgeNo} · {currentSettings.profile.roleLabel}</p>
                        <p className="mt-1 text-xs text-[var(--fia-gray-400)]">{currentSettings.profile.officeName}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-[var(--fia-gray-100)] bg-[var(--fia-gray-50)] p-5">
                    <p className="text-sm font-semibold text-[var(--fia-gray-900)]">Photo</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--fia-gray-500)]">Upload a JPG, PNG, or WEBP image up to 2 MB.</p>
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => handleAvatarSelect(event.target.files?.[0])} />
                    <button type="button" onClick={() => fileInputRef.current?.click()} disabled={avatarMutation.isPending} className="mt-4 inline-flex items-center gap-2 rounded-[16px] border border-[var(--fia-gray-200)] bg-white px-4 py-3 text-sm font-semibold text-[var(--fia-gray-800)] disabled:cursor-not-allowed disabled:text-[var(--fia-gray-400)]">
                      {avatarMutation.isPending ? <Upload size={16} /> : <Camera size={16} />}
                      {avatarMutation.isPending ? "Uploading photo..." : "Upload Photo"}
                    </button>
                    {avatarError && (avatarValidationError || avatarMutation.isError) ? <p className="mt-3 text-xs text-[var(--fia-danger)]">{avatarError}</p> : null}
                    {avatarMutation.isSuccess ? <p className="mt-3 text-xs text-[var(--fia-success)]">Profile photo updated successfully.</p> : null}
                  </div>
                </div>
              </PortalSurface>

              <PortalSurface title="Personal Information" subtitle="Badge number and office placement remain tied to the official organization structure." action={<ActionButton label="Save Changes" busyLabel="Saving changes..." successLabel="Saved" pending={profileMutation.isPending} success={profileMutation.isSuccess} onClick={handleProfileSave} disabled={!profileForm.displayName.trim() || !profileForm.email.trim()} />}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Full Name" value={profileForm.displayName} onChange={(displayName) => setProfileForm((current) => ({ ...current, displayName }))} />
                  <Field label="Badge Number" value={currentSettings.profile.badgeNo} disabled />
                  <Field label="Email" type="email" value={profileForm.email} onChange={(email) => setProfileForm((current) => ({ ...current, email }))} />
                  <Field label="Office" value={currentSettings.profile.officeName} disabled helperText="Managed by your organizational assignment and role scope." />
                </div>
                {profileMutation.isError ? <p className="mt-4 text-sm text-[var(--fia-danger)]">{readErrorMessage(profileMutation.error)}</p> : null}
              </PortalSurface>
            </>
          ) : null}

          {activeTab === "notifications" ? (
            <PortalSurface title="Notification Preferences" subtitle="Control which workflow and oversight alerts arrive in your queue and digest." action={<ActionButton label="Save Preferences" busyLabel="Saving preferences..." successLabel="Saved" pending={preferencesMutation.isPending} success={preferencesMutation.isSuccess} onClick={() => preferencesMutation.mutate({ notifications: notificationForm })} />}>
              <ToggleRow label="ACR Submitted" description="Notify when a new ACR enters your working queue." enabled={notificationForm.acrSubmitted} onToggle={() => setNotificationForm((current) => ({ ...current, acrSubmitted: !current.acrSubmitted }))} />
              <ToggleRow label="ACR Returned" description="Notify when a record is returned for clarification or correction." enabled={notificationForm.acrReturned} onToggle={() => setNotificationForm((current) => ({ ...current, acrReturned: !current.acrReturned }))} />
              <ToggleRow label="Overdue Alerts" description="Daily reminders for records that are close to breach or already overdue." enabled={notificationForm.overdueAlerts} onToggle={() => setNotificationForm((current) => ({ ...current, overdueAlerts: !current.overdueAlerts }))} />
              <ToggleRow label="Priority Flags" description="Immediate notice when a record is escalated as priority." enabled={notificationForm.priorityAlerts} onToggle={() => setNotificationForm((current) => ({ ...current, priorityAlerts: !current.priorityAlerts }))} />
              <ToggleRow label="System Updates" description="Announcements about release changes, maintenance windows, and service notices." enabled={notificationForm.systemUpdates} onToggle={() => setNotificationForm((current) => ({ ...current, systemUpdates: !current.systemUpdates }))} />
              <ToggleRow label="Weekly Digest" description="A weekly summary of queue activity and pending workload." enabled={notificationForm.weeklyDigest} onToggle={() => setNotificationForm((current) => ({ ...current, weeklyDigest: !current.weeklyDigest }))} />
              {preferencesMutation.isError ? <p className="mt-4 text-sm text-[var(--fia-danger)]">{readErrorMessage(preferencesMutation.error)}</p> : null}
            </PortalSurface>
          ) : null}

          {activeTab === "security" ? (
            <>
              <PortalSurface title="Change Password" subtitle="Update your account password and manage sign-in protection from this security section." action={<ActionButton label="Update Password" busyLabel="Updating password..." successLabel="Password Updated" pending={passwordMutation.isPending} success={passwordMutation.isSuccess} onClick={handlePasswordSave} disabled={!passwordForm.currentPassword || !passwordForm.nextPassword || !passwordForm.confirmPassword || passwordForm.nextPassword !== passwordForm.confirmPassword} />}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Current Password" type="password" value={passwordForm.currentPassword} onChange={(currentPassword) => setPasswordForm((current) => ({ ...current, currentPassword }))} />
                  <div />
                  <Field label="New Password" type="password" value={passwordForm.nextPassword} onChange={(nextPassword) => setPasswordForm((current) => ({ ...current, nextPassword }))} helperText="Use at least 8 characters." />
                  <Field label="Confirm New Password" type="password" value={passwordForm.confirmPassword} onChange={(confirmPassword) => setPasswordForm((current) => ({ ...current, confirmPassword }))} />
                </div>
                {passwordForm.nextPassword && passwordForm.confirmPassword && passwordForm.nextPassword !== passwordForm.confirmPassword ? <p className="mt-4 text-sm text-[var(--fia-danger)]">The new password and confirmation password do not match.</p> : null}
                {passwordMutation.isError ? <p className="mt-4 text-sm text-[var(--fia-danger)]">{readErrorMessage(passwordMutation.error)}</p> : null}
              </PortalSurface>

              <PortalSurface title="Two-Factor Authentication" subtitle="New accounts start without sign-in verification. Enable it here later when this account is ready for the extra step." action={<ActionButton label="Save Security Preference" busyLabel="Saving security preference..." successLabel="Saved" pending={preferencesMutation.isPending} success={preferencesMutation.isSuccess} onClick={() => preferencesMutation.mutate({ security: securityForm })} />}>
                <div className="flex flex-col gap-4 rounded-[24px] border border-[var(--fia-gray-100)] bg-[linear-gradient(145deg,#F8FAFC_0%,#FFFFFF_100%)] p-5 md:flex-row md:items-start md:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-[16px] bg-[var(--fia-navy-100)] text-[var(--fia-navy)]">
                      <KeyRound size={18} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[var(--fia-gray-900)]">Optional Verification Challenge</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--fia-gray-500)]">When enabled, the portal asks for a one-time verification code after your password. Leave it off for first login or until this account is fully configured.</p>
                      <p className="mt-2 text-xs text-[var(--fia-gray-400)]">Last password change: {currentSettings.security.passwordChangedAt ? new Date(currentSettings.security.passwordChangedAt).toLocaleDateString() : "Not available"}</p>
                    </div>
                  </div>
                  <span className="inline-flex rounded-full bg-[var(--fia-success-bg)] px-3 py-1.5 text-xs font-semibold text-[var(--fia-success)]">
                    {securityForm.twoFactorEnabled ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-5">
                  <ToggleRow label="Require verification code at sign-in" description="Use a second sign-in step for this account. The portal will send the code to your registered destination when this is active." enabled={securityForm.twoFactorEnabled} onToggle={() => setSecurityForm((current) => ({ twoFactorEnabled: !current.twoFactorEnabled }))} />
                </div>
                {preferencesMutation.isError ? <p className="mt-4 text-sm text-[var(--fia-danger)]">{readErrorMessage(preferencesMutation.error)}</p> : null}
              </PortalSurface>
            </>
          ) : null}

          {activeTab === "display" ? (
            <PortalSurface title="Display Preferences" subtitle="Keep the workspace calm, spacious, and readable without visual noise." action={<ActionButton label="Save Display Preferences" busyLabel="Saving display settings..." successLabel="Saved" pending={preferencesMutation.isPending} success={preferencesMutation.isSuccess} onClick={() => preferencesMutation.mutate({ display: displayForm })} />}>
              <div className="rounded-[24px] border border-[#DBEAFE] bg-[linear-gradient(135deg,#EEF6FF_0%,#FFFFFF_100%)] p-4">
                <div className="flex items-start gap-3">
                  <Info size={18} className="mt-0.5 text-[var(--fia-cyan)]" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--fia-navy)]">Readable enterprise defaults</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--fia-gray-600)]">These preferences are stored per account. The sidebar preference is applied immediately after save.</p>
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <ToggleRow label="Compact Sidebar" description="Collapse the navigation rail by default for a more spacious workspace." enabled={displayForm.compactSidebar} onToggle={() => setDisplayForm((current) => ({ ...current, compactSidebar: !current.compactSidebar }))} />
                <ToggleRow label="Dense Tables" description="Use tighter row density in records and queue tables where supported." enabled={displayForm.denseTables} onToggle={() => setDisplayForm((current) => ({ ...current, denseTables: !current.denseTables }))} />
                <ToggleRow label="Reduce Motion" description="Tone down decorative transitions to keep the workspace calmer." enabled={displayForm.reduceMotion} onToggle={() => setDisplayForm((current) => ({ ...current, reduceMotion: !current.reduceMotion }))} />
              </div>
              {preferencesMutation.isError ? <p className="mt-4 text-sm text-[var(--fia-danger)]">{readErrorMessage(preferencesMutation.error)}</p> : null}
            </PortalSurface>
          ) : null}

          {activeTab === "system" ? (
            <>
              <PortalSurface title="Design System" subtitle="The current portal tokens and component language used by the local build.">
                <div className="rounded-[24px] border border-[#BFDBFE] bg-[linear-gradient(135deg,#EEF6FC_0%,#FFFFFF_100%)] px-4 py-4">
                  <div className="flex items-start gap-3">
                    <Info size={18} className="mt-0.5 text-[var(--fia-cyan)]" />
                    <div>
                      <p className="text-sm font-semibold text-[var(--fia-navy)]">FIA Design System v2.0</p>
                      <p className="mt-1 text-xs text-[var(--fia-gray-500)]">Token-based layout, enterprise spacing, and reduced-noise surface design for April 2026.</p>
                    </div>
                  </div>
                </div>
              </PortalSurface>

              <PortalSurface title="Color Tokens">{COLOR_TOKENS.map((token) => <TokenRow key={token.name} {...token} />)}</PortalSurface>
              <PortalSurface title="Spacing Tokens">{SPACING_TOKENS.map((token) => <TokenRow key={token.name} {...token} />)}</PortalSurface>
              <PortalSurface title="Border Radius Tokens">{RADIUS_TOKENS.map((token) => <TokenRow key={token.name} {...token} />)}</PortalSurface>
              <PortalSurface title="Typography Scale">{TYPOGRAPHY_TOKENS.map((token) => <TokenRow key={token.name} {...token} />)}</PortalSurface>
              <PortalSurface title="Component Variants">
                {COMPONENT_VARIANTS.map((variant) => (
                  <div key={variant.name} className="border-b border-[var(--fia-gray-100)] py-3 last:border-b-0">
                    <p className="text-sm font-semibold text-[var(--fia-gray-900)]">{variant.name}</p>
                    <p className="mt-1 text-xs text-[var(--fia-gray-500)]">{variant.variants}</p>
                  </div>
                ))}
              </PortalSurface>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
