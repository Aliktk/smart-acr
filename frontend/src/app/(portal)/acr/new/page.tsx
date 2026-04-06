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
import { createAcr, createEmployee, getEmployees, getManualEmployeeOptions, transitionAcr } from "@/api/client";
import { FormPreview } from "@/components/FormPreview";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/SearchableSelect";
import { FloatingToast } from "@/components/ui";
import { useShell } from "@/hooks/useShell";
import type {
  AcrClerkSection,
  AcrFormData,
  AcrReplicaState,
  AcrReviewerContext,
  EmployeeSummary,
  ManualEmployeePayload,
  TemplateFamilyCode,
} from "@/types/contracts";
import { manualTemplateOptions } from "@/utils/templates";

type StepKey = 1 | 2 | 3;
type EmployeeSource = "directory" | "manual";
type PageToast = { title: string; message?: string; tone?: "success" | "info" | "warning" | "danger" } | null;

const templateLabels: Record<TemplateFamilyCode, string> = {
  ASSISTANT_UDC_LDC: "Form A (Assistants / UDC / LDC)",
  APS_STENOTYPIST: "Form B (APS / Stenotypist)",
  INSPECTOR_SI_ASI: "Form C (Inspector / S.I / A.S.I)",
  SUPERINTENDENT_AINCHARGE: "Form D (Superintendent / Assistant Incharge)",
};

const stepMeta: Array<{ key: StepKey; title: string }> = [
  { key: 1, title: "Employee Search" },
  { key: 2, title: "Fill Form" },
  { key: 3, title: "Review & Submit" },
];

const actionButtonBase =
  "group inline-flex cursor-pointer items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-all duration-200 [&_svg]:transition-transform hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(15,23,42,0.08)] hover:[&_svg]:scale-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none";
const actionButtonSecondary = `${actionButtonBase} border border-[#D8DEE8] bg-white text-[#475569]`;
const actionButtonInfo = `${actionButtonBase} border border-[#0095D9] bg-[#EEF8FF] text-[#0369A1]`;
const actionButtonPrimary = `${actionButtonBase} bg-[#1A1C6E] text-white hover:bg-[#2D308F]`;
const actionButtonAccent = `${actionButtonBase} bg-[#0095D9] text-white hover:bg-[#0077B6]`;

const initialManualState: ManualEmployeePayload = {
  name: "",
  rank: manualTemplateOptions[2].rank,
  designation: manualTemplateOptions[2].designation,
  bps: manualTemplateOptions[2].defaultBps,
  cnic: "",
  mobile: "",
  email: "",
  posting: "",
  joiningDate: "2024-07-01",
  address: "",
  templateFamily: manualTemplateOptions[2].templateFamily,
  officeId: "",
  reportingOfficerId: "",
  countersigningOfficerId: "",
};

