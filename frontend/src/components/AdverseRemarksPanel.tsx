"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Clock, MessageSquare, Shield } from "lucide-react";
import {
  acknowledgeAdverseRemark,
  communicateAdverseRemark,
  createAdverseRemark,
  decideAdverseRepresentation,
  endorseAdverseRemark,
  getAdverseRemarks,
  submitAdverseRepresentation,
} from "@/api/client";
import type { AdverseRemarkSummary, AdverseRemarkStatus, UserRoleCode } from "@/types/contracts";

interface AdverseRemarksPanelProps {
  acrId: string;
  activeRoleCode: UserRoleCode;
  workflowState: string;
}

const statusLabels: Record<AdverseRemarkStatus, string> = {
  DRAFT: "Recorded by RO",
  ENDORSED_BY_CSO: "Endorsed by CSO",
  COMMUNICATED: "Communicated to Officer",
  ACKNOWLEDGED: "Acknowledged by Officer",
  REPRESENTATION_RECEIVED: "Representation Received",
  REPRESENTATION_DECIDED: "Decision Made",
};

const statusColors: Record<AdverseRemarkStatus, string> = {
  DRAFT: "bg-amber-50 text-amber-700 border-amber-200",
  ENDORSED_BY_CSO: "bg-red-50 text-red-700 border-red-200",
  COMMUNICATED: "bg-blue-50 text-blue-700 border-blue-200",
  ACKNOWLEDGED: "bg-teal-50 text-teal-700 border-teal-200",
  REPRESENTATION_RECEIVED: "bg-purple-50 text-purple-700 border-purple-200",
  REPRESENTATION_DECIDED: "bg-green-50 text-green-700 border-green-200",
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-PK", { year: "numeric", month: "short", day: "numeric" });
}

