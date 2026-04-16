"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Plus,
  Search,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { createAcr, createEmployee, getEmployees, getManualEmployeeOptions, getReferencePostings, getReferenceZonesCircles, transitionAcr } from "@/api/client";
import { FormPreview } from "@/components/FormPreview";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/SearchableSelect";
import { FloatingToast } from "@/components/ui";
import { useShell } from "@/hooks/useShell";
import type {
  AcrClerkSection,
  AcrFormData,
  AcrReplicaState,
  AcrReviewerContext,
  DeputationType,
  EmployeeSummary,
  Gender,
  ManualEmployeePayload,
  TemplateFamilyCode,
  UnlinkedUserSummary,
} from "@/types/contracts";
import { manualTemplateOptions, suggestTemplateByBps, templateLabels, templateRequiresCountersigning } from "@/utils/templates";

type StepKey = 1 | 2 | 3;
type EmployeeSource = "directory" | "manual";
type PageToast = { title: string; message?: string; tone?: "success" | "info" | "warning" | "danger" } | null;

const stepMeta: Array<{ key: StepKey; title: string }> = [
  { key: 1, title: "Employee Search" },
  { key: 2, title: "Fill Form" },
  { key: 3, title: "Review & Submit" },
];

// Button variants imported from @/components/ui/Button — these string constants kept for backward compat with inline usage
const actionButtonBase =
  "group inline-flex cursor-pointer items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 [&_svg]:transition-transform hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] hover:[&_svg]:scale-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none";
const actionButtonSecondary = `${actionButtonBase} border border-[var(--fia-border,#D8DEE8)] bg-white dark:bg-slate-800 dark:border-slate-700 text-[var(--fia-text-secondary,#475569)] dark:text-slate-300`;
const actionButtonInfo = `${actionButtonBase} border border-[var(--fia-cyan,#0095D9)] bg-[var(--fia-cyan-bg,#EEF8FF)] text-[var(--fia-info-text,#0369A1)]`;
const actionButtonPrimary = `${actionButtonBase} bg-gradient-to-r from-[#1A1C6E] to-[#2D308F] text-white shadow-[0_4px_14px_rgba(26,28,110,0.30)] hover:shadow-[0_6px_20px_rgba(26,28,110,0.40)] hover:from-[#2D308F] hover:to-[#3D40B0]`;
const actionButtonAccent = `${actionButtonBase} bg-gradient-to-r from-[#0095D9] to-[#0077B6] text-white shadow-[0_4px_14px_rgba(0,149,217,0.30)] hover:shadow-[0_6px_20px_rgba(0,149,217,0.40)] hover:from-[#0077B6] hover:to-[#005F96]`;

const initialManualState: ManualEmployeePayload = {
  name: "",
  rank: manualTemplateOptions[2].rank,
  designation: manualTemplateOptions[2].designation,
  bps: manualTemplateOptions[2].defaultBps,
  cnic: "",
  mobile: "",
  email: "",
  posting: "",
  joiningDate: "",
  address: "",
  templateFamily: manualTemplateOptions[2].templateFamily,
  officeId: "",
  departmentId: "",
  reportingOfficerId: "",
  countersigningOfficerId: "",
};

function getDefaultClerkSection(): AcrClerkSection {
  const year = new Date().getFullYear();
  return {
    periodFrom: `${year}-01-01`,
    periodTo: `${year}-12-31`,
    zoneCircle: "",
    directDeputationist: "",
    fatherName: "",
    trainingCourses: "",
    departmentalEnquiry: "",
    punishment: "",
    rewards: "",
    remarks: "",
    isPriority: false,
  };
}