const initialClerkSection: AcrClerkSection = {
  periodFrom: "2024-07-01",
  periodTo: "2025-06-30",
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

function requiresCountersigning(templateFamily: TemplateFamilyCode) {
  return templateFamily !== "APS_STENOTYPIST";
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
  return `mt-2 w-full rounded-2xl border px-4 py-3 outline-none transition-all ${
    muted ? "bg-[#F8FAFC]" : "bg-white"
  } ${
    invalid
      ? "border-[#DC2626] focus:border-[#DC2626] focus:ring-4 focus:ring-[#DC2626]/10"
      : "border-[#D8DEE8] focus:border-[#0095D9] focus:ring-4 focus:ring-[#0095D9]/10"
  }`;
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
  zoneName: string;
  wingName: string;
}): SearchableSelectOption {
  return {
    id: option.id,
    label: option.name,
    description: `${option.zoneName} · ${option.wingName}`,
    meta: option.code,
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
  const [clerkSection, setClerkSection] = useState<AcrClerkSection>(initialClerkSection);
  const [replicaStateSeed, setReplicaStateSeed] = useState<AcrReplicaState>(() => createInitialReplicaState());
  const replicaStateRef = useRef<AcrReplicaState>(createInitialReplicaState());
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [pageToast, setPageToast] = useState<PageToast>(null);
  const deferredSearch = useDeferredValue(search);
  const canInitiate = !user || ["CLERK", "SUPER_ADMIN", "IT_OPS"].includes(user.activeRoleCode);

  const { data, isFetching: employeesFetching } = useQuery({
    queryKey: ["employees", deferredSearch],
    queryFn: () => getEmployees(deferredSearch),
  });

  const { data: manualOptions, isLoading: manualOptionsLoading } = useQuery({
    queryKey: ["manual-employee-options", manualEmployee.officeId || "all"],
    queryFn: () => getManualEmployeeOptions(manualEmployee.officeId || undefined),
    enabled: manualMode,
  });

  const employees = data?.items ?? [];
  const selectedEmployee = useMemo(() => {
    const fromDirectory = employees.find((employee) => employee.id === selectedEmployeeId);
    return fromDirectory ?? (selectedEmployeeRecord?.id === selectedEmployeeId ? selectedEmployeeRecord : null);
  }, [employees, selectedEmployeeId, selectedEmployeeRecord]);

  const previewTemplateFamily = selectedEmployee?.templateFamily ?? manualEmployee.templateFamily;
  const requiresCountersigningSelection = requiresCountersigning(previewTemplateFamily);
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
      queryClient.setQueryData(["employees", ""], (current: { items: EmployeeSummary[]; total: number } | undefined) => {
        if (!current) {
          return current;
        }

        const items = [createdEmployee, ...current.items.filter((employee) => employee.id !== createdEmployee.id)];
        return { ...current, items, total: items.length };
      });
      queryClient.setQueryData(
        ["employees", createdEmployee.name],
        { items: [createdEmployee], total: 1 },
      );
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      setSelectedEmployeeRecord(createdEmployee);
      setSelectedEmployeeId(createdEmployee.id);
      setEmployeeSource("manual");
      setManualMode(false);
      setSearch(createdEmployee.name);
      setValidationMessage(null);
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
      setValidationMessage(error.message);
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
      countersigningOfficerId: requiresCountersigning(template.templateFamily) ? current.countersigningOfficerId : "",
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
  }

  function selectEmployee(employee: EmployeeSummary) {
    setManualMode(false);
    setSelectedEmployeeId(employee.id);
    setSelectedEmployeeRecord(null);
    setEmployeeSource("directory");
    const nextReplicaState = createInitialReplicaState();
    replicaStateRef.current = nextReplicaState;
    setReplicaStateSeed(nextReplicaState);
    setValidationMessage(null);
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
    selectedEmployee?.wing ??
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
        <h1 className="text-[1.75rem] font-semibold text-[#111827]">Initiate New ACR / PER</h1>
        <div className="rounded-[24px] border border-[#FDE68A] bg-[#FFFBEB] px-5 py-4">
          <p className="text-base font-semibold text-[#92400E]">Initiation is restricted to the clerk stage.</p>
          <p className="mt-2 text-sm text-[#B45309]">
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
      <div>
        <h1 className="text-[1.75rem] font-semibold text-[#111827]">Initiate New ACR / PER</h1>
        <p className="mt-0.5 text-sm text-[#6B7280]">
          Annual Confidential Report — {user?.scope.wingName ?? "Immigration Wing"}
        </p>
      </div>

      <section className="rounded-[24px] border border-[#E5E7EB] bg-white px-4 py-3.5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {stepMeta.map((entry, index) => {
            const state = step > entry.key ? "complete" : step === entry.key ? "active" : "upcoming";
            const circleClass =
              state === "complete"
                ? "bg-[#22C55E] text-white"
                : state === "active"
                  ? "bg-[#1A1C6E] text-white"
                  : "bg-[#EEF2F7] text-[#9CA3AF]";
            const textClass =
              state === "complete" ? "text-[#16A34A]" : state === "active" ? "text-[#1A1C6E]" : "text-[#9CA3AF]";

            return (
              <div key={entry.key} className="flex flex-1 items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${circleClass}`}>
                  {state === "complete" ? <Check size={16} /> : entry.key}
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <p className={`text-sm font-semibold ${textClass}`}>{entry.title}</p>
                  {index < stepMeta.length - 1 ? (
                    <div className="hidden h-[2px] flex-1 rounded-full bg-[#E5E7EB] lg:block">
                      <div
                        className={`h-full rounded-full ${
                          step > entry.key ? "w-full bg-[#22C55E]" : step === entry.key ? "w-1/2 bg-[#22C55E]" : "w-0"
                        }`}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-[#E5E7EB] bg-white shadow-sm">
        <div className="border-b border-[#EEF2F7] px-5 py-4">
          <h2 className="text-[1.2rem] font-semibold text-[#1A1C6E]">
            Step {step}: {step === 1 ? "Search & Select Employee" : step === 2 ? "Fill ACR Form" : "Review & Submit"}
          </h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            {step === 1
              ? "Search by name, CNIC, rank, or service number."
              : step === 2
                ? "Edit only the fields assigned to the clerk stage."
                : "Verify all information before submission."}
          </p>
        </div>

        <div className="p-5">
          {step === 1 ? (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                  <input
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      if (selectedEmployeeId && employeeSource === "directory") {
                        setSelectedEmployeeId("");
                      }
                    }}
                    placeholder="Search employee name, CNIC, rank, or service number"
                    className="w-full rounded-2xl border border-[#D8DEE8] bg-[#F8FAFC] py-3 pl-12 pr-4 text-[15px] outline-none transition-all focus:border-[#0095D9] focus:bg-white focus:ring-4 focus:ring-[#0095D9]/10"
                  />
                </div>
                <button
                  type="button"
                  onClick={openManualMode}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#D8DEE8] bg-white px-4 py-2.5 text-sm font-semibold text-[#1A1C6E]"
                >
                  <UserPlus size={16} />
                  Add Employee Manually
                </button>
              </div>

              {selectedEmployee && employeeSource === "directory" ? (
                <div className="rounded-[20px] border border-[#BEE3F8] bg-[#F0F9FF] px-4 py-3.5">
                  <p className="text-sm font-semibold text-[#0369A1]">
                    Employee record found in database
                  </p>
                  <p className="mt-1 text-sm text-[#075985]">
                    The clerk completes only the initiation section. Reporting Officer and Countersigning Officer assignments will now follow the exact people you selected for this employee.
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
                          ? "border-[#0095D9] bg-[#EEF8FF] shadow-[inset_4px_0_0_#0095D9]"
                          : "border-[#E5E7EB] bg-white hover:border-[#CBD5E1]"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#1A1C6E] text-sm font-semibold text-white">
                          {getInitials(employee.name)}
                        </div>
                        <div>
                          <p className="text-base font-semibold text-[#111827]">{employee.name}</p>
                          <p className="mt-0.5 text-sm text-[#6B7280]">
                            {employee.rank} · BPS-{employee.bps} · {employee.wing}
                          </p>
                          <p className="mt-1 text-sm text-[#9CA3AF]">
                            {employee.designation ?? employee.posting} · {employee.office}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 md:text-right">
                        <div>
                          <p className="text-sm font-medium text-[#6B7280]">{employee.serviceNumber ?? employee.cnic}</p>
                          <p className="mt-1 text-sm text-[#9CA3AF]">{employee.cnic}</p>
                        </div>
                        {selected ? <Check size={18} className="shrink-0 text-[#0095D9]" /> : null}
                      </div>
                    </button>
                  );
                })}

                {!manualMode && !selectedEmployee && !employeesFetching && search.trim().length > 0 && employees.length === 0 ? (
                  <div className="rounded-[20px] border border-[#E5E7EB] bg-[#FCFCFD] px-5 py-8 text-center">
                    <p className="text-lg font-semibold text-[#111827]">No matching employee found</p>
                    <p className="mt-2 text-sm text-[#6B7280]">
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
                <div className="rounded-[20px] border border-[#E5E7EB] bg-[#FCFCFD] p-4">
                  <div className="mb-4 flex items-start gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF6FC] text-[#0095D9]">
                      <UserPlus size={18} />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-[#111827]">Short Form: Add New Employee</p>
                      <p className="mt-1 text-sm text-[#6B7280]">
                        Choose the office first, then assign the actual Reporting Officer and Countersigning Officer. This employee will be saved to master data as soon as you use the add button below.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    <label className="text-sm text-[#475569]">
                      Form Family
                      <select
                        value={manualTemplateId}
                        onChange={(event) => handleManualTemplateChange(event.target.value)}
                        className="mt-2 w-full rounded-2xl border border-[#D8DEE8] bg-white px-4 py-3 outline-none focus:border-[#0095D9] focus:ring-4 focus:ring-[#0095D9]/10"
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
                        onChange={(event) => updateManualEmployee("bps", Number(event.target.value))}
                        className="mt-2 w-full rounded-2xl border border-[#D8DEE8] bg-white px-4 py-3 outline-none focus:border-[#0095D9] focus:ring-4 focus:ring-[#0095D9]/10"
                      >
                        {Array.from({ length: 16 }, (_, index) => index + 1).map((bps) => (
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

                    <label className="text-sm text-[#475569]">
                      <span>
                        Posting<span className="ml-1 text-[#DC2626]">*</span>
                      </span>
                      <input
                        value={manualEmployee.posting}
                        onChange={(event) => updateManualEmployee("posting", event.target.value)}
                        maxLength={100}
                        placeholder="Current posting / section"
                        aria-invalid={invalidManualFields.posting}
                        className={getFieldClasses(invalidManualFields.posting)}
                      />
                    </label>

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
                          reportingOfficerId: "",
                          countersigningOfficerId: "",
                        }))
                      }
                      placeholder={manualOptionsLoading ? "Loading offices..." : "Search office by name"}
                      emptyMessage="No office found in your visible scope."
                      disabled={manualOptionsLoading}
                      invalid={invalidManualFields.office}
                    />

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
                      <div className="rounded-2xl border border-[#D8DEE8] bg-white px-4 py-4 text-sm text-[#475569]">
                        <p className="font-semibold text-[#111827]">Countersigning Officer</p>
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
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          {step === 2 ? (
            <div className="space-y-5">
              <div className="rounded-[20px] border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">Employee Source</p>
                    <p className="mt-2 text-lg font-semibold text-[#111827]">
                      {employeeSource === "manual"
                        ? "Employee record was created in master data for this ACR initiation."
                        : "Employee record fetched from the existing database."}
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3 xl:min-w-[520px]">
                    {[
                      { label: "Employee", value: employeeName },
                      { label: "Rank", value: `${employeeRank} · ${employeeBps}` },
                      { label: "Template", value: templateLabels[previewTemplateFamily] },
                      { label: "Reporting Officer", value: reportingOfficer },
                      { label: "Countersigning Officer", value: countersigningOfficer },
                      { label: "Office", value: employeeOffice },
                    ].map((field) => (
                      <div key={field.label}>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9CA3AF]">{field.label}</p>
                        <p className="mt-2 text-sm font-medium text-[#111827]">{field.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border border-[#E5E7EB] bg-white p-4">
                <div className="mb-4 flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EEF2FF] text-[#1A1C6E]">
                    <FileText size={18} />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-[#111827]">Clerk Section Only</p>
                    <p className="mt-1 text-sm text-[#6B7280]">
                      Fill the initiation section only. The official paper-format replica opens for the Reporting Officer after submission, with this data available for review and continuation.
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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

                  <label className="text-sm text-[#475569]">
                    Zone / Circle / Sub-Circle
                    <input
                      value={clerkSection.zoneCircle}
                      onChange={(event) => updateClerkSection("zoneCircle", event.target.value)}
                      maxLength={100}
                      placeholder="Zone or circle"
                      className={getFieldClasses(false, true)}
                    />
                  </label>

                  <label className="text-sm text-[#475569]">
                    Direct / Deputationist
                    <input
                      value={clerkSection.directDeputationist}
                      onChange={(event) => updateClerkSection("directDeputationist", event.target.value)}
                      maxLength={80}
                      placeholder="Direct or deputationist"
                      className={getFieldClasses(false, true)}
                    />
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

                  <label className="flex items-center gap-3 rounded-2xl border border-[#E5E7EB] px-4 py-3 text-sm text-[#475569]">
                    <input
                      type="checkbox"
                      checked={clerkSection.isPriority}
                      onChange={(event) => updateClerkSection("isPriority", event.target.checked)}
                      className="h-4 w-4 rounded border border-[#CBD5E1] text-[#1A1C6E] focus:ring-[#1A1C6E]"
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

              <div className="rounded-[20px] border border-[#D8DEE8] bg-white p-4">
                <div className="flex flex-col gap-1.5 border-b border-[#EEF2F7] pb-3.5">
                  <p className="text-lg font-semibold text-[#111827]">Official form preview</p>
                  <p className="text-sm text-[#64748B]">
                    The selected template now loads with the current clerk-entered data inside the actual form layout. Clerk-stage fields can be refined on the draft record after save, while later officer sections remain protected for the next workflow holders.
                  </p>
                </div>

                <div className="mt-4 overflow-x-auto rounded-[20px] bg-[#EDF2F7] p-3 sm:p-4 lg:p-5">
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
            <div className="space-y-4">
              <div className="overflow-hidden rounded-[20px] border border-[#E5E7EB] bg-white">
                <div className="grid gap-6 px-4 py-4 lg:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">Employee Information</p>
                    <div className="mt-4 space-y-2.5">
                      {[
                        { label: "Full Name", value: employeeName },
                        { label: "Rank", value: employeeRank },
                        { label: "BPS", value: employeeBps },
                        { label: "CNIC", value: employeeCnic },
                        { label: "Mobile", value: employeeMobile },
                        { label: "Wing", value: employeeWing },
                      ].map((field) => (
                        <div key={field.label} className="grid grid-cols-[150px_minmax(0,1fr)] gap-4 text-sm">
                          <span className="text-[#6B7280]">{field.label}</span>
                          <span className="font-semibold text-[#111827]">{field.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#94A3B8]">ACR Details</p>
                    <div className="mt-4 space-y-2.5">
                      {[
                        { label: "Template", value: templateLabels[previewTemplateFamily] },
                        { label: "Reporting Period", value: `${clerkSection.periodFrom} to ${clerkSection.periodTo}` },
                        { label: "Reporting Officer", value: reportingOfficer },
                        { label: "Countersigning Officer", value: countersigningOfficer },
                        { label: "Wing", value: employeeWing },
                        { label: "Office", value: employeeOffice },
                      ].map((field) => (
                        <div key={field.label} className="grid grid-cols-[170px_minmax(0,1fr)] gap-4 text-sm">
                          <span className="text-[#6B7280]">{field.label}</span>
                          <span className="font-semibold text-[#111827]">{field.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-[#EEF2F7] px-4 py-4">
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
        <div className="rounded-2xl border border-[#FECACA] bg-[#FFF1F2] px-4 py-2.5 text-sm text-[#BE123C]">{validationMessage}</div>
      ) : null}

      <div className="portal-floating-action-bar">
        <div className="rounded-[24px] border border-[#D8DEE8] bg-white/96 px-4 py-4 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur">
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
