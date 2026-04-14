"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, ChevronDown, ChevronUp, Info, KeyRound, PenTool, Stamp, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  getCurrentUserAvatarUrl,
  getUserAssetContentUrl,
  getUserSettings,
  removeUserProfileAsset,
  updateUserEmployeeProfile,
  updateUserPassword,
  updateUserProfile,
  updateUserSettingsPreferences,
  uploadUserProfileAsset,
  uploadUserProfileAvatar,
} from "@/api/client";
import { PortalPageHeader, PortalSurface } from "@/components/portal/PortalPrimitives";
import { UserAvatar } from "@/components/ui";
import { useShell } from "@/hooks/useShell";
import type {
  DeputationType,
  EducationLevel,
  Gender,
  LanguageProficiencyLevel,
  UpdateEmployeeProfilePayload,
  UserDisplayPreferences,
  UserNotificationPreferences,
  UserAssetType,
  UserProfileAsset,
  UserSecurityPreferencesInput,
  UserSession,
  UserSettings,
  UserSettingsEmployeeProfile,
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

const FIELD_NAME_PREFIXES = [
  "basicPay",
  "mobile",
  "dateOfBirth",
  "fatherName",
  "spouseName",
  "appointmentToBpsDate",
  "educationLevel",
  "qualifications",
  "deputationType",
  "natureOfDuties",
  "personnelNumber",
  "serviceGroup",
  "licenseType",
  "vehicleType",
  "trainingCoursesText",
  "joiningDate",
  "gender",
];

function parseApiFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof Error)) return {};
  try {
    const parsed = JSON.parse(error.message) as { message?: unknown };
    if (!Array.isArray(parsed.message)) return {};
    const result: Record<string, string> = {};
    for (const msg of parsed.message as string[]) {
      if (typeof msg !== "string") continue;
      const matchedField = FIELD_NAME_PREFIXES.find(
        (field) =>
          msg.startsWith(field + " ") ||
          msg.startsWith(field + "_") ||
          msg.toLowerCase().startsWith(field.toLowerCase() + " ") ||
          msg.toLowerCase().startsWith(field.toLowerCase() + "_")
      );
      if (matchedField) {
        result[matchedField] = msg;
      }
    }
    return result;
  } catch {
    return {};
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
  type?: "text" | "email" | "password" | "number";
  disabled?: boolean;
  helperText?: string;
  error?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--fia-gray-500)]">
          {props.label}
        </span>
        {props.error ? <span className="text-[10px] font-medium text-[#DC2626]">{props.error}</span> : null}
      </div>
      <input
        type={props.type ?? "text"}
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange?.(event.target.value)}
        onBlur={props.onBlur}
        className={`w-full rounded-[16px] border px-4 py-2.5 text-sm outline-none transition-all ${
          props.disabled
            ? "cursor-not-allowed border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] text-[var(--fia-gray-400)]"
            : props.error
            ? "border-[#FCA5A5] bg-[#FFF5F5] text-[var(--fia-gray-900)] focus:border-[#DC2626] focus:ring-4 focus:ring-[#FCA5A5]/20"
            : "border-[var(--fia-gray-200)] bg-white text-[var(--fia-gray-900)] focus:border-[var(--fia-cyan)] focus:ring-4 focus:ring-[rgba(0,149,217,0.12)]"
        }`}
      />
      {props.helperText && !props.error ? <p className="text-xs text-[var(--fia-gray-400)]">{props.helperText}</p> : null}
    </label>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
  helperText?: string;
  error?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--fia-gray-500)]">
          {props.label}
        </span>
        {props.error ? <span className="text-[10px] font-medium text-[#DC2626]">{props.error}</span> : null}
      </div>
      <select
        value={props.value}
        onChange={(event) => props.onChange?.(event.target.value)}
        className={`w-full rounded-[16px] border px-4 py-2.5 text-sm outline-none transition-all ${
          props.error
            ? "border-[#FCA5A5] bg-[#FFF5F5] text-[var(--fia-gray-900)] focus:border-[#DC2626] focus:ring-4 focus:ring-[#FCA5A5]/20"
            : "border-[var(--fia-gray-200)] bg-white text-[var(--fia-gray-900)] focus:border-[var(--fia-cyan)] focus:ring-4 focus:ring-[rgba(0,149,217,0.12)]"
        }`}
      >
        {props.placeholder ? <option value="">{props.placeholder}</option> : null}
        {props.options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      {props.helperText && !props.error ? <p className="text-xs text-[var(--fia-gray-400)]">{props.helperText}</p> : null}
    </label>
  );
}

function ServiceGroupField(props: { value: string; onChange: (v: string) => void }) {
  const knownValues = SERVICE_GROUP_OPTIONS.map((o) => o.value);
  const isKnown = props.value === "" || knownValues.includes(props.value);
  const selectValue = isKnown ? props.value : "Other";

  function handleSelectChange(v: string) {
    if (v === "Other") {
      props.onChange("Other");
    } else {
      props.onChange(v);
    }
  }

  return (
    <div className="block space-y-1.5">
      <SelectField
        label="Service Group"
        value={selectValue}
        options={SERVICE_GROUP_OPTIONS}
        placeholder="Select service / group"
        helperText="Civil service group or cadre (for PER-17/18 Officers)"
        onChange={handleSelectChange}
      />
      {selectValue === "Other" ? (
        <input
          type="text"
          value={props.value === "Other" ? "" : props.value}
          onChange={(e) => props.onChange(e.target.value || "Other")}
          placeholder="Specify service group"
          className="w-full rounded-[16px] border border-[var(--fia-gray-200)] bg-white px-4 py-2.5 text-sm text-[var(--fia-gray-900)] outline-none transition-all focus:border-[var(--fia-cyan)] focus:ring-4 focus:ring-[rgba(0,149,217,0.12)]"
        />
      ) : null}
    </div>
  );
}

