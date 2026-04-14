"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createAcr, createEmployee, getEmployees, getManualEmployeeOptions, transitionAcr } from "@/api/client";
import { useShell } from "@/hooks/useShell";
import type {
  AcrClerkSection,
  AcrFormData,
  AcrReplicaState,
  AcrReviewerContext,
  EmployeeSummary,
  ManualEmployeePayload,
} from "@/types/contracts";
import { manualTemplateOptions, suggestTemplateByBps, templateRequiresCountersigning } from "@/utils/templates";

type StepKey = 1 | 2 | 3;
type EmployeeSource = "directory" | "manual";
type PageToast = { title: string; message?: string; tone?: "success" | "info" | "warning" | "danger" } | null;

function createInitialReplicaState(): AcrReplicaState {
  return { textFields: {}, checkFields: {}, assetFields: {} };
}

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

export function useAcrCreation() {
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
    const fromDirectory = employees.find((e) => e.id === selectedEmployeeId);
    return fromDirectory ?? (selectedEmployeeRecord?.id === selectedEmployeeId ? selectedEmployeeRecord : null);
  }, [employees, selectedEmployeeId, selectedEmployeeRecord]);

  const previewTemplateFamily = selectedEmployee?.templateFamily ?? manualEmployee.templateFamily;
  const requiresCountersigning = templateRequiresCountersigning(previewTemplateFamily);

  useEffect(() => {
    if (!pageToast) return;
    const timer = window.setTimeout(() => setPageToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [pageToast]);

  return {
    step, setStep,
    search, setSearch,
    selectedEmployeeId, setSelectedEmployeeId,
    selectedEmployeeRecord, setSelectedEmployeeRecord,
    employeeSource, setEmployeeSource,
    manualMode, setManualMode,
    manualTemplateId, setManualTemplateId,
    manualEmployee, setManualEmployee,
    clerkSection, setClerkSection,
    replicaStateSeed, setReplicaStateSeed,
    replicaStateRef,
    validationMessage, setValidationMessage,
    pageToast, setPageToast,
    employees, employeesFetching,
    manualOptions, manualOptionsLoading,
    selectedEmployee,
    previewTemplateFamily,
    requiresCountersigning,
    canInitiate,
    user,
    router,
    queryClient,
  };
}

export type AcrCreationState = ReturnType<typeof useAcrCreation>;