function createInitialReplicaState(): AcrReplicaState {
  return {
    textFields: {},
    checkFields: {},
    assetFields: {},
  };
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getAvatarColor(name: string): string {
  const palette = [
    "#1A1C6E", "#0095D9", "#7C3AED", "#BE185D", "#059669",
    "#D97706", "#0891B2", "#DC2626", "#7E22CE", "#0369A1",
  ];
  const sum = name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return palette[sum % palette.length];
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function formatCnicInput(value: string) {
  const digits = digitsOnly(value).slice(0, 13);

  if (digits.length <= 5) {
    return digits;
  }

  if (digits.length <= 12) {
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  }

  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

function formatMobileInput(value: string) {
  const digits = digitsOnly(value).slice(0, 11);

  if (digits.length <= 4) {
    return digits;
  }

  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function normalizeInlineText(value: string) {
  return value.replace(/\s{2,}/g, " ").replace(/^\s+/, "");
}

function normalizeMultilineText(value: string) {
  return value
    .split("\n")
    .map((line) => line.replace(/\s{2,}/g, " ").replace(/^\s+/, ""))
    .join("\n");
}

function isValidCnic(value: string) {
  return /^\d{5}-\d{7}-\d$/.test(value);
}

function isValidMobile(value: string) {
  return /^03\d{2}-\d{7}$/.test(value);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getFieldClasses(invalid: boolean, muted = false) {
  return `mt-2 w-full rounded-2xl border px-4 py-3 outline-none transition-all text-[var(--fia-gray-900)] ${
    muted ? "bg-[var(--fia-gray-50)]" : "bg-[var(--card)]"
  } ${
    invalid
      ? "border-[var(--fia-danger)] focus:border-[var(--fia-danger)] focus:ring-4 focus:ring-[var(--fia-danger-bg)]"
      : "border-[var(--fia-border)] focus:border-[var(--fia-cyan)] focus:ring-4 focus:ring-[var(--fia-cyan-50)]"
  }`;
}

function ZoneCircleComboField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: options = [] } = useQuery({
    queryKey: ["reference-zones-circles"],
    queryFn: getReferenceZonesCircles,
    staleTime: 5 * 60 * 1000,
  });
  const trimmed = value.trim().toLowerCase();
  const filtered = trimmed ? options.filter((o) => o.toLowerCase().includes(trimmed)) : options;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative text-sm text-[#475569]" ref={ref}>
      <label>
        <span>Zone / Circle / Sub-Circle</span>
        <div className="relative">
          <input
            value={value}
            onChange={(e) => { onChange(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            maxLength={100}
            placeholder="Type or select zone/circle"
            aria-label="Zone Circle"
            className={`${getFieldClasses(false, true)} pr-10`}
          />
          <button type="button" tabIndex={-1} onClick={() => setOpen((c) => !c)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points={open ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
            </svg>
          </button>
        </div>
      </label>
      {open && filtered.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-[var(--fia-border,#D8DEE8)] bg-[var(--fia-gray-50,#F8FAFC)] shadow-xl">
          <div className="max-h-48 overflow-y-auto overscroll-contain">
            {filtered.map((opt) => (
              <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false); }} className={`block w-full px-4 py-2.5 text-left text-sm transition ${value === opt ? "bg-[var(--fia-cyan-bg,#EEF8FF)] font-semibold text-[var(--fia-cyan,#0095D9)]" : "text-[var(--fia-gray-800,#1f2937)] hover:bg-[var(--fia-gray-100,#F3F4F6)]"}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PostingComboField({ value, onChange, invalid }: { value: string; onChange: (v: string) => void; invalid: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: postingOptions = [] } = useQuery({
    queryKey: ["reference-postings"],
    queryFn: getReferencePostings,
    staleTime: 5 * 60 * 1000,
  });
  const trimmed = value.trim().toLowerCase();
  const filtered = trimmed
    ? postingOptions.filter((opt) => opt.toLowerCase().includes(trimmed))
    : postingOptions;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative text-sm text-[#475569]" ref={ref}>
      <label>
        <span>
          Posting<span className="ml-1 text-[#DC2626]">*</span>
        </span>
        <div className="relative">
          <input
            value={value}
            onChange={(e) => { onChange(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            maxLength={100}
            placeholder="Type or select posting"
            aria-label="Posting"
            aria-invalid={invalid}
            className={`${getFieldClasses(invalid)} pr-10`}
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setOpen((c) => !c)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#64748B]"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points={open ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
            </svg>
          </button>
        </div>
      </label>
      {open && filtered.length > 0 ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-2xl border border-[var(--fia-border,#D8DEE8)] bg-[var(--fia-gray-50,#F8FAFC)] shadow-xl">
          <div className="max-h-48 overflow-y-auto overscroll-contain">
            {filtered.map((opt) => {
              const isSelected = value === opt;
              return (
                <button
                  key={opt}
                  type="button"
                  onClick={() => { onChange(opt); setOpen(false); }}
                  className={`block w-full px-4 py-2.5 text-left text-sm transition ${
                    isSelected
                      ? "bg-[var(--fia-cyan-bg,#EEF8FF)] font-semibold text-[var(--fia-cyan,#0095D9)]"
                      : "text-[var(--fia-gray-800,#1f2937)] hover:bg-[var(--fia-gray-100,#F3F4F6)]"
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getManualEmployeeValidationMessage(employee: ManualEmployeePayload, needsCountersigning: boolean) {
  if (!employee.name.trim()) {
    return "Full name is required before adding the employee.";
  }

  if (!isValidCnic(employee.cnic)) {
    return "Enter a valid CNIC in 12345-1234567-1 format.";
  }

  if (!isValidMobile(employee.mobile)) {
    return "Enter a valid mobile number in 03xx-xxxxxxx format.";
  }

  if (employee.email && !isValidEmail(employee.email)) {
    return "Enter a valid email address or leave the email field blank.";
  }

  if (!employee.posting.trim()) {
    return "Posting is required before adding the employee.";
  }

  if (!employee.joiningDate) {
    return "Joining date is required before adding the employee.";
  }

  if (!employee.officeId) {
    return "Select the office before adding the employee.";
  }

  if (!employee.reportingOfficerId) {
    return "Assign the reporting officer before adding the employee.";
  }

  if (needsCountersigning && !employee.countersigningOfficerId) {
    return "Assign the countersigning officer before adding the employee.";
  }

  if (
    needsCountersigning &&
    employee.reportingOfficerId &&
    employee.countersigningOfficerId &&
    employee.reportingOfficerId === employee.countersigningOfficerId
  ) {
    return "Reporting Officer and Countersigning Officer must be different users.";
  }

  if (!employee.address.trim()) {
    return "Address is required before adding the employee.";
  }

  return null;
}

function hasManualEmployeeRequiredFields(employee: ManualEmployeePayload, needsCountersigning: boolean) {
  return !getManualEmployeeValidationMessage(employee, needsCountersigning);
}

function mapOfficeOption(option: {
  id: string;
  name: string;
  code: string;
  scopeTrack: "REGIONAL" | "WING";
  wingName?: string | null;
  directorateName?: string | null;
  regionName?: string | null;
  zoneName?: string | null;
  branchName?: string | null;
  cellName?: string | null;
  departments: Array<{ id: string; name: string; code: string }>;
}): SearchableSelectOption {
  const segments = option.scopeTrack === "WING"
    ? [option.directorateName, option.wingName]
    : [option.cellName, option.branchName, option.zoneName, option.regionName];

  return {
    id: option.id,
    label: option.name,
    description: segments.filter(Boolean).join(" · "),
    meta: option.code,
    departments: option.departments,
  };
}

function mapOfficerOption(option: {
  id: string;
  displayName: string;
  badgeNo: string;
  officeName?: string | null;
  zoneName?: string | null;
  wingName?: string | null;
  scopeLabel: string;
}): SearchableSelectOption {
  const location = option.officeName ?? option.zoneName ?? option.wingName ?? "FIA";

  return {
    id: option.id,
    label: option.displayName,
    description: `${location} · Badge ${option.badgeNo}`,
    meta: option.scopeLabel,
  };
}

export default function NewAcrPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useShell();
  const [step, setStep] = useState<StepKey>(1);
  const [search, setSearch] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedEmployeeRecord, setSelectedEmployeeRecord] = useState<EmployeeSummary | null>(null);
  const [employeeSource, setEmployeeSource] = useState<EmployeeSource>("directory");
  const [manualMode, setManualMode] = useState(false);
  const [manualTemplateId, setManualTemplateId] = useState(manualTemplateOptions[2].id);
  const [manualEmployee, setManualEmployee] = useState<ManualEmployeePayload>(initialManualState);
  const [clerkSection, setClerkSection] = useState<AcrClerkSection>(() => getDefaultClerkSection());
  const [replicaStateSeed, setReplicaStateSeed] = useState<AcrReplicaState>(() => createInitialReplicaState());
  const replicaStateRef = useRef<AcrReplicaState>(createInitialReplicaState());
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [pageToast, setPageToast] = useState<PageToast>(null);
  const [showMetadata, setShowMetadata] = useState(false);
  const [templateFamilyOverride, setTemplateFamilyOverride] = useState<TemplateFamilyCode | null>(null);
  const deferredSearch = useDeferredValue(search);
  const canInitiate = !user || ["CLERK", "SUPER_ADMIN", "IT_OPS"].includes(user.activeRoleCode);

  const { data, isFetching: employeesFetching } = useQuery({
    queryKey: ["employees", deferredSearch],
    queryFn: () => getEmployees(deferredSearch),
  });

  const { data: manualOptions, isLoading: manualOptionsLoading, error: manualOptionsError } = useQuery({
    queryKey: ["manual-employee-options", manualEmployee.officeId || "all"],
    queryFn: () => getManualEmployeeOptions(manualEmployee.officeId || undefined),
    enabled: manualMode,
  });

  const employees = data?.items ?? [];
  const unlinkedUsers: UnlinkedUserSummary[] = data?.unlinkedUsers ?? [];
  const selectedEmployee = useMemo(() => {
    const fromDirectory = employees.find((employee) => employee.id === selectedEmployeeId);
    return fromDirectory ?? (selectedEmployeeRecord?.id === selectedEmployeeId ? selectedEmployeeRecord : null);
  }, [employees, selectedEmployeeId, selectedEmployeeRecord]);

  const previewTemplateFamily = templateFamilyOverride ?? selectedEmployee?.templateFamily ?? manualEmployee.templateFamily;
  const overrideIsDeviation = templateFamilyOverride !== null && templateFamilyOverride !== selectedEmployee?.templateFamily;
  const requiresCountersigningSelection = templateRequiresCountersigning(previewTemplateFamily);
  const manualEmployeeValidationMessage = getManualEmployeeValidationMessage(
    manualEmployee,
    requiresCountersigningSelection,
  );
  const canAddManualEmployee = hasManualEmployeeRequiredFields(manualEmployee, requiresCountersigningSelection);
  const canPersistDraft = Boolean(selectedEmployeeId);
  const officeOptions = useMemo(
    () => (manualOptions?.offices ?? []).map((option) => mapOfficeOption(option)),
    [manualOptions?.offices],
  );
  const reportingOfficerOptions = useMemo(
    () => (manualOptions?.reportingOfficers ?? []).map((option) => mapOfficerOption(option)),
    [manualOptions?.reportingOfficers],
  );
  const countersigningOfficerOptions = useMemo(
    () => (manualOptions?.countersigningOfficers ?? []).map((option) => mapOfficerOption(option)),
    [manualOptions?.countersigningOfficers],
  );

  useEffect(() => {
    if (!requiresCountersigningSelection && manualEmployee.countersigningOfficerId) {
      setManualEmployee((current) => ({ ...current, countersigningOfficerId: "" }));
    }
  }, [manualEmployee.countersigningOfficerId, requiresCountersigningSelection]);

  useEffect(() => {
    if (!pageToast) {
      return;
    }

    const timer = window.setTimeout(() => setPageToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pageToast]);

  useEffect(() => {
    if (!manualMode) {
      return;
    }

    if (
      manualEmployee.reportingOfficerId &&
      !reportingOfficerOptions.some((option) => option.id === manualEmployee.reportingOfficerId)
    ) {
      setManualEmployee((current) => ({ ...current, reportingOfficerId: "" }));
    }

    if (
      manualEmployee.countersigningOfficerId &&
      !countersigningOfficerOptions.some((option) => option.id === manualEmployee.countersigningOfficerId)
    ) {
      setManualEmployee((current) => ({ ...current, countersigningOfficerId: "" }));
    }
  }, [
    countersigningOfficerOptions,
    manualEmployee.countersigningOfficerId,
    manualEmployee.reportingOfficerId,
    manualMode,
    reportingOfficerOptions,
  ]);

  const addEmployeeMutation = useMutation({
    mutationFn: () => createEmployee(manualEmployee),
    onSuccess: (createdEmployee) => {
      queryClient.setQueryData(["employees", ""], (current: { items: EmployeeSummary[]; total: number; unlinkedUsers?: UnlinkedUserSummary[] } | undefined) => {
        if (!current) {
          return current;
        }

        const items = [createdEmployee, ...current.items.filter((employee) => employee.id !== createdEmployee.id)];
        return { ...current, items, total: items.length };
      });
      queryClient.setQueryData(
        ["employees", createdEmployee.name],
        { items: [createdEmployee], total: 1, unlinkedUsers: [] },
      );
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setSelectedEmployeeRecord(createdEmployee);
      setSelectedEmployeeId(createdEmployee.id);
      setEmployeeSource("manual");
      setManualMode(false);
      setSearch(createdEmployee.name);
      setValidationMessage(null);
      // Populate clerk section from the just-created employee's metadata so the
      // clerk doesn't have to re-enter info they already provided in the short form.
      setClerkSection((current) => {
        const mappedDep = mapDeputationType(manualEmployee.deputationType);
        const fatherOrSpouse = manualEmployee.fatherName ?? "";
        return {
          ...current,
          directDeputationist: current.directDeputationist || mappedDep || "Direct",
          fatherName: current.fatherName || fatherOrSpouse,
          trainingCourses: current.trainingCourses || manualEmployee.trainingCoursesText || "",
        };
      });
      setPageToast({
        title: "Employee added to master database",
        message:
          "The clerk completes only the initiation section. Reporting Officer and Countersigning Officer assignments will now follow the exact people you selected for this employee.",
        tone: "success",
      });
    },
    onError: (error: Error) => {
      setValidationMessage(error.message);
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async ({ submitToReporting }: { submitToReporting: boolean }) => {
      if (!selectedEmployeeId || !selectedEmployee) {
        throw new Error("Select an employee record before creating the ACR.");
      }

        const created = await createAcr({
          employeeId: selectedEmployeeId,
          reportingPeriodFrom: clerkSection.periodFrom,
          reportingPeriodTo: clerkSection.periodTo,
          isPriority: clerkSection.isPriority,
          formData: draftFormData,
          ...(templateFamilyOverride !== null && { templateFamilyOverride }),
        });

      if (submitToReporting) {
        await transitionAcr(created.id, { action: "submit_to_reporting" });
      }

      return created;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["dashboard-overview"] });
      queryClient.invalidateQueries({ queryKey: ["acrs"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      router.push(`/acr/${created.id}`);
    },
    onError: (error: Error) => {
      setPageToast({
        title: "Cannot create ACR",
        message: error.message,
        tone: "danger",
      });
    },
  });

  function handleManualTemplateChange(templateId: string) {
    const template = manualTemplateOptions.find((option) => option.id === templateId) ?? manualTemplateOptions[2];
    setManualTemplateId(template.id);
    setManualEmployee((current) => ({
      ...current,
      rank: template.rank,
      designation: template.designation,
      bps: template.defaultBps,
      templateFamily: template.templateFamily,
      countersigningOfficerId: templateRequiresCountersigning(template.templateFamily) ? current.countersigningOfficerId : "",
    }));
  }

  function updateManualEmployee<K extends keyof ManualEmployeePayload>(field: K, value: ManualEmployeePayload[K]) {
    let nextValue = value;

    if (typeof value === "string") {
      switch (field) {
        case "cnic":
          nextValue = formatCnicInput(value) as ManualEmployeePayload[K];
          break;
        case "mobile":
          nextValue = formatMobileInput(value) as ManualEmployeePayload[K];
          break;
        case "address":
          nextValue = normalizeMultilineText(value) as ManualEmployeePayload[K];
          break;
        case "email":
          nextValue = value.trimStart() as ManualEmployeePayload[K];
          break;
        default:
          nextValue = normalizeInlineText(value) as ManualEmployeePayload[K];
          break;
      }
    }

    setManualEmployee((current) => ({ ...current, [field]: nextValue }));
  }

  function updateClerkSection<K extends keyof AcrClerkSection>(field: K, value: AcrClerkSection[K]) {
    let nextValue = value;

    if (typeof value === "string") {
      switch (field) {
        case "trainingCourses":
        case "departmentalEnquiry":
        case "punishment":
        case "rewards":
        case "remarks":
          nextValue = normalizeMultilineText(value) as AcrClerkSection[K];
          break;
        case "periodFrom":
        case "periodTo":
          nextValue = value as AcrClerkSection[K];
          break;
        default:
          nextValue = normalizeInlineText(value) as AcrClerkSection[K];
          break;
      }
    }

    setClerkSection((current) => ({ ...current, [field]: nextValue }));
  }

  function openManualMode() {
    setManualMode(true);
    setSelectedEmployeeId("");
    setSelectedEmployeeRecord(null);
    setEmployeeSource("manual");
    const nextReplicaState = createInitialReplicaState();
    replicaStateRef.current = nextReplicaState;
    setReplicaStateSeed(nextReplicaState);
    setValidationMessage(null);

    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      const isCnic = /^\d{5}-?\d{7}-?\d?$/.test(trimmedSearch);
      const isMobile = /^03\d{2}-?\d{7}$/.test(trimmedSearch);
      if (isCnic) {
        setManualEmployee((current) => ({ ...current, cnic: formatCnicInput(trimmedSearch) }));
      } else if (isMobile) {
        setManualEmployee((current) => ({ ...current, mobile: formatMobileInput(trimmedSearch) }));
      } else {
        setManualEmployee((current) => ({ ...current, name: trimmedSearch }));
      }
    }
  }

  function selectUnlinkedUser(userAccount: UnlinkedUserSummary) {
    setManualMode(true);
    setSelectedEmployeeId("");
    setSelectedEmployeeRecord(null);
    setEmployeeSource("manual");
    setTemplateFamilyOverride(null);
    const nextReplicaState = createInitialReplicaState();
    replicaStateRef.current = nextReplicaState;
    setReplicaStateSeed(nextReplicaState);
    setValidationMessage(null);

    const meta = userAccount.selfReportedMetadata;
    setManualEmployee((current) => ({
      ...current,
      userId: userAccount.id,
      name: userAccount.displayName,
      email: userAccount.email,
      mobile: userAccount.mobileNumber ? formatMobileInput(userAccount.mobileNumber) : current.mobile,
      ...(userAccount.cnic ? { cnic: formatCnicInput(userAccount.cnic) } : {}),
      ...(userAccount.departmentId ? { departmentId: userAccount.departmentId } : {}),
      // Pre-fill Additional Information from self-reported metadata saved via settings
      ...(meta?.gender !== undefined && meta.gender !== null ? { gender: meta.gender } : {}),
      ...(meta?.dateOfBirth ? { dateOfBirth: meta.dateOfBirth.slice(0, 10) } : {}),
      ...(meta?.joiningDate ? { joiningDate: meta.joiningDate.slice(0, 10) } : {}),
      ...(meta?.basicPay != null ? { basicPay: meta.basicPay } : {}),
      ...(meta?.appointmentToBpsDate ? { appointmentToBpsDate: meta.appointmentToBpsDate.slice(0, 10) } : {}),
      ...(meta?.educationLevel ? { educationLevel: meta.educationLevel } : {}),
      ...(meta?.qualifications ? { qualifications: meta.qualifications } : {}),
      ...(meta?.fatherName ? { fatherName: meta.fatherName } : {}),
      ...(meta?.deputationType ? { deputationType: meta.deputationType } : {}),
      ...(meta?.natureOfDuties ? { natureOfDuties: meta.natureOfDuties } : {}),
      ...(meta?.personnelNumber ? { personnelNumber: meta.personnelNumber } : {}),
      ...(meta?.serviceGroup ? { serviceGroup: meta.serviceGroup } : {}),
      ...(meta?.licenseType ? { licenseType: meta.licenseType } : {}),
      ...(meta?.vehicleType ? { vehicleType: meta.vehicleType } : {}),
      ...(meta?.trainingCoursesText ? { trainingCoursesText: meta.trainingCoursesText } : {}),
    }));
  }

  function mapDeputationType(val: string | null | undefined): string {
    if (val === "DIRECT") return "Direct";
    if (val === "DEPUTATIONIST") return "Deputationist";
    return "";
  }

  function selectEmployee(employee: EmployeeSummary) {
    setManualMode(false);
    setSelectedEmployeeId(employee.id);
    setSelectedEmployeeRecord(null);
    setEmployeeSource("directory");
    setTemplateFamilyOverride(null);
    const nextReplicaState = createInitialReplicaState();
    replicaStateRef.current = nextReplicaState;
    setReplicaStateSeed(nextReplicaState);
    setValidationMessage(null);

    const zoneCircleParts = [employee.zone, employee.circle].filter(Boolean);
    const mappedDeputationType = mapDeputationType(employee.deputationType);
    const fatherOrSpouse = employee.fatherName ?? ((employee as unknown as Record<string, unknown>).spouseName as string | null) ?? "";
    setClerkSection((current) => ({
      ...current,
      zoneCircle: current.zoneCircle || (zoneCircleParts.length > 0 ? zoneCircleParts.join(" / ") : ""),
      directDeputationist: current.directDeputationist || mappedDeputationType || "Direct",
      fatherName: current.fatherName || fatherOrSpouse || "",
      trainingCourses: current.trainingCourses || employee.trainingCoursesText || "",
    }));
  }

  function handleAddManualEmployee() {
    if (!canAddManualEmployee) {
      setValidationMessage(manualEmployeeValidationMessage ?? "Complete the employee record before adding it to master data.");
      return;
    }

    addEmployeeMutation.mutate();
  }

  function validateStep(currentStep: StepKey) {
    if (currentStep === 1) {
      if (manualMode && !selectedEmployeeId) {
        if (manualEmployeeValidationMessage) {
          setValidationMessage(manualEmployeeValidationMessage);
          return false;
        }

        setValidationMessage("Add the employee to the master database before moving to the clerk section.");
        return false;
      }

      if (!selectedEmployeeId) {
        setValidationMessage("Select an employee from the database or create one through the manual add flow.");
        return false;
      }
    }

    if (currentStep === 2) {
      if (!clerkSection.periodFrom || !clerkSection.periodTo) {
        setValidationMessage("Reporting period is required before review and submission.");
        return false;
      }

      if (clerkSection.periodFrom > clerkSection.periodTo) {
        setValidationMessage("Reporting period end date cannot be earlier than the start date.");
        return false;
      }

      const fromYear = new Date(clerkSection.periodFrom).getFullYear();
      const toYear = new Date(clerkSection.periodTo).getFullYear();
      if (fromYear !== toYear) {
        setValidationMessage("Reporting period cannot span multiple calendar years. Each ACR must cover a single calendar year as per FIA Standing Order No. 02/2023.");
        return false;
      }

      const from = new Date(clerkSection.periodFrom);
      const to = new Date(clerkSection.periodTo);
      const monthsDiff = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
      if (monthsDiff < 3) {
        setValidationMessage("Reporting period must be at least three (3) months as per FIA Standing Order No. 02/2023.");
        return false;
      }
    }

    setValidationMessage(null);
    return true;
  }

  const selectedOfficeOption = officeOptions.find((option) => option.id === manualEmployee.officeId);
  const selectedReportingOfficerOption = reportingOfficerOptions.find((option) => option.id === manualEmployee.reportingOfficerId);
  const selectedCountersigningOfficerOption = countersigningOfficerOptions.find(
    (option) => option.id === manualEmployee.countersigningOfficerId,
  );
  const showManualFieldValidation = manualMode && Boolean(validationMessage);
  const showClerkFieldValidation = step >= 2 && Boolean(validationMessage);
  const invalidManualFields = {
    name: showManualFieldValidation && !manualEmployee.name.trim(),
    cnic: showManualFieldValidation && !isValidCnic(manualEmployee.cnic),
    mobile: showManualFieldValidation && !isValidMobile(manualEmployee.mobile),
    email: showManualFieldValidation && Boolean(manualEmployee.email) && !isValidEmail(manualEmployee.email ?? ""),
    posting: showManualFieldValidation && !manualEmployee.posting.trim(),
    joiningDate: showManualFieldValidation && !manualEmployee.joiningDate,
    office: showManualFieldValidation && !manualEmployee.officeId,
    reportingOfficer: showManualFieldValidation && !manualEmployee.reportingOfficerId,
    countersigningOfficer: showManualFieldValidation && requiresCountersigningSelection && !manualEmployee.countersigningOfficerId,
    duplicateOfficer:
      showManualFieldValidation &&
      requiresCountersigningSelection &&
      Boolean(manualEmployee.reportingOfficerId) &&
      Boolean(manualEmployee.countersigningOfficerId) &&
      manualEmployee.reportingOfficerId === manualEmployee.countersigningOfficerId,
    address: showManualFieldValidation && !manualEmployee.address.trim(),
  };
  const invalidClerkFields = {
    periodFrom: showClerkFieldValidation && !clerkSection.periodFrom,
    periodTo: showClerkFieldValidation && (!clerkSection.periodTo || clerkSection.periodFrom > clerkSection.periodTo),
  };

  const employeeName = (selectedEmployee?.name ?? manualEmployee.name) || "Not selected";
  const employeeRank = (selectedEmployee?.rank ?? manualEmployee.rank) || "Not selected";
  const employeeBps = selectedEmployee ? `BPS-${selectedEmployee.bps}` : `BPS-${manualEmployee.bps}`;
  const employeeCnic = (selectedEmployee?.cnic ?? manualEmployee.cnic) || "Not selected";
  const employeeMobile = (selectedEmployee?.mobile ?? manualEmployee.mobile) || "Not selected";
  const employeeWing =
    selectedEmployee?.region ??
    selectedEmployee?.wing ??
    manualOptions?.offices.find((option) => option.id === manualEmployee.officeId)?.regionName ??
    manualOptions?.offices.find((option) => option.id === manualEmployee.officeId)?.wingName ??
    user?.scope.wingName ??
    "Not selected";
  const employeeOffice =
    selectedEmployee?.office ??
    selectedOfficeOption?.label ??
    user?.scope.officeName ??
    "Not selected";
  const reportingOfficer =
    selectedEmployee?.reportingOfficer ??
    selectedReportingOfficerOption?.label ??
    "Not assigned";
  const countersigningOfficer = requiresCountersigningSelection
    ? selectedEmployee?.countersigningOfficer ?? selectedCountersigningOfficerOption?.label ?? "Not assigned"
    : "Not applicable";
  const reviewerContext: AcrReviewerContext = {
    reporting: {
      name: reportingOfficer,
      designation: selectedEmployee?.reportingOfficerDesignation ?? "Reporting Officer",
    },
    countersigning: requiresCountersigningSelection
      ? {
          name: countersigningOfficer,
          designation: selectedEmployee?.countersigningOfficerDesignation ?? "Countersigning Officer",
        }
      : null,
  };
  const draftFormData: AcrFormData = {
    source: employeeSource,
    clerkSection,
    employeeSnapshot: selectedEmployee ?? null,
    replicaState: replicaStateRef.current,
  };

  if (!canInitiate) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-5">
        <h1 className="text-[1.75rem] font-semibold text-[var(--fia-gray-900)]">Initiate New ACR / PER</h1>
        <div className="rounded-[24px] border border-[var(--fia-warning-bg)] bg-[var(--fia-warning-bg)] px-5 py-4">
          <p className="text-base font-semibold text-[var(--fia-warning)]">Initiation is restricted to the clerk stage.</p>
          <p className="mt-2 text-sm text-[var(--fia-warning)]">
            Your active role can review or process records in its own queue, but only Clerk or system administration roles can start a new ACR.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-screen-2xl flex-col gap-5 p-5">
      <FloatingToast
        visible={Boolean(pageToast)}
        title={pageToast?.title ?? ""}
        message={pageToast?.message}
        tone={pageToast?.tone}
      />
      <div data-testid="acr-creation-header">
        <span className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-[var(--fia-navy-50)] px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[var(--fia-navy-500)] dark:text-[var(--fia-cyan)]">
          New Submission
        </span>
        <h1 className="text-[1.75rem] font-bold text-[var(--fia-gray-900)]">Initiate New ACR / PER</h1>
        <p className="mt-1 text-sm text-[var(--fia-text-secondary)]">
          Annual Confidential Report — {user?.scope.wingName ?? "Immigration Wing"}
        </p>
      </div>

      <section className="rounded-[24px] border border-[var(--fia-gray-200)] bg-[var(--card)] px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          {stepMeta.map((entry, index) => {
            const state = step > entry.key ? "complete" : step === entry.key ? "active" : "upcoming";
            const subtitles = ["Find employee record", "Enter clerk-stage data", "Confirm & forward"];
            const circleStyle: React.CSSProperties =
              state === "complete"
                ? { background: "linear-gradient(135deg,#22C55E,#16A34A)", boxShadow: "0 2px 10px rgba(34,197,94,0.35)" }
                : state === "active"
                  ? { background: "linear-gradient(135deg,#1A1C6E,#2D308F)", boxShadow: "0 2px 14px rgba(26,28,110,0.38)" }
                  : {};
            const circleClass = state !== "upcoming" ? "text-white" : "bg-[#EEF2F7] dark:bg-slate-800 text-[#9CA3AF] dark:text-slate-500";
            const labelClass = state === "active" ? "font-bold text-[#1A1C6E] dark:text-indigo-300" : state === "complete" ? "font-semibold text-[#16A34A]" : "font-medium text-[#9CA3AF] dark:text-slate-500";

            return (
              <div key={entry.key} className="flex flex-1 items-center gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${circleClass}`}
                  style={circleStyle}
                >
                  {state === "complete" ? <Check size={16} strokeWidth={2.5} /> : entry.key}
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm leading-tight ${labelClass}`}>{entry.title}</p>
                    <p className="mt-0.5 text-[10px] font-medium text-[#94A3B8] dark:text-slate-500">{subtitles[index]}</p>
                  </div>
                  {index < stepMeta.length - 1 ? (
                    <div className="hidden h-[3px] flex-1 overflow-hidden rounded-full bg-[#EEF2F7] dark:bg-slate-700 lg:block">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#22C55E] to-[#10B981] transition-all duration-500"
                        style={{ width: step > entry.key ? "100%" : step === entry.key ? "50%" : "0%" }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-[var(--fia-gray-200)] bg-[var(--card)] shadow-sm">
        <div className={`border-b border-[var(--fia-gray-100)] px-5 py-4 ${
          step === 1
            ? "bg-gradient-to-r from-[var(--fia-navy-50)] via-[var(--fia-gray-50)] to-transparent"
            : step === 2
              ? "bg-gradient-to-r from-[var(--fia-success-bg)] via-[var(--fia-gray-50)] to-transparent"
              : "bg-gradient-to-r from-[var(--fia-warning-bg)] via-[var(--fia-gray-50)] to-transparent"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm ${
              step === 1 ? "bg-[var(--fia-navy)]" : step === 2 ? "bg-[var(--fia-success)]" : "bg-[var(--fia-warning)]"
            }`}>
              {step}
            </div>
            <div>
              <h2 className={`text-[1.1rem] font-bold ${
                step === 1 ? "text-[var(--fia-navy)]" : step === 2 ? "text-[var(--fia-success)]" : "text-[var(--fia-warning)]"
              }`}>
                {step === 1 ? "Search & Select Employee" : step === 2 ? "Fill ACR Form" : "Review & Submit"}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--fia-text-secondary)]">
                {step === 1
                  ? "Search by name, CNIC, rank, or service number."
                  : step === 2
                    ? "Edit only the fields assigned to the clerk stage."
                    : "Verify all information before submission."}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4">
          {step === 1 ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" aria-hidden="true" />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      if (selectedEmployeeId && employeeSource === "directory") {
                        setSelectedEmployeeId("");
                      }
                    }}
                    aria-label="Search employee by name, CNIC, rank, or service number"
                    placeholder="Search employee name, CNIC, rank, or service number"
                    autoComplete="off"
                    className="w-full rounded-2xl border border-[var(--fia-border,#D8DEE8)] bg-[#F8FAFC] dark:bg-slate-800 py-3 pl-12 pr-4 text-[15px] outline-none transition-all focus:border-[var(--fia-cyan,#0095D9)] focus:bg-white focus:ring-4 focus:ring-[var(--fia-cyan,#0095D9)]/10"
                  />
                </div>
                <button
                  type="button"
                  onClick={openManualMode}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-2.5 text-sm font-semibold text-[#4F46E5] transition-all hover:-translate-y-0.5 hover:bg-[#E0E7FF] hover:shadow-[0_4px_12px_rgba(99,102,241,0.2)] dark:border-indigo-800/50 dark:bg-indigo-950/40 dark:text-indigo-400"
                >
                  <UserPlus size={16} />
                  Add Employee Manually
                </button>
              </div>

              {selectedEmployee && employeeSource === "directory" ? (
                <div className="rounded-[20px] border border-[#BEE3F8] bg-[#F0F9FF] px-4 py-3.5">
                  <p className="text-sm font-semibold text-[#0369A1]">
                    Selected: {selectedEmployee.name}
                  </p>
                  <p className="mt-1 text-sm text-[#075985]">
                    {selectedEmployee.rank} · {selectedEmployee.office} — The clerk completes only the initiation section. Reporting Officer and Countersigning Officer assignments will follow the records linked to this employee.
                  </p>
                </div>
              ) : null}

              <div className="space-y-2.5">
                {employees.map((employee) => {
                  const selected = selectedEmployeeId === employee.id && !manualMode;

                  return (
                    <button
                      key={employee.id}
                      type="button"
                      onClick={() => selectEmployee(employee)}
                      className={`flex w-full flex-col gap-3 rounded-[20px] border px-4 py-3.5 text-left transition-all md:flex-row md:items-center md:justify-between ${
                        selected
                          ? "border-[#0095D9] bg-[#EEF8FF] dark:bg-[#0c2a3a] shadow-[inset_4px_0_0_#0095D9]"
                          : "border-[#E5E7EB] dark:border-slate-700 bg-white dark:bg-[var(--card)] hover:border-[#CBD5E1]"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm"
                          style={{ background: getAvatarColor(employee.name) }}
                        >
                          {getInitials(employee.name)}
                        </div>
                        <div>
                          <p className="text-base font-semibold text-[#111827] dark:text-slate-100">{employee.name}</p>
                          <p className="mt-0.5 text-sm text-[#6B7280] dark:text-slate-400">
                            {employee.rank} · BPS-{employee.bps} · {employee.wing}
                          </p>
                          <p className="mt-1 text-sm text-[#9CA3AF] dark:text-slate-500">
                            {employee.designation ?? employee.posting} · {employee.office}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 md:text-right">
                        <div>
                          <p className="text-sm font-medium text-[#6B7280] dark:text-slate-400">{employee.serviceNumber ?? employee.cnic}</p>
                          <p className="mt-1 text-sm text-[#9CA3AF] dark:text-slate-500">{employee.cnic}</p>
                        </div>
                        {selected ? <Check size={18} className="shrink-0 text-[#0095D9]" /> : null}
                      </div>
                    </button>
                  );
                })}

                {unlinkedUsers.map((userAccount) => (
                  <button
                    key={userAccount.id}
                    type="button"
                    onClick={() => selectUnlinkedUser(userAccount)}
                    className="flex w-full flex-col gap-3 rounded-[20px] border border-[#E5E7EB] dark:border-slate-700 bg-white dark:bg-[var(--card)] px-4 py-3.5 text-left transition-all hover:border-[#CBD5E1] md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm"
                        style={{ background: getAvatarColor(userAccount.displayName) }}
                      >
                        {getInitials(userAccount.displayName)}
                      </div>
                      <div>
                        <p className="text-base font-semibold text-[#111827] dark:text-slate-100">{userAccount.displayName}</p>
                        <p className="mt-0.5 text-sm text-[#6B7280] dark:text-slate-400">{userAccount.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 md:text-right">
                      <div>
                        <p className="text-sm font-medium text-[#6B7280] dark:text-slate-400">{userAccount.badgeNo}</p>
                      </div>
                      <span className="rounded-full bg-[#FEF3C7] px-2.5 py-1 text-xs font-semibold text-[#92400E]">
                        No Employee Record
                      </span>
                    </div>
                  </button>
                ))}

                {!manualMode && !selectedEmployee && !employeesFetching && search.trim().length > 0 && employees.length === 0 && unlinkedUsers.length === 0 ? (
                  <div className="rounded-[20px] border border-[#E5E7EB] dark:border-slate-700 bg-[#FCFCFD] px-5 py-8 text-center">
                    <p className="text-lg font-semibold text-[#111827] dark:text-slate-100">No matching employee found</p>
                    <p className="mt-2 text-sm text-[#6B7280] dark:text-slate-400">
                      Add the employee once, store them in the master database, and reuse that profile for future ACR cycles.
                    </p>
                    <button
                      type="button"
                      onClick={openManualMode}
                      className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-[#0095D9] px-5 py-3 text-sm font-semibold text-white"
                    >
                      <Plus size={16} />
                      Create Employee Record
                    </button>
                  </div>
                ) : null}
              </div>

              {manualMode ? (
                <div className="rounded-[20px] border border-[#E5E7EB] dark:border-slate-700 bg-[#FCFCFD] p-3">
                  <div className="mb-3 flex items-start gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] dark:bg-indigo-950/40 text-[#4F46E5]">
                      <UserPlus size={16} />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-[#111827] dark:text-slate-100">Short Form: Add New Employee</p>
                      <p className="mt-0.5 text-sm text-[#6B7280] dark:text-slate-400">
                        Choose the office first, then assign Reporting Officer and Countersigning Officer. Employee is saved to master data on add.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {manualOptionsError ? (
                      <div className="rounded-2xl border border-[#F5C2C7] bg-[#FEF2F2] px-4 py-3 text-sm text-[#991B1B] md:col-span-2 xl:col-span-3">
                        Unable to load office and officer options right now: {manualOptionsError.message}
                      </div>
                    ) : null}

                    <label className="text-sm text-[#475569]">
                      Form Family
                      <select
                        value={manualTemplateId}
                        onChange={(event) => handleManualTemplateChange(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[#D8DEE8] dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 px-4 py-3 outline-none focus:border-[#0095D9] focus:ring-4 focus:ring-[#0095D9]/10"
                      >
                        {manualTemplateOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm text-[#475569]">
                      <span>
                        Full Name<span className="ml-1 text-[#DC2626]">*</span>
                      </span>
                      <input
                        value={manualEmployee.name}
                        onChange={(event) => updateManualEmployee("name", event.target.value)}
                        maxLength={80}
                        placeholder="Employee full name"
                        aria-invalid={invalidManualFields.name}
                        className={getFieldClasses(invalidManualFields.name)}
                      />
                    </label>

                    <label className="text-sm text-[#475569]">
                      <span>
                        CNIC<span className="ml-1 text-[#DC2626]">*</span>
                      </span>
                      <input
                        value={manualEmployee.cnic}
                        onChange={(event) => updateManualEmployee("cnic", event.target.value)}
                        inputMode="numeric"
                        maxLength={15}
                        placeholder="12345-1234567-1"
                        aria-invalid={invalidManualFields.cnic}
                        className={getFieldClasses(invalidManualFields.cnic)}
                      />
                      <span className="mt-1 block text-xs text-[#94A3B8]">Auto-formats as 12345-1234567-1</span>
                    </label>

                    <label className="text-sm text-[#475569]">
                      <span>
                        Mobile<span className="ml-1 text-[#DC2626]">*</span>
                      </span>
                      <input
                        value={manualEmployee.mobile}
                        onChange={(event) => updateManualEmployee("mobile", event.target.value)}
                        inputMode="numeric"
                        maxLength={12}
                        placeholder="03xx-xxxxxxx"
                        aria-invalid={invalidManualFields.mobile}
                        className={getFieldClasses(invalidManualFields.mobile)}
                      />
                      <span className="mt-1 block text-xs text-[#94A3B8]">Auto-formats as 03xx-xxxxxxx</span>
                    </label>

                    <label className="text-sm text-[#475569]">
                      Rank
                      <input
                        value={manualEmployee.rank}
                        onChange={(event) => updateManualEmployee("rank", event.target.value)}
                        maxLength={60}
                        className={getFieldClasses(false)}
                      />
                    </label>

                    <label className="text-sm text-[#475569]">
                      BPS
                      <select
                        value={manualEmployee.bps}
                        onChange={(event) => {
                          const nextBps = Number(event.target.value);
                          updateManualEmployee("bps", nextBps);
                          const suggested = suggestTemplateByBps(nextBps);
                          const suggestedOption = manualTemplateOptions.find((option) => option.templateFamily === suggested);
                          if (suggestedOption && suggestedOption.templateFamily !== manualEmployee.templateFamily) {
                            handleManualTemplateChange(suggestedOption.id);
                          }
                        }}
                        className="mt-2 w-full rounded-2xl border border-[#D8DEE8] dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 px-4 py-3 outline-none focus:border-[#0095D9] focus:ring-4 focus:ring-[#0095D9]/10"
                      >
                        {Array.from({ length: 22 }, (_, index) => index + 1).map((bps) => (
                          <option key={bps} value={bps}>
                            BPS-{bps}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm text-[#475569]">
                      Designation
                      <input
                        value={manualEmployee.designation}
                        onChange={(event) => updateManualEmployee("designation", event.target.value)}
                        maxLength={80}
                        className={getFieldClasses(false)}
                      />
                    </label>

                    <PostingComboField
                      value={manualEmployee.posting}
                      onChange={(value) => updateManualEmployee("posting", value)}
                      invalid={invalidManualFields.posting}
                    />

                    <label className="text-sm text-[#475569]">
                      <span>
                        Joining Date<span className="ml-1 text-[#DC2626]">*</span>
                      </span>
                      <input
                        type="date"
                        value={manualEmployee.joiningDate}
                        onChange={(event) => updateManualEmployee("joiningDate", event.target.value)}
                        aria-invalid={invalidManualFields.joiningDate}
                        className={getFieldClasses(invalidManualFields.joiningDate)}
                      />
                    </label>

                    <label className="text-sm text-[#475569]">
                      Email
                      <input
                        type="email"
                        value={manualEmployee.email ?? ""}
                        onChange={(event) => updateManualEmployee("email", event.target.value)}
                        maxLength={120}
                        placeholder="Optional official email"
                        aria-invalid={invalidManualFields.email}
                        className={getFieldClasses(invalidManualFields.email)}
                      />
                    </label>

                    <SearchableSelect
                      label={
                        <span>
                          Office<span className="ml-1 text-[#DC2626]">*</span>
                        </span>
                      }
                      value={manualEmployee.officeId}
                      options={officeOptions}
                      onChange={(nextOfficeId) =>
                        setManualEmployee((current) => ({
                          ...current,
                          officeId: nextOfficeId,
                          departmentId: "",
                          reportingOfficerId: "",
                          countersigningOfficerId: "",
                        }))
                      }
                      placeholder={manualOptionsLoading ? "Loading offices..." : "Search office by name"}
                      emptyMessage="No office found in your visible scope."
                      disabled={manualOptionsLoading}
                      invalid={invalidManualFields.office}
                    />

                    {selectedOfficeOption?.departments?.length ? (
                      <label className="text-sm text-[#475569]">
                        Department
                        <select
                          value={manualEmployee.departmentId ?? ""}
                          onChange={(event) => updateManualEmployee("departmentId", event.target.value)}
                          className={getFieldClasses(false)}
                        >
                          <option value="">Select department (optional)</option>
                          {selectedOfficeOption.departments.map((department) => (
                            <option key={department.id} value={department.id}>
                              {department.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}

                    <SearchableSelect
                      label={
                        <span>
                          Reporting Officer<span className="ml-1 text-[#DC2626]">*</span>
                        </span>
                      }
                      value={manualEmployee.reportingOfficerId}
                      options={reportingOfficerOptions}
                      onChange={(nextOfficerId) => updateManualEmployee("reportingOfficerId", nextOfficerId)}
                      placeholder={manualOptionsLoading ? "Loading officers..." : "Search reporting officer by name"}
                      emptyMessage="No reporting officer is available for the selected scope."
                      disabled={manualOptionsLoading}
                      invalid={invalidManualFields.reportingOfficer || invalidManualFields.duplicateOfficer}
                    />

                    {requiresCountersigningSelection ? (
                      <SearchableSelect
                        label={
                          <span>
                            Countersigning Officer<span className="ml-1 text-[#DC2626]">*</span>
                          </span>
                        }
                        value={manualEmployee.countersigningOfficerId ?? ""}
                        options={countersigningOfficerOptions}
                        onChange={(nextOfficerId) => updateManualEmployee("countersigningOfficerId", nextOfficerId)}
                        placeholder={manualOptionsLoading ? "Loading officers..." : "Search countersigning officer by name"}
                        emptyMessage="No countersigning officer is available for the selected scope."
                        disabled={manualOptionsLoading}
                        invalid={invalidManualFields.countersigningOfficer || invalidManualFields.duplicateOfficer}
                      />
                    ) : (
                      <div className="rounded-2xl border border-[#D8DEE8] dark:border-slate-700 bg-white dark:bg-[var(--card)] px-4 py-4 text-sm text-[#475569]">
                        <p className="font-semibold text-[#111827] dark:text-slate-100">Countersigning Officer</p>
                        <p className="mt-2 text-[#64748B]">
                          This form family moves from Reporting Officer directly to Secret Branch, so no countersigning assignment is required.
                        </p>
                      </div>
                    )}

                    <label className="text-sm text-[#475569] md:col-span-2 xl:col-span-3">
                      <span>
                        Address<span className="ml-1 text-[#DC2626]">*</span>
                      </span>
                      <textarea
                        value={manualEmployee.address}
                        onChange={(event) => updateManualEmployee("address", event.target.value)}
                        maxLength={280}
                        placeholder="Residential or service address"
                        aria-invalid={invalidManualFields.address}
                        className={`${getFieldClasses(invalidManualFields.address)} min-h-[88px]`}
                      />
                    </label>

                    {/* ── Additional metadata (collapsible) ── */}
                    <div className="md:col-span-2 xl:col-span-3">
                      <button
                        type="button"
                        onClick={() => setShowMetadata((v) => !v)}
                        className="mt-1 flex items-center gap-2 text-sm font-semibold text-[#0095D9] hover:text-[#0077B6]"
                      >
                        <ChevronRight
                          size={16}
                          className={`transition-transform duration-200 ${showMetadata ? "rotate-90" : ""}`}
                        />
                        Additional Information (Optional — pre-fills ACR form fields)
                      </button>
                      <p className="mt-1 text-xs text-[#94A3B8]">
                        Stored once per employee; auto-filled every time an ACR is initiated for this person.
                      </p>
                    </div>

                    {showMetadata ? (
                      <>
                        {/* Gender — all templates */}
                        <label className="text-sm text-[#475569]">
                          Gender
                          <select
                            value={manualEmployee.gender ?? ""}
                            onChange={(e) => updateManualEmployee("gender", (e.target.value as Gender) || undefined)}
                            className={getFieldClasses(false)}
                          >
                            <option value="">Select gender...</option>
                            <option value="MALE">Male</option>
                            <option value="FEMALE">Female</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </label>

                        {/* Date of Birth — all templates */}
                        <label className="text-sm text-[#475569]">
                          Date of Birth
                          <input
                            type="date"
                            value={manualEmployee.dateOfBirth ?? ""}
                            onChange={(e) => updateManualEmployee("dateOfBirth", e.target.value || undefined)}
                            className={getFieldClasses(false)}
                          />
                        </label>

                        {/* Basic Pay — all templates */}
                        <label className="text-sm text-[#475569]">
                          Basic Pay (PKR)
                          <input
                            type="number"
                            value={manualEmployee.basicPay ?? ""}
                            onChange={(e) => updateManualEmployee("basicPay", e.target.value ? Number(e.target.value) : undefined)}
                            min={0}
                            placeholder="Monthly basic pay"
                            className={getFieldClasses(false)}
                          />
                        </label>

                        {/* Date of Appointment to BPS — all templates */}
                        <label className="text-sm text-[#475569]">
                          Date of Appointment to Present BPS
                          <input
                            type="date"
                            value={manualEmployee.appointmentToBpsDate ?? ""}
                            onChange={(e) => updateManualEmployee("appointmentToBpsDate", e.target.value || undefined)}
                            className={getFieldClasses(false)}
                          />
                        </label>

                        {/* Qualifications — non-driver */}
                        {manualEmployee.templateFamily !== "CAR_DRIVERS_DESPATCH_RIDERS" ? (
                          <label className="text-sm text-[#475569] md:col-span-2">
                            Qualifications
                            <textarea
                              value={manualEmployee.qualifications ?? ""}
                              onChange={(e) => updateManualEmployee("qualifications", e.target.value || undefined)}
                              maxLength={500}
                              placeholder="e.g. M.A. (Urdu), B.A."
                              className={`${getFieldClasses(false)} min-h-[72px]`}
                            />
                          </label>
                        ) : null}

                        {/* Nature of Duties — ASSISTANT / APS / SUPERINTENDENT */}
                        {(manualEmployee.templateFamily === "ASSISTANT_UDC_LDC" ||
                          manualEmployee.templateFamily === "APS_STENOTYPIST" ||
                          manualEmployee.templateFamily === "SUPERINTENDENT_AINCHARGE") ? (
                          <label className="text-sm text-[#475569] md:col-span-2">
                            Nature of Duties
                            <textarea
                              value={manualEmployee.natureOfDuties ?? ""}
                              onChange={(e) => updateManualEmployee("natureOfDuties", e.target.value || undefined)}
                              maxLength={500}
                              placeholder="Duties performed by this employee"
                              className={`${getFieldClasses(false)} min-h-[72px]`}
                            />
                          </label>
                        ) : null}

                        {/* Father's Name + Deputation Type — INSPECTOR */}
                        {manualEmployee.templateFamily === "INSPECTOR_SI_ASI" ? (
                          <>
                            <label className="text-sm text-[#475569]">
                              {"Father's Name (S/o)"}
                              <input
                                value={manualEmployee.fatherName ?? ""}
                                onChange={(e) => updateManualEmployee("fatherName", e.target.value || undefined)}
                                maxLength={100}
                                placeholder="Father's full name"
                                className={getFieldClasses(false)}
                              />
                            </label>
                            <label className="text-sm text-[#475569]">
                              Direct / Deputationist
                              <select
                                value={manualEmployee.deputationType ?? ""}
                                onChange={(e) => updateManualEmployee("deputationType", (e.target.value as DeputationType) || undefined)}
                                className={getFieldClasses(false)}
                              >
                                <option value="">Select...</option>
                                <option value="DIRECT">Direct</option>
                                <option value="DEPUTATIONIST">Deputationist</option>
                              </select>
                            </label>
                          </>
                        ) : null}

                        {/* License + Vehicle — CAR_DRIVERS */}
                        {manualEmployee.templateFamily === "CAR_DRIVERS_DESPATCH_RIDERS" ? (
                          <>
                            <label className="text-sm text-[#475569]">
                              Type of License Held
                              <input
                                value={manualEmployee.licenseType ?? ""}
                                onChange={(e) => updateManualEmployee("licenseType", e.target.value || undefined)}
                                maxLength={100}
                                placeholder="e.g. LTV, HTV"
                                className={getFieldClasses(false)}
                              />
                            </label>
                            <label className="text-sm text-[#475569]">
                              Type of Vehicle Driven
                              <input
                                value={manualEmployee.vehicleType ?? ""}
                                onChange={(e) => updateManualEmployee("vehicleType", e.target.value || undefined)}
                                maxLength={100}
                                placeholder="e.g. Toyota Corolla"
                                className={getFieldClasses(false)}
                              />
                            </label>
                          </>
                        ) : null}

                        {/* Personnel Number + Service/Group — PER_17_18 */}
                        {manualEmployee.templateFamily === "PER_17_18_OFFICERS" ? (
                          <>
                            <label className="text-sm text-[#475569]">
                              Personnel Number
                              <input
                                value={manualEmployee.personnelNumber ?? ""}
                                onChange={(e) => updateManualEmployee("personnelNumber", e.target.value || undefined)}
                                maxLength={50}
                                placeholder="Personnel / Roll number"
                                className={getFieldClasses(false)}
                              />
                            </label>
                            <label className="text-sm text-[#475569]">
                              Service / Group
                              <input
                                value={manualEmployee.serviceGroup ?? ""}
                                onChange={(e) => updateManualEmployee("serviceGroup", e.target.value || undefined)}
                                maxLength={100}
                                placeholder="e.g. FIA / Police Service"
                                className={getFieldClasses(false)}
                              />
                            </label>
                          </>
                        ) : null}

                        {/* Training Courses Text — non-officer */}
                        {manualEmployee.templateFamily !== "PER_17_18_OFFICERS" ? (
                          <label className="text-sm text-[#475569] md:col-span-2 xl:col-span-3">
                            Training Courses Attended (if any)
                            <textarea
                              value={manualEmployee.trainingCoursesText ?? ""}
                              onChange={(e) => updateManualEmployee("trainingCoursesText", e.target.value || undefined)}
                              maxLength={1000}
                              placeholder="List training courses attended, one per line"
                              className={`${getFieldClasses(false)} min-h-[72px]`}
                            />
                          </label>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {step === 2 ? (
            <div className="space-y-4">
              {/* Compact employee info strip */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl border border-[var(--fia-gray-200)] bg-[var(--fia-gray-50)] px-4 py-2.5 text-xs">
                <span className="font-bold text-[var(--fia-gray-900)]">{employeeName}</span>
                <span className="text-[var(--fia-gray-500)]">{employeeRank} · {employeeBps}</span>
                <span className="text-[var(--fia-gray-500)]">{employeeOffice}</span>
                <span className="text-[var(--fia-gray-400)]">RO: {reportingOfficer}</span>
                {requiresCountersigningSelection ? <span className="text-[var(--fia-gray-400)]">CSO: {countersigningOfficer}</span> : null}
              </div>

              <div className="rounded-[20px] border border-[#E5E7EB] dark:border-slate-700 bg-white dark:bg-[var(--card)] p-3">
                <div className="mb-3 flex items-start gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#1A1C6E]">
                    <FileText size={16} />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-[#111827] dark:text-slate-100">Clerk Section Only</p>
                    <p className="mt-0.5 text-sm text-[#6B7280] dark:text-slate-400">
                      Fill the initiation section only. The official paper-format replica opens for the Reporting Officer after submission.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {!manualMode && selectedEmployee ? (
                    <label className="text-sm text-[#475569]">
                      <span className="flex flex-wrap items-center gap-2">
                        Form Family
                        {overrideIsDeviation ? (
                          <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-xs font-semibold text-[#92400E]">
                            Differs from employee record
                          </span>
                        ) : null}
                      </span>
                      <select
                        value={templateFamilyOverride ?? selectedEmployee.templateFamily}
                        onChange={(event) => {
                          const next = event.target.value as TemplateFamilyCode;
                          setTemplateFamilyOverride(next === selectedEmployee.templateFamily ? null : next);
                        }}
                        className="mt-2 block w-full rounded-2xl border border-[#D8DEE8] dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-slate-100 px-4 py-3 text-[#1E293B] outline-none focus:border-[#0095D9] focus:ring-4 focus:ring-[#0095D9]/10"
                      >
                        {manualTemplateOptions.map((option) => (
                          <option key={option.id} value={option.templateFamily}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <span className="mt-1 block text-xs text-[#94A3B8]">
                        Employee record: {templateLabels[selectedEmployee.templateFamily]}
                      </span>
                    </label>
                  ) : null}
                  <label className="text-sm text-[#475569]">
                    <span>
                      Reporting Period From<span className="ml-1 text-[#DC2626]">*</span>
                    </span>
                    <input
                      type="date"
                      value={clerkSection.periodFrom}
                      onChange={(event) => updateClerkSection("periodFrom", event.target.value)}
                      aria-invalid={invalidClerkFields.periodFrom}
                      className={getFieldClasses(invalidClerkFields.periodFrom, true)}
                    />
                  </label>

                  <label className="text-sm text-[#475569]">
                    <span>
                      Reporting Period To<span className="ml-1 text-[#DC2626]">*</span>
                    </span>
                    <input
                      type="date"
                      value={clerkSection.periodTo}
                      onChange={(event) => updateClerkSection("periodTo", event.target.value)}
                      aria-invalid={invalidClerkFields.periodTo}
                      className={getFieldClasses(invalidClerkFields.periodTo, true)}
                    />
                  </label>

                  <ZoneCircleComboField
                    value={clerkSection.zoneCircle}
                    onChange={(v) => updateClerkSection("zoneCircle", v)}
                  />

                  <label className="text-sm text-[#475569]">
                    Direct / Deputationist
                    <select
                      value={clerkSection.directDeputationist}
                      onChange={(event) => updateClerkSection("directDeputationist", event.target.value)}
                      className={`${getFieldClasses(false, true)} appearance-auto`}
                    >
                      <option value="">Select</option>
                      <option value="Direct">Direct</option>
                      <option value="Deputationist">Deputationist</option>
                      <option value="Contract">Contract</option>
                    </select>
                  </label>

                  <label className="text-sm text-[#475569]">
                    Father / Spouse Name
                    <input
                      value={clerkSection.fatherName}
                      onChange={(event) => updateClerkSection("fatherName", event.target.value)}
                      maxLength={80}
                      placeholder="Father or spouse name"
                      className={getFieldClasses(false, true)}
                    />
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-[#E5E7EB] dark:border-slate-700 px-4 py-3 text-sm text-[#475569]">
                    <input
                      type="checkbox"
                      checked={clerkSection.isPriority}
                      onChange={(event) => updateClerkSection("isPriority", event.target.checked)}
                      className="h-4 w-4 rounded border border-[#CBD5E1] dark:border-slate-600 text-[#1A1C6E] focus:ring-[#1A1C6E]"
                    />
                    Mark as priority ACR case
                  </label>

                  <label className="text-sm text-[#475569] md:col-span-2 xl:col-span-3">
                    Training Courses
                    <textarea
                      value={clerkSection.trainingCourses}
                      onChange={(event) => updateClerkSection("trainingCourses", event.target.value)}
                      maxLength={400}
                      placeholder="Relevant training courses attended"
                      className={`${getFieldClasses(false, true)} min-h-[88px]`}
                    />
                  </label>

                  <label className="text-sm text-[#475569]">
                    Departmental Enquiry
                    <textarea
                      value={clerkSection.departmentalEnquiry}
                      onChange={(event) => updateClerkSection("departmentalEnquiry", event.target.value)}
                      maxLength={300}
                      className={`${getFieldClasses(false, true)} min-h-[88px]`}
                    />
                  </label>

                  <label className="text-sm text-[#475569]">
                    Punishment
                    <textarea
                      value={clerkSection.punishment}
                      onChange={(event) => updateClerkSection("punishment", event.target.value)}
                      maxLength={300}
                      className={`${getFieldClasses(false, true)} min-h-[88px]`}
                    />
                  </label>

                  <label className="text-sm text-[#475569]">
                    Rewards
                    <textarea
                      value={clerkSection.rewards}
                      onChange={(event) => updateClerkSection("rewards", event.target.value)}
                      maxLength={300}
                      className={`${getFieldClasses(false, true)} min-h-[88px]`}
                    />
                  </label>

                  <label className="text-sm text-[#475569] md:col-span-2 xl:col-span-3">
                    Clerk Remarks
                    <textarea
                      value={clerkSection.remarks}
                      onChange={(event) => updateClerkSection("remarks", event.target.value)}
                      maxLength={500}
                      placeholder="Important clerk remarks for the reviewing officers"
                      className={`${getFieldClasses(false, true)} min-h-[96px]`}
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[20px] border border-[#D8DEE8] dark:border-slate-700 bg-white dark:bg-[var(--card)] p-3">
                <div className="flex flex-col gap-1 border-b border-[#EEF2F7] pb-3">
                  <p className="text-base font-semibold text-[#111827] dark:text-slate-100">Official form preview</p>
                  <p className="text-sm text-[#64748B]">
                    The selected template now loads with the current clerk-entered data inside the actual form layout. Clerk-stage fields can be refined on the draft record after save, while later officer sections remain protected for the next workflow holders.
                  </p>
                </div>

                <div className="mt-3 overflow-x-auto rounded-[20px] bg-[#EDF2F7] dark:bg-[#0F1117] p-3 sm:p-3 lg:p-4">
                  <div className="mx-auto w-full max-w-[1120px]">
                    <FormPreview
                      templateFamily={previewTemplateFamily}
                      editable={Boolean(selectedEmployeeId)}
                      editableScopes={["clerk"]}
                      reviewerContext={reviewerContext}
                      formData={{ ...draftFormData, replicaState: replicaStateSeed }}
                      onReplicaStateChange={(nextReplicaState) => {
                        replicaStateRef.current = nextReplicaState;
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-[20px] border border-[#E5E7EB] dark:border-slate-700 bg-white">
                <div className="grid gap-4 px-4 py-3 lg:grid-cols-2">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0095D9]">Employee Information</p>
                    <div className="mt-3 space-y-2">
                      {[
                        { label: "Full Name", value: employeeName },
                        { label: "Rank", value: employeeRank },
                        { label: "BPS", value: employeeBps },
                        { label: "CNIC", value: employeeCnic },
                        { label: "Mobile", value: employeeMobile },
                        { label: "Wing", value: employeeWing },
                      ].map((field) => (
                        <div key={field.label} className="grid grid-cols-[150px_minmax(0,1fr)] gap-4 text-sm">
                          <span className="text-[#6B7280] dark:text-slate-400">{field.label}</span>
                          <span className="font-semibold text-[#111827] dark:text-slate-100">{field.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7C3AED]">ACR Details</p>
                    <div className="mt-3 space-y-2">
                      {[
                        { label: "Template", value: overrideIsDeviation ? `${templateLabels[previewTemplateFamily]} (overridden)` : templateLabels[previewTemplateFamily] },
                        { label: "Reporting Period", value: `${clerkSection.periodFrom} to ${clerkSection.periodTo}` },
                        { label: "Reporting Officer", value: reportingOfficer },
                        { label: "Countersigning Officer", value: countersigningOfficer },
                        { label: "Wing", value: employeeWing },
                        { label: "Office", value: employeeOffice },
                      ].map((field) => (
                        <div key={field.label} className="grid grid-cols-[170px_minmax(0,1fr)] gap-4 text-sm">
                          <span className="text-[#6B7280] dark:text-slate-400">{field.label}</span>
                          <span className="font-semibold text-[#111827] dark:text-slate-100">{field.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#EEF2F7] px-4 py-3">
                  <div className="flex items-start gap-3 rounded-[18px] border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3 text-sm text-[#B45309]">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <p>
                      Once submitted, this ACR will be forwarded to <span className="font-semibold">{reportingOfficer}</span> for review.
                      {requiresCountersigningSelection
                        ? ` After Reporting Officer review, it will move to ${countersigningOfficer}, then to Secret Branch for final archival.`
                        : " After Reporting Officer review, it will move directly to Secret Branch for final archival."}
                    </p>
                  </div>
                </div>
              </div>

            </div>
          ) : null}
        </div>
      </section>

      {validationMessage ? (
        <div className="flex items-start gap-3 rounded-2xl border border-[#FECACA] bg-[#FFF1F2] px-4 py-3 text-sm text-[#BE123C]">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{validationMessage}</span>
        </div>
      ) : null}

      <div className="portal-floating-action-bar">
        <div className="rounded-[24px] border border-[#D8DEE8] dark:border-slate-700 bg-white/96 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur">
        <div className="grid gap-3 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-center">
          <button
            type="button"
            onClick={() => (step === 1 ? router.push("/dashboard") : setStep((current) => Math.max(1, current - 1) as StepKey))}
            className={actionButtonSecondary}
          >
            <ChevronLeft size={16} />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 xl:justify-end">
              {step === 1 && manualMode && !selectedEmployeeId ? (
                <button
                  type="button"
                  disabled={!canAddManualEmployee || addEmployeeMutation.isPending}
                  onClick={handleAddManualEmployee}
                  className={actionButtonInfo}
                >
                  <UserPlus size={16} />
                  {addEmployeeMutation.isPending ? "Adding Employee..." : "Add Employee to Database"}
                </button>
              ) : null}

              <button
                type="button"
                disabled={!canPersistDraft || saveDraftMutation.isPending}
                onClick={() => saveDraftMutation.mutate({ submitToReporting: false })}
                className={actionButtonSecondary}
              >
                <FileText size={16} />
                Save Draft
              </button>

              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (validateStep(step)) {
                      setStep((current) => Math.min(3, current + 1) as StepKey);
                    }
                  }}
                  className={actionButtonPrimary}
                >
                  Next Step
                  <ChevronRight size={16} />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!canPersistDraft || saveDraftMutation.isPending}
                  onClick={() => saveDraftMutation.mutate({ submitToReporting: true })}
                  className={actionButtonAccent}
                >
                  Submit to Reporting Officer
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
      <div className="h-28" />
    </div>
  );
}