function TextareaField(props: {
  label: string;
  value: string;
  rows?: number;
  helperText?: string;
  error?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--fia-gray-500)]">
          {props.label}
        </span>
        {props.error ? <span className="text-[10px] font-medium text-[#DC2626]">{props.error}</span> : null}
      </div>
      <textarea
        value={props.value}
        rows={props.rows ?? 3}
        onChange={(event) => props.onChange?.(event.target.value)}
        className={`w-full resize-none rounded-[16px] border px-4 py-2.5 text-sm outline-none transition-all ${
          props.error
            ? "border-[#FCA5A5] bg-[#FFF5F5] text-[var(--fia-gray-900)] focus:border-[#DC2626] focus:ring-4 focus:ring-[#FCA5A5]/20"
            : "border-[var(--fia-gray-200)] bg-white text-[var(--fia-gray-900)] focus:border-[var(--fia-cyan)] focus:ring-4 focus:ring-[rgba(0,149,217,0.12)]"
        }`}
      />
      {props.helperText && !props.error ? <p className="text-xs text-[var(--fia-gray-400)]">{props.helperText}</p> : null}
    </label>
  );
}

function DateField(props: {
  label: string;
  value: string;
  helperText?: string;
  error?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--fia-gray-500)]">
          {props.label}
        </span>
        {props.error ? <span className="text-[10px] font-medium text-[#DC2626]">{props.error}</span> : null}
      </div>
      <input
        type="date"
        value={props.value}
        onChange={(event) => props.onChange?.(event.target.value)}
        className={`w-full rounded-[16px] border px-4 py-2.5 text-sm outline-none transition-all ${
          props.error
            ? "border-[#FCA5A5] bg-[#FFF5F5] text-[var(--fia-gray-900)] focus:border-[#DC2626] focus:ring-4 focus:ring-[#FCA5A5]/20"
            : "border-[var(--fia-gray-200)] bg-white text-[var(--fia-gray-900)] focus:border-[var(--fia-cyan)] focus:ring-4 focus:ring-[rgba(0,149,217,0.12)]"
        }`}
      />
      {props.helperText && !props.error ? <p className="text-xs text-[var(--fia-gray-400)]">{props.helperText}</p> : null}
    </label>
  );
}

