import { OrgScopeTrack } from "@prisma/client";

export const ORG_SCOPE_FIELDS = [
  "wingId",
  "directorateId",
  "regionId",
  "zoneId",
  "circleId",
  "stationId",
  "branchId",
  "cellId",
  "officeId",
  "departmentId",
] as const;

export type OrgScopeField = (typeof ORG_SCOPE_FIELDS)[number];

export type OrgScopeLike = {
  id?: string | null;
  scopeTrack?: OrgScopeTrack | null;
  wingId?: string | null;
  directorateId?: string | null;
  regionId?: string | null;
  zoneId?: string | null;
  circleId?: string | null;
  stationId?: string | null;
  branchId?: string | null;
  cellId?: string | null;
  officeId?: string | null;
  departmentId?: string | null;
};

export type NormalizedOrgScope = {
  scopeTrack: OrgScopeTrack;
  wingId: string | null;
  directorateId: string | null;
  regionId: string | null;
  zoneId: string | null;
  circleId: string | null;
  stationId: string | null;
  branchId: string | null;
  cellId: string | null;
  officeId: string | null;
  departmentId: string | null;
};

const TRACK_FIELD_ORDER: Record<OrgScopeTrack, OrgScopeField[]> = {
  [OrgScopeTrack.WING]: ["departmentId", "officeId", "directorateId", "wingId"],
  [OrgScopeTrack.REGIONAL]: ["departmentId", "officeId", "cellId", "branchId", "stationId", "circleId", "zoneId", "regionId"],
};

export function inferScopeTrack(scope?: OrgScopeLike | null) {
  if (scope?.scopeTrack) {
    return scope.scopeTrack;
  }

  if (scope?.regionId || scope?.zoneId || scope?.circleId || scope?.stationId || scope?.branchId || scope?.cellId) {
    return OrgScopeTrack.REGIONAL;
  }

  return OrgScopeTrack.WING;
}

export function normalizeOrgScope(scope?: OrgScopeLike | null): NormalizedOrgScope {
  const track = inferScopeTrack(scope);
  const normalized: NormalizedOrgScope = {
    scopeTrack: track,
    wingId: scope?.wingId ?? null,
    directorateId: scope?.directorateId ?? null,
    regionId: scope?.regionId ?? null,
    zoneId: scope?.zoneId ?? null,
    circleId: scope?.circleId ?? null,
    stationId: scope?.stationId ?? null,
    branchId: scope?.branchId ?? null,
    cellId: scope?.cellId ?? null,
    officeId: scope?.officeId ?? scope?.id ?? null,
    departmentId: scope?.departmentId ?? null,
  };

  if (track === OrgScopeTrack.WING) {
    normalized.regionId = null;
    normalized.zoneId = null;
    normalized.circleId = null;
    normalized.stationId = null;
    normalized.branchId = null;
    normalized.cellId = null;
  } else {
    normalized.wingId = null;
    normalized.directorateId = null;
  }

  return normalized;
}

export function deepestScopeField(scope?: OrgScopeLike | null): OrgScopeField | null {
  const normalized = normalizeOrgScope(scope);

  for (const field of TRACK_FIELD_ORDER[normalized.scopeTrack]) {
    if (normalized[field]) {
      return field;
    }
  }

  return null;
}

export function scopeSpecificity(scope?: OrgScopeLike | null) {
  const field = deepestScopeField(scope);
  if (!field) {
    return 0;
  }

  const normalized = normalizeOrgScope(scope);
  const fields = TRACK_FIELD_ORDER[normalized.scopeTrack];
  return fields.length - fields.indexOf(field);
}

export function buildScopeWhere(scope?: OrgScopeLike | null) {
  const normalized = normalizeOrgScope(scope);
  const field = deepestScopeField(normalized);

  if (!field) {
    return null;
  }

  const value = normalized[field];
  return value ? { [field]: value } : null;
}

export function matchesOrgScope(scope?: OrgScopeLike | null, target?: OrgScopeLike | null) {
  const normalizedScope = normalizeOrgScope(scope);
  const normalizedTarget = normalizeOrgScope(target);
  const field = deepestScopeField(normalizedScope);

  if (!field) {
    return true;
  }

  return Boolean(normalizedScope[field] && normalizedScope[field] === normalizedTarget[field]);
}

export function describeScope(scope?: OrgScopeLike | null) {
  const normalized = normalizeOrgScope(scope);
  const field = deepestScopeField(normalized);

  if (!field) {
    return { track: normalized.scopeTrack, field: null, value: null };
  }

  return {
    track: normalized.scopeTrack,
    field,
    value: normalized[field],
  };
}