function daysRemaining(deadline: string | null) {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

export function AdverseRemarksPanel({ acrId, activeRoleCode, workflowState }: AdverseRemarksPanelProps) {
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [remarkText, setRemarkText] = useState("");
  const [counsellingDate, setCounsellingDate] = useState("");
  const [counsellingNotes, setCounsellingNotes] = useState("");
  const [representationText, setRepresentationText] = useState("");
  const [activeRepresentationId, setActiveRepresentationId] = useState<string | null>(null);
  const [decisionText, setDecisionText] = useState("");
  const [decisionNotes, setDecisionNotes] = useState("");
  const [activeDecisionId, setActiveDecisionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: remarks = [], isLoading } = useQuery({
    queryKey: ["adverse-remarks", acrId],
    queryFn: () => getAdverseRemarks(acrId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["adverse-remarks", acrId] });

  const createMutation = useMutation({
    mutationFn: () => createAdverseRemark(acrId, { remarkText, counsellingDate: counsellingDate || undefined, counsellingNotes: counsellingNotes || undefined }),
    onSuccess: () => { invalidate(); setShowCreateForm(false); setRemarkText(""); setCounsellingDate(""); setCounsellingNotes(""); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const endorseMutation = useMutation({
    mutationFn: (remarkId: string) => endorseAdverseRemark(acrId, remarkId),
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const communicateMutation = useMutation({
    mutationFn: (remarkId: string) => communicateAdverseRemark(acrId, remarkId),
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (remarkId: string) => acknowledgeAdverseRemark(acrId, remarkId),
    onSuccess: () => { invalidate(); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const representationMutation = useMutation({
    mutationFn: (remarkId: string) => submitAdverseRepresentation(acrId, remarkId, representationText),
    onSuccess: () => { invalidate(); setActiveRepresentationId(null); setRepresentationText(""); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const decideMutation = useMutation({
    mutationFn: (remarkId: string) => decideAdverseRepresentation(acrId, remarkId, decisionText, decisionNotes),
    onSuccess: () => { invalidate(); setActiveDecisionId(null); setDecisionText(""); setDecisionNotes(""); setError(null); },
    onError: (e: Error) => setError(e.message),
  });

  const canCreateRemark =
    (activeRoleCode === "REPORTING_OFFICER" || activeRoleCode === "SUPER_ADMIN" || activeRoleCode === "IT_OPS") &&
    (workflowState === "Pending Reporting" || workflowState === "Returned to Reporting Officer");

  const canEndorse =
    (activeRoleCode === "COUNTERSIGNING_OFFICER" || activeRoleCode === "SUPER_ADMIN" || activeRoleCode === "IT_OPS") &&
    (workflowState === "Pending Countersigning" || workflowState === "Returned to Countersigning Officer");

  const canCommunicate =
    activeRoleCode === "SECRET_BRANCH" || activeRoleCode === "SUPER_ADMIN" || activeRoleCode === "IT_OPS";

  const canRepresent = activeRoleCode === "EMPLOYEE";

  const canDecide =
    activeRoleCode === "DG" || activeRoleCode === "WING_OVERSIGHT" ||
    activeRoleCode === "ZONAL_OVERSIGHT" || activeRoleCode === "SUPER_ADMIN" || activeRoleCode === "IT_OPS";

  if (isLoading) {
    return <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">Loading adverse remarks...</div>;
  }

  if (remarks.length === 0 && !canCreateRemark) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-red-200 bg-red-50/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle size={18} className="text-red-600" />
        <h3 className="text-base font-semibold text-red-800">Adverse Remarks</h3>
        <span className="text-xs text-red-500">FIA Standing Order No. 02/2023</span>
      </div>

      {error && (
        <div className="mb-3 rounded-xl border border-red-300 bg-red-100 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {remarks.map((remark) => (
        <div key={remark.id} className="mb-3 rounded-xl border border-gray-200 bg-white p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium text-gray-900">{remark.remarkText}</p>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[remark.status]}`}>
              {statusLabels[remark.status]}
            </span>
          </div>

          {remark.counsellingDate && (
            <p className="mt-1 text-xs text-gray-500">
              Counselling on {formatDate(remark.counsellingDate)}
              {remark.counsellingNotes ? ` — ${remark.counsellingNotes}` : ""}
            </p>
          )}

          <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
            <span>Recorded: {formatDate(remark.createdAt)}</span>
            {remark.endorsedAt && <span>Endorsed: {formatDate(remark.endorsedAt)}</span>}
            {remark.communicatedAt && <span>Communicated: {formatDate(remark.communicatedAt)}</span>}
            {remark.communicationDeadline && remark.status === "ENDORSED_BY_CSO" && (
              <span className="flex items-center gap-1 text-amber-600">
                <Clock size={12} />
                Communication due in {daysRemaining(remark.communicationDeadline)} days
              </span>
            )}
          </div>

          {remark.representation && (
            <div className="mt-2 rounded-lg border border-purple-200 bg-purple-50 p-2">
              <p className="text-xs font-medium text-purple-800">Representation:</p>
              <p className="mt-0.5 text-xs text-purple-700">{remark.representation.representationText}</p>
              {remark.representation.decision && (
                <div className="mt-1 border-t border-purple-200 pt-1">
                  <p className="text-xs font-medium text-green-800">
                    Decision: {remark.representation.decision}
                  </p>
                  <p className="text-xs text-green-700">{remark.representation.decisionNotes}</p>
                  <p className="text-xs text-gray-500">
                    By {remark.representation.decidedByName} on {formatDate(remark.representation.decisionDate)}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action buttons per role */}
          <div className="mt-2 flex gap-2">
            {canEndorse && remark.status === "DRAFT" && (
              <button
                type="button"
                onClick={() => endorseMutation.mutate(remark.id)}
                disabled={endorseMutation.isPending}
                className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
              >
                <Shield size={12} />
                Endorse (Underline in Red)
              </button>
            )}

            {canCommunicate && remark.status === "ENDORSED_BY_CSO" && (
              <button
                type="button"
                onClick={() => communicateMutation.mutate(remark.id)}
                disabled={communicateMutation.isPending}
                className="inline-flex items-center gap-1 rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
              >
                <MessageSquare size={12} />
                Communicate to Officer
              </button>
            )}

            {canRepresent && remark.status === "COMMUNICATED" && (
              <button
                type="button"
                onClick={() => acknowledgeMutation.mutate(remark.id)}
                disabled={acknowledgeMutation.isPending}
                className="inline-flex items-center gap-1 rounded-lg border border-teal-300 bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-700 hover:bg-teal-100 disabled:opacity-50"
              >
                <Check size={12} />
                Acknowledge Receipt
              </button>
            )}

            {canRepresent && remark.status === "ACKNOWLEDGED" && !remark.representation && (
              <>
                {activeRepresentationId === remark.id ? (
                  <div className="flex w-full flex-col gap-2">
                    <textarea
                      value={representationText}
                      onChange={(e) => setRepresentationText(e.target.value)}
                      aria-label="Representation text"
                      placeholder="Write your representation against this adverse remark..."
                      rows={3}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => representationMutation.mutate(remark.id)}
                        disabled={representationMutation.isPending || representationText.length < 10}
                        className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        Submit Representation
                      </button>
                      <button
                        type="button"
                        onClick={() => { setActiveRepresentationId(null); setRepresentationText(""); }}
                        className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveRepresentationId(remark.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-purple-300 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100"
                  >
                    Submit Representation (within 30 days)
                  </button>
                )}
              </>
            )}

            {canDecide && remark.status === "REPRESENTATION_RECEIVED" && (
              <>
                {activeDecisionId === remark.id ? (
                  <div className="flex w-full flex-col gap-2">
                    <select
                      value={decisionText}
                      onChange={(e) => setDecisionText(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-400"
                    >
                      <option value="">Select decision...</option>
                      <option value="UPHELD">Adverse Remark Upheld</option>
                      <option value="EXPUNGED">Adverse Remark Expunged</option>
                      <option value="PARTIALLY_EXPUNGED">Partially Expunged</option>
                    </select>
                    <textarea
                      value={decisionNotes}
                      onChange={(e) => setDecisionNotes(e.target.value)}
                      placeholder="Assessment / grading notes for expunged entries..."
                      rows={2}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => decideMutation.mutate(remark.id)}
                        disabled={decideMutation.isPending || !decisionText || decisionNotes.length < 5}
                        className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        <Check size={12} className="mr-1 inline" />
                        Record Decision
                      </button>
                      <button
                        type="button"
                        onClick={() => { setActiveDecisionId(null); setDecisionText(""); setDecisionNotes(""); }}
                        className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveDecisionId(remark.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100"
                  >
                    <Check size={12} />
                    Decide on Representation
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ))}

      {canCreateRemark && (
        <>
          {showCreateForm ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
              <p className="mb-2 text-sm font-medium text-amber-800">
                Record Adverse Remark (FIA Rule xv: Counselling must be done before recording)
              </p>
              <div className="space-y-2">
                <input
                  type="date"
                  value={counsellingDate}
                  onChange={(e) => setCounsellingDate(e.target.value)}
                  aria-label="Counselling date"
                  placeholder="Counselling date"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-400"
                />
                <input
                  value={counsellingNotes}
                  onChange={(e) => setCounsellingNotes(e.target.value)}
                  aria-label="Counselling notes"
                  placeholder="Brief counselling notes (optional)"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-400"
                />
                <textarea
                  value={remarkText}
                  onChange={(e) => setRemarkText(e.target.value)}
                  aria-label="Adverse remark text"
                  placeholder="Adverse remark text..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending || remarkText.length < 5}
                    className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Record Adverse Remark
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreateForm(false); setRemarkText(""); setCounsellingDate(""); setCounsellingNotes(""); }}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100"
            >
              <AlertTriangle size={14} />
              Record Adverse Remark
            </button>
          )}
        </>
      )}
    </div>
  );
}