function ReadonlyField(props: { label: string; value: string; helperText?: string }) {
  return (
    <div className="space-y-1.5">
      <span className="block text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--fia-gray-500)]">
        {props.label}
      </span>
      <div className="w-full rounded-[16px] border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] px-4 py-2.5 text-sm text-[var(--fia-gray-400)] cursor-not-allowed">
        {props.value || <span className="italic">Not set</span>}
      </div>
      {props.helperText ? <p className="text-xs text-[var(--fia-gray-400)]">{props.helperText}</p> : null}
    </div>
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

function AssetCard(props: {
  title: string;
  description: string;
  icon: typeof PenTool;
  asset: UserProfileAsset | null;
  previewUrl: string | null;
  validationError?: string | null;
  busyUpload?: boolean;
  busyRemove?: boolean;
  successMessage?: string | null;
  onUploadClick: () => void;
  onRemove: () => void;
}) {
  const Icon = props.icon;

  return (
    <div className="rounded-[20px] border border-[var(--fia-gray-200)] bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[14px] border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] text-[var(--fia-navy)]">
            <Icon size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-[var(--fia-gray-900)]">{props.title}</p>
            <p className="mt-1 text-xs leading-5 text-[var(--fia-gray-500)]">{props.description}</p>
          </div>
        </div>
        {props.asset ? (
          <span className="rounded-full border border-[#BBF7D0] bg-[#F0FDF4] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#166534]">
            Saved
          </span>
        ) : (
          <span className="rounded-full border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--fia-gray-500)]">
            Missing
          </span>
        )}
      </div>

      <div className="mt-4 flex min-h-[160px] items-center justify-center overflow-hidden rounded-[16px] border border-dashed border-[var(--fia-gray-300)] bg-[var(--fia-gray-50)] p-4">
        {props.previewUrl ? (
          <img src={props.previewUrl} alt={props.title} className="max-h-[148px] max-w-full object-contain mix-blend-multiply" />
        ) : (
          <p className="max-w-[220px] text-center text-xs leading-5 text-[var(--fia-gray-400)]">
            No reusable asset has been uploaded yet. The system will keep this section empty in forms until you add one.
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={props.onUploadClick}
          disabled={props.busyUpload || props.busyRemove}
          className="inline-flex items-center gap-2 rounded-[12px] border border-[var(--fia-navy)] bg-[var(--fia-navy)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:border-[var(--fia-gray-300)] disabled:bg-[var(--fia-gray-300)]"
        >
          <Upload size={16} />
          {props.busyUpload ? "Uploading..." : props.asset ? "Replace" : "Upload"}
        </button>
        <button
          type="button"
          onClick={props.onRemove}
          disabled={!props.asset || props.busyUpload || props.busyRemove}
          className="inline-flex items-center gap-2 rounded-[12px] border border-[#FECACA] bg-[#FFF1F2] px-4 py-2.5 text-sm font-semibold text-[#B42318] disabled:cursor-not-allowed disabled:border-[var(--fia-gray-200)] disabled:bg-[var(--fia-gray-50)] disabled:text-[var(--fia-gray-400)]"
        >
          <Trash2 size={16} />
          {props.busyRemove ? "Removing..." : "Remove"}
        </button>
      </div>

      {props.asset ? (
        <p className="mt-3 text-xs text-[var(--fia-gray-400)]">
          {props.asset.fileName} · {(props.asset.fileSize / 1024).toFixed(0)} KB · Updated{" "}
          {new Date(props.asset.updatedAt).toLocaleDateString()}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-[var(--fia-gray-400)]">Accepted: JPG, PNG, WEBP · Max size: 2 MB</p>
      {props.validationError ? <p className="mt-3 text-xs text-[var(--fia-danger)]">{props.validationError}</p> : null}
      {props.successMessage ? <p className="mt-3 text-xs text-[var(--fia-success)]">{props.successMessage}</p> : null}
    </div>
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

const GENDER_OPTIONS: Array<{ value: Gender; label: string }> = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

const DEPUTATION_OPTIONS: Array<{ value: DeputationType; label: string }> = [
  { value: "DIRECT", label: "Direct" },
  { value: "DEPUTATIONIST", label: "Deputationist" },
];

const EDUCATION_LEVEL_OPTIONS: Array<{ value: EducationLevel; label: string }> = [
  { value: "BELOW_MATRIC", label: "Below Matric (Middle / Primary)" },
  { value: "MATRIC", label: "Matric — SSC (Grade 10)" },
  { value: "INTERMEDIATE", label: "Intermediate — HSSC (Grade 12)" },
  { value: "DIPLOMA", label: "Diploma (Technical / Vocational)" },
  { value: "BA_BSC", label: "BA / BSc (2-year, old system)" },
  { value: "BS_HONORS", label: "BS / BE / BBA / LLB (4-year Honors)" },
  { value: "MA_MSC", label: "MA / MSc (2-year, old system)" },
  { value: "MS_MPHIL", label: "MS / MPhil" },
  { value: "PHD", label: "PhD / Doctorate" },
  { value: "OTHER", label: "Other" },
];

const LICENSE_TYPE_OPTIONS = [
  { value: "MOTORCYCLE", label: "Motorcycle" },
  { value: "LTV", label: "LTV — Light Transport Vehicle" },
  { value: "HTV", label: "HTV — Heavy Transport Vehicle" },
  { value: "PSV", label: "PSV — Public Service Vehicle" },
  { value: "A", label: "Class A" },
  { value: "B", label: "Class B — Motor Car" },
  { value: "C", label: "Class C — LTV" },
  { value: "D", label: "Class D — HTV" },
];

const VEHICLE_TYPE_OPTIONS = [
  { value: "MOTORCYCLE", label: "Motorcycle" },
  { value: "CAR_SEDAN", label: "Car (Sedan)" },
  { value: "CAR_SUV", label: "Car (SUV / Jeep)" },
  { value: "PICKUP", label: "Pickup" },
  { value: "VAN", label: "Van" },
  { value: "MINIBUS", label: "Minibus" },
  { value: "BUS", label: "Bus" },
  { value: "TRUCK", label: "Truck" },
];

const SERVICE_GROUP_OPTIONS = [
  { value: "Police Service of Pakistan (PSP)", label: "Police Service of Pakistan (PSP)" },
  { value: "District Management Group (DMG)", label: "District Management Group (DMG)" },
  { value: "Foreign Service of Pakistan (FSP)", label: "Foreign Service of Pakistan (FSP)" },
  { value: "Inland Revenue Service (IRS)", label: "Inland Revenue Service (IRS)" },
  { value: "Pakistan Customs Service (PCS)", label: "Pakistan Customs Service (PCS)" },
  { value: "Office Management Group (OMG)", label: "Office Management Group (OMG)" },
  { value: "Information Group", label: "Information Group" },
  { value: "Postal Group", label: "Postal Group" },
  { value: "Accounts Group", label: "Accounts Group" },
  { value: "Audit & Accounts Service", label: "Audit & Accounts Service" },
  { value: "Military", label: "Military" },
  { value: "Federal Government Service", label: "Federal Government Service" },
  { value: "Provincial Civil Service", label: "Provincial Civil Service" },
  { value: "Other", label: "Other (specify below)" },
];

const LANG_LEVEL_OPTIONS: Array<{ value: LanguageProficiencyLevel; label: string }> = [
  { value: "NONE", label: "None" },
  { value: "BASIC", label: "Basic" },
  { value: "GOOD", label: "Good" },
  { value: "EXCELLENT", label: "Excellent" },
];

function ServiceRecordSection(props: {
  employee: UserSettingsEmployeeProfile;
  form: UpdateEmployeeProfilePayload;
  setForm: React.Dispatch<React.SetStateAction<UpdateEmployeeProfilePayload>>;
  showLanguages: boolean;
  setShowLanguages: (v: boolean) => void;
  showTrainingCourses: boolean;
  setShowTrainingCourses: (v: boolean) => void;
  onSave: () => void;
  isPending: boolean;
  isSuccess: boolean;
  error: string | null;
  apiErrors?: Record<string, string>;
}) {
  const { employee, form, setForm } = props;
  const [errors, setErrors] = useState<Record<string, string>>({});

  function setField<K extends keyof UpdateEmployeeProfilePayload>(key: K, value: UpdateEmployeeProfilePayload[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validateMobile(value: string) {
    if (!value) return "";
    const cleaned = value.replace(/\s/g, "");
    return /^03\d{2}-?\d{7}$/.test(cleaned) ? "" : "Format: 03xx-xxxxxxx";
  }

  function validatePersonnelNumber(value: string) {
    if (!value) return "";
    return /^[A-Za-z0-9\-/]+$/.test(value.trim()) ? "" : "Alphanumeric, hyphens and / only";
  }

  function formatMobile(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }

  return (
    <PortalSurface
      title="Service Record"
      subtitle="These personal and service details are reused automatically across ACR forms. Keep them current so forms auto-fill correctly."
      action={
        <ActionButton
          label="Save Service Record"
          busyLabel="Saving..."
          successLabel="Saved"
          pending={props.isPending}
          success={props.isSuccess}
          onClick={props.onSave}
        />
      }
    >
      {/* Read-only identity block — only shown when an employee record is linked */}
      {employee.isLinked ? (
        <div className="mb-5 rounded-[20px] border border-[var(--fia-gray-100)] bg-[linear-gradient(145deg,#F8FAFC_0%,#FFFFFF_100%)] p-4">
          <p className="mb-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--fia-gray-400)]">
            Organisational Record — Read Only
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <ReadonlyField label="Name" value={employee.name} />
            <ReadonlyField label="Rank" value={employee.rank} />
            <ReadonlyField label="Designation" value={employee.designation} helperText="Updated by Clerk / Admin" />
            <ReadonlyField label="BPS / Scale" value={String(employee.bps)} />
            <ReadonlyField label="Current Posting" value={employee.posting} helperText="Updated by Clerk / Admin" />
            <ReadonlyField label="Date of Entry in Service" value={employee.joiningDate.substring(0, 10)} />
          </div>
        </div>
      ) : (
        <div className="mb-5 flex items-start gap-3 rounded-[20px] border border-[#FEF3C7] bg-[#FFFBEB] p-4">
          <Info size={16} className="mt-0.5 shrink-0 text-[#B45309]" />
          <div>
            <p className="text-sm font-semibold text-[#92400E]">Employee record not yet created</p>
            <p className="mt-1 text-xs leading-5 text-[#A16207]">
              Your rank, posting, and organisational details will be filled in by a Clerk when they create your employee record. You can save the personal details below now — they will be used as pre-fill when your record is set up.
            </p>
          </div>
        </div>
      )}

      {/* Editable personal details */}
      <p className="mb-2.5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--fia-gray-400)]">
        Personal Details
      </p>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Gender"
          value={form.gender ?? ""}
          options={GENDER_OPTIONS}
          placeholder="Select gender"
          error={props.apiErrors?.gender || ""}
          onChange={(v) => setField("gender", (v as Gender) || undefined)}
        />
        <DateField
          label="Date of Birth"
          value={form.dateOfBirth ?? ""}
          error={props.apiErrors?.dateOfBirth || ""}
          onChange={(v) => setField("dateOfBirth", v || undefined)}
        />
        <Field
          label="Father's Name"
          value={form.fatherName ?? ""}
          error={props.apiErrors?.fatherName || ""}
          onChange={(v) => setField("fatherName", v || undefined)}
        />
        <Field
          label="Spouse's Name"
          value={form.spouseName ?? ""}
          helperText="Leave blank if not applicable"
          error={props.apiErrors?.spouseName || ""}
          onChange={(v) => setField("spouseName", v || undefined)}
        />
        <Field
          label="Mobile Number"
          value={form.mobile ?? ""}
          error={errors.mobile}
          helperText="Format: 03xx-xxxxxxx"
          onChange={(v) => {
            const formatted = formatMobile(v);
            setField("mobile", formatted || undefined);
            setErrors((e) => ({ ...e, mobile: validateMobile(formatted) }));
          }}
          onBlur={() => setErrors((e) => ({ ...e, mobile: validateMobile(form.mobile ?? "") }))}
        />
      </div>

      {/* Service details */}
      <p className="mb-2.5 mt-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--fia-gray-400)]">
        Service Details
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Basic Pay (PKR)"
          type="number"
          value={form.basicPay !== undefined ? String(form.basicPay) : ""}
          helperText="Monthly basic pay"
          error={errors.basicPay || props.apiErrors?.basicPay || ""}
          onChange={(v) => {
            setField("basicPay", v ? Number(v) : undefined);
            if (v && (!Number.isInteger(Number(v)) || Number(v) < 0)) {
              setErrors((e) => ({ ...e, basicPay: "Basic pay must be a whole number (no decimals)" }));
            } else {
              setErrors((e) => ({ ...e, basicPay: "" }));
            }
          }}
        />
        {!employee.isLinked && (
          <DateField
            label="Date of Entry in Service"
            value={form.joiningDate ?? ""}
            helperText="Your joining / appointment date"
            error={props.apiErrors?.joiningDate || ""}
            onChange={(v) => setField("joiningDate", v || undefined)}
          />
        )}
        <DateField
          label="Appointment to Current BPS"
          value={form.appointmentToBpsDate ?? ""}
          error={props.apiErrors?.appointmentToBpsDate || ""}
          onChange={(v) => setField("appointmentToBpsDate", v || undefined)}
        />
        <SelectField
          label="Deputation Type"
          value={form.deputationType ?? ""}
          options={DEPUTATION_OPTIONS}
          placeholder="Select type"
          error={props.apiErrors?.deputationType || ""}
          onChange={(v) => setField("deputationType", (v as DeputationType) || undefined)}
        />
        <ServiceGroupField
          value={form.serviceGroup ?? ""}
          onChange={(v) => setField("serviceGroup", v || undefined)}
        />
        <SelectField
          label="License Type"
          value={form.licenseType ?? ""}
          options={LICENSE_TYPE_OPTIONS}
          placeholder="Select license type"
          helperText="For Driver / Dispatch Rider template"
          error={props.apiErrors?.licenseType || ""}
          onChange={(v) => setField("licenseType", v || undefined)}
        />
        <SelectField
          label="Vehicle Type"
          value={form.vehicleType ?? ""}
          options={VEHICLE_TYPE_OPTIONS}
          placeholder="Select vehicle type"
          helperText="For Driver / Dispatch Rider template"
          error={props.apiErrors?.vehicleType || ""}
          onChange={(v) => setField("vehicleType", v || undefined)}
        />
        <Field
          label="Personnel Number"
          value={form.personnelNumber ?? ""}
          error={errors.personnelNumber}
          helperText="PER number for PER-17/18 Officers"
          onChange={(v) => {
            setField("personnelNumber", v || undefined);
            setErrors((e) => ({ ...e, personnelNumber: validatePersonnelNumber(v) }));
          }}
          onBlur={() => setErrors((e) => ({ ...e, personnelNumber: validatePersonnelNumber(form.personnelNumber ?? "") }))}
        />
      </div>

      {/* Education & duties */}
      <p className="mb-2.5 mt-5 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[var(--fia-gray-400)]">
        Education & Duties
      </p>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Highest Education Level"
          value={form.educationLevel ?? ""}
          options={EDUCATION_LEVEL_OPTIONS}
          placeholder="Select education level"
          error={props.apiErrors?.educationLevel || ""}
          onChange={(v) => setField("educationLevel", (v as EducationLevel) || undefined)}
        />
        <Field
          label="Subject / Field of Study"
          value={form.qualifications ?? ""}
          helperText="e.g. Computer Science, Law, Arts"
          error={props.apiErrors?.qualifications || ""}
          onChange={(v) => setField("qualifications", v || undefined)}
        />
        <div className="col-span-2">
          <TextareaField
            label="Nature of Duties"
            value={form.natureOfDuties ?? ""}
            rows={2}
            helperText="Brief description of current duties"
            error={props.apiErrors?.natureOfDuties || ""}
            onChange={(v) => setField("natureOfDuties", v || undefined)}
          />
        </div>
        <div className="col-span-2">
          <TextareaField
            label="Training Courses (Text Summary)"
            value={form.trainingCoursesText ?? ""}
            rows={2}
            helperText="Free-text summary of courses attended"
            error={props.apiErrors?.trainingCoursesText || ""}
            onChange={(v) => setField("trainingCoursesText", v || undefined)}
          />
        </div>
      </div>

      {/* Language proficiencies */}
      <div className="mt-6">
        <button
          type="button"
          onClick={() => props.setShowLanguages(!props.showLanguages)}
          className="flex w-full items-center justify-between rounded-[16px] border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] px-4 py-3 text-sm font-semibold text-[var(--fia-gray-700)] hover:bg-white"
        >
          <span>Language Proficiencies ({(form.languages ?? employee.languages).length} added)</span>
          {props.showLanguages ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {props.showLanguages ? (
          <div className="mt-3 space-y-3">
            {(form.languages ?? []).map((lang, idx) => (
              <div key={idx} className="grid gap-3 rounded-[16px] border border-[var(--fia-gray-200)] bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
                <Field
                  label="Language"
                  value={lang.language}
                  onChange={(v) => {
                    const next = [...(form.languages ?? [])];
                    next[idx] = { ...next[idx], language: v };
                    setField("languages", next);
                  }}
                />
                <SelectField
                  label="Speaking"
                  value={lang.speaking}
                  options={LANG_LEVEL_OPTIONS}
                  onChange={(v) => {
                    const next = [...(form.languages ?? [])];
                    next[idx] = { ...next[idx], speaking: v as LanguageProficiencyLevel };
                    setField("languages", next);
                  }}
                />
                <SelectField
                  label="Reading"
                  value={lang.reading}
                  options={LANG_LEVEL_OPTIONS}
                  onChange={(v) => {
                    const next = [...(form.languages ?? [])];
                    next[idx] = { ...next[idx], reading: v as LanguageProficiencyLevel };
                    setField("languages", next);
                  }}
                />
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <SelectField
                      label="Writing"
                      value={lang.writing}
                      options={LANG_LEVEL_OPTIONS}
                      onChange={(v) => {
                        const next = [...(form.languages ?? [])];
                        next[idx] = { ...next[idx], writing: v as LanguageProficiencyLevel };
                        setField("languages", next);
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = (form.languages ?? []).filter((_, i) => i !== idx);
                      setField("languages", next);
                    }}
                    className="mb-0.5 flex h-[46px] w-10 items-center justify-center rounded-[12px] border border-[#FECACA] bg-[#FFF1F2] text-[#B42318]"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const next = [...(form.languages ?? []), { language: "", speaking: "NONE" as LanguageProficiencyLevel, reading: "NONE" as LanguageProficiencyLevel, writing: "NONE" as LanguageProficiencyLevel }];
                setField("languages", next);
              }}
              className="inline-flex items-center gap-2 rounded-[14px] border border-[var(--fia-gray-200)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--fia-navy)] hover:bg-[var(--fia-gray-50)]"
            >
              + Add Language
            </button>
          </div>
        ) : null}
      </div>

      {/* Training courses (structured) */}
      <div className="mt-4">
        <button
          type="button"
          onClick={() => props.setShowTrainingCourses(!props.showTrainingCourses)}
          className="flex w-full items-center justify-between rounded-[16px] border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] px-4 py-3 text-sm font-semibold text-[var(--fia-gray-700)] hover:bg-white"
        >
          <span>Training Courses (Structured) ({(form.trainingCourses ?? employee.trainingCourses).length} added)</span>
          {props.showTrainingCourses ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {props.showTrainingCourses ? (
          <div className="mt-3 space-y-3">
            {(form.trainingCourses ?? []).map((course, idx) => (
              <div key={idx} className="rounded-[16px] border border-[var(--fia-gray-200)] bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field
                    label="Course Name"
                    value={course.courseName}
                    onChange={(v) => {
                      const next = [...(form.trainingCourses ?? [])];
                      next[idx] = { ...next[idx], courseName: v };
                      setField("trainingCourses", next);
                    }}
                  />
                  <Field
                    label="Institution"
                    value={course.institution ?? ""}
                    onChange={(v) => {
                      const next = [...(form.trainingCourses ?? [])];
                      next[idx] = { ...next[idx], institution: v || undefined };
                      setField("trainingCourses", next);
                    }}
                  />
                  <DateField
                    label="From Date"
                    value={course.durationFrom ?? ""}
                    onChange={(v) => {
                      const next = [...(form.trainingCourses ?? [])];
                      next[idx] = { ...next[idx], durationFrom: v || undefined };
                      setField("trainingCourses", next);
                    }}
                  />
                  <DateField
                    label="To Date"
                    value={course.durationTo ?? ""}
                    onChange={(v) => {
                      const next = [...(form.trainingCourses ?? [])];
                      next[idx] = { ...next[idx], durationTo: v || undefined };
                      setField("trainingCourses", next);
                    }}
                  />
                  <Field
                    label="Country"
                    value={course.country ?? ""}
                    onChange={(v) => {
                      const next = [...(form.trainingCourses ?? [])];
                      next[idx] = { ...next[idx], country: v || undefined };
                      setField("trainingCourses", next);
                    }}
                  />
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        const next = (form.trainingCourses ?? []).filter((_, i) => i !== idx);
                        setField("trainingCourses", next);
                      }}
                      className="inline-flex items-center gap-2 rounded-[12px] border border-[#FECACA] bg-[#FFF1F2] px-4 py-2.5 text-sm font-semibold text-[#B42318]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const next = [...(form.trainingCourses ?? []), { courseName: "" }];
                setField("trainingCourses", next);
              }}
              className="inline-flex items-center gap-2 rounded-[14px] border border-[var(--fia-gray-200)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--fia-navy)] hover:bg-[var(--fia-gray-50)]"
            >
              + Add Training Course
            </button>
          </div>
        ) : null}
      </div>

      {props.error ? <p className="mt-4 text-sm text-[var(--fia-danger)]">{props.error}</p> : null}
    </PortalSurface>
  );
}

export function UserSettingsPage({
  initialTab = "profile",
  forcePasswordChange = false,
}: {
  initialTab?: SettingsTab;
  forcePasswordChange?: boolean;
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const signatureInputRef = useRef<HTMLInputElement | null>(null);
  const stampInputRef = useRef<HTMLInputElement | null>(null);
  const { user, setUser, setSidebarCollapsed } = useShell();
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [profileForm, setProfileForm] = useState({ displayName: "", email: "" });
  const [employeeForm, setEmployeeForm] = useState<UpdateEmployeeProfilePayload>({});
  const [showLanguages, setShowLanguages] = useState(false);
  const [showTrainingCourses, setShowTrainingCourses] = useState(false);
  const [notificationForm, setNotificationForm] = useState<UserNotificationPreferences>(DEFAULT_NOTIFICATION_PREFERENCES);
  const [displayForm, setDisplayForm] = useState<UserDisplayPreferences>(DEFAULT_DISPLAY_PREFERENCES);
  const [securityForm, setSecurityForm] = useState<UserSecurityPreferencesInput>({ twoFactorEnabled: false });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", nextPassword: "", confirmPassword: "" });
  const [avatarValidationError, setAvatarValidationError] = useState<string | null>(null);
  const [assetValidationErrors, setAssetValidationErrors] = useState<Partial<Record<UserAssetType, string | null>>>({});
  const [showForcePasswordBanner, setShowForcePasswordBanner] = useState(forcePasswordChange);
  const [employeeApiErrors, setEmployeeApiErrors] = useState<Record<string, string>>({});

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

    const emp = settingsQuery.data.employeeProfile;
    setEmployeeForm({
      gender: emp.gender ?? undefined,
      dateOfBirth: emp.dateOfBirth ? emp.dateOfBirth.substring(0, 10) : undefined,
      joiningDate: !emp.isLinked && emp.joiningDate ? emp.joiningDate.substring(0, 10) : undefined,
      fatherName: emp.fatherName ?? undefined,
      spouseName: emp.spouseName ?? undefined,
      mobile: emp.mobile || undefined,
      basicPay: emp.basicPay ?? undefined,
      appointmentToBpsDate: emp.appointmentToBpsDate ? emp.appointmentToBpsDate.substring(0, 10) : undefined,
      educationLevel: emp.educationLevel ?? undefined,
      qualifications: emp.qualifications ?? undefined,
      deputationType: emp.deputationType ?? undefined,
      natureOfDuties: emp.natureOfDuties ?? undefined,
      personnelNumber: emp.personnelNumber ?? undefined,
      serviceGroup: emp.serviceGroup ?? undefined,
      licenseType: emp.licenseType ?? undefined,
      vehicleType: emp.vehicleType ?? undefined,
      trainingCoursesText: emp.trainingCoursesText ?? undefined,
      trainingCourses: (emp.trainingCourses ?? []).map((c) => ({
        courseName: c.courseName,
        durationFrom: c.durationFrom ?? undefined,
        durationTo: c.durationTo ?? undefined,
        institution: c.institution ?? undefined,
        country: c.country ?? undefined,
      })),
      languages: emp.languages ?? [],
    });
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
  const employeeProfileMutation = useMutation({
    mutationFn: updateUserEmployeeProfile,
    onSuccess: (nextSettings) => {
      setEmployeeApiErrors({});
      syncSettings(nextSettings);
    },
    onError: (error: unknown) => {
      setEmployeeApiErrors(parseApiFieldErrors(error));
    },
  });
  const avatarMutation = useMutation({
    mutationFn: uploadUserProfileAvatar,
    onSuccess: (nextSettings) => {
      setAvatarValidationError(null);
      syncSettings(nextSettings);
    },
  });
  const profileAssetMutation = useMutation({
    mutationFn: ({ assetType, file }: { assetType: UserAssetType; file: File }) => uploadUserProfileAsset(assetType, file),
    onSuccess: (nextSettings, variables) => {
      setAssetValidationErrors((current) => ({ ...current, [variables.assetType]: null }));
      syncSettings(nextSettings);
    },
    onError: (error, variables) => {
      setAssetValidationErrors((current) => ({ ...current, [variables.assetType]: readErrorMessage(error) }));
    },
  });
  const removeProfileAssetMutation = useMutation({
    mutationFn: (assetType: UserAssetType) => removeUserProfileAsset(assetType),
    onSuccess: (nextSettings, assetType) => {
      setAssetValidationErrors((current) => ({ ...current, [assetType]: null }));
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
    onSuccess: () => {
      setPasswordForm({ currentPassword: "", nextPassword: "", confirmPassword: "" });
      setShowForcePasswordBanner(false);
      if (user) {
        const nextSession = { ...user, mustChangePassword: false };
        setUser(nextSession);
        queryClient.setQueryData(["session"], nextSession);
      }
    },
  });

  const currentSettings = settingsQuery.data;
  const avatarSrc = currentSettings?.profile.hasAvatar ? getCurrentUserAvatarUrl(currentSettings.profile.avatarVersion) : null;
  const avatarError = avatarValidationError ?? readErrorMessage(avatarMutation.error);
  const signatureAsset = currentSettings?.profile.signatureAsset ?? null;
  const stampAsset = currentSettings?.profile.stampAsset ?? null;
  const signaturePreviewUrl = signatureAsset ? getUserAssetContentUrl(signatureAsset.id) : null;
  const stampPreviewUrl = stampAsset ? getUserAssetContentUrl(stampAsset.id) : null;
  const canUseSignatureAndStamp =
    user?.activeRoleCode === "REPORTING_OFFICER" ||
    user?.activeRoleCode === "COUNTERSIGNING_OFFICER" ||
    user?.activeRoleCode === "ADDITIONAL_DIRECTOR" ||
    (user?.activeRoleCode === "SECRET_BRANCH" && Boolean(user?.secretBranchProfile?.canVerify));

  function handleProfileSave() {
    profileMutation.mutate({
      displayName: profileForm.displayName.trim(),
      email: profileForm.email.trim(),
    });
  }

  function handleEmployeeProfileSave() {
    employeeProfileMutation.mutate(employeeForm);
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

  function handleProfileAssetSelect(assetType: UserAssetType, file?: File | null) {
    if (!file) {
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAssetValidationErrors((current) => ({ ...current, [assetType]: "Please upload a JPG, PNG, or WEBP image." }));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setAssetValidationErrors((current) => ({ ...current, [assetType]: "Reusable signature and stamp files must be 2 MB or smaller." }));
      return;
    }

    setAssetValidationErrors((current) => ({ ...current, [assetType]: null }));
    profileAssetMutation.mutate({ assetType, file });
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
                    <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { handleAvatarSelect(event.target.files?.[0]); event.currentTarget.value = ""; }} />
                    <input ref={signatureInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { handleProfileAssetSelect("SIGNATURE", event.target.files?.[0]); event.currentTarget.value = ""; }} />
                    <input ref={stampInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => { handleProfileAssetSelect("STAMP", event.target.files?.[0]); event.currentTarget.value = ""; }} />
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

              {canUseSignatureAndStamp ? (
              <PortalSurface title="Reusable Signature & Official Stamp" subtitle="Save these once here, and the ACR workflow will auto-load them in your assigned reporting or countersigning sections. The same upload shortcuts are also available during form filling if something is missing.">
                <div className="grid gap-5 lg:grid-cols-2">
                  <AssetCard
                    title="Signature"
                    description="Used automatically in Reporting Officer or Countersigning Officer signature blocks when this account is assigned to the record."
                    icon={PenTool}
                    asset={signatureAsset}
                    previewUrl={signaturePreviewUrl}
                    validationError={assetValidationErrors.SIGNATURE ?? (profileAssetMutation.isError && profileAssetMutation.variables?.assetType === "SIGNATURE" ? readErrorMessage(profileAssetMutation.error) : removeProfileAssetMutation.isError && removeProfileAssetMutation.variables === "SIGNATURE" ? readErrorMessage(removeProfileAssetMutation.error) : null)}
                    busyUpload={profileAssetMutation.isPending && profileAssetMutation.variables?.assetType === "SIGNATURE"}
                    busyRemove={removeProfileAssetMutation.isPending && removeProfileAssetMutation.variables === "SIGNATURE"}
                    successMessage={profileAssetMutation.isSuccess && profileAssetMutation.variables?.assetType === "SIGNATURE" ? "Reusable signature updated successfully." : removeProfileAssetMutation.isSuccess && removeProfileAssetMutation.variables === "SIGNATURE" ? "Reusable signature removed." : null}
                    onUploadClick={() => signatureInputRef.current?.click()}
                    onRemove={() => removeProfileAssetMutation.mutate("SIGNATURE")}
                  />
                  <AssetCard
                    title="Official Stamp"
                    description="Used automatically where the approved form family requires an official stamp for your reviewer section."
                    icon={Stamp}
                    asset={stampAsset}
                    previewUrl={stampPreviewUrl}
                    validationError={assetValidationErrors.STAMP ?? (profileAssetMutation.isError && profileAssetMutation.variables?.assetType === "STAMP" ? readErrorMessage(profileAssetMutation.error) : removeProfileAssetMutation.isError && removeProfileAssetMutation.variables === "STAMP" ? readErrorMessage(removeProfileAssetMutation.error) : null)}
                    busyUpload={profileAssetMutation.isPending && profileAssetMutation.variables?.assetType === "STAMP"}
                    busyRemove={removeProfileAssetMutation.isPending && removeProfileAssetMutation.variables === "STAMP"}
                    successMessage={profileAssetMutation.isSuccess && profileAssetMutation.variables?.assetType === "STAMP" ? "Reusable official stamp updated successfully." : removeProfileAssetMutation.isSuccess && removeProfileAssetMutation.variables === "STAMP" ? "Reusable official stamp removed." : null}
                    onUploadClick={() => stampInputRef.current?.click()}
                    onRemove={() => removeProfileAssetMutation.mutate("STAMP")}
                  />
                </div>
              </PortalSurface>
              ) : null}

              <ServiceRecordSection
                employee={currentSettings.employeeProfile}
                form={employeeForm}
                setForm={setEmployeeForm}
                showLanguages={showLanguages}
                setShowLanguages={setShowLanguages}
                showTrainingCourses={showTrainingCourses}
                setShowTrainingCourses={setShowTrainingCourses}
                onSave={handleEmployeeProfileSave}
                isPending={employeeProfileMutation.isPending}
                isSuccess={employeeProfileMutation.isSuccess}
                error={employeeProfileMutation.isError ? readErrorMessage(employeeProfileMutation.error) : null}
              />
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
              {showForcePasswordBanner ? (
                <PortalSurface className="border-[#FDE68A] bg-[linear-gradient(135deg,#FFFBEA_0%,#FFFFFF_100%)]">
                  <div className="flex items-start gap-3">
                    <Info size={18} className="mt-0.5 text-[#B45309]" />
                    <div>
                      <p className="text-sm font-semibold text-[#92400E]">Password change required</p>
                      <p className="mt-1 text-sm leading-6 text-[#A16207]">
                        This account was provisioned or reset with a temporary password. Update it here before continuing regular portal work.
                      </p>
                    </div>
                  </div>
                </PortalSurface>
              ) : null}

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
