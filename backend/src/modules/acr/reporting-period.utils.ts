/**
 * FIA Standing Order No. 02/2023 — Reporting period validation.
 *
 * Item i:   ACRs prepared annually at close of each calendar year.
 * Item iii: Two calendar years cannot be combined into a single report.
 * Item x:   Minimum period of three months is essential per year.
 */

/**
 * Validates that the reporting period is at least 3 months.
 * FIA rule item x: minimum period of three months is essential.
 */
export function validateMinimumPeriod(from: Date, to: Date): string | null {
  const monthsDiff =
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());

  if (monthsDiff < 3) {
    return "Reporting period must be at least three (3) months as per FIA Standing Order No. 02/2023.";
  }

  return null;
}

/**
 * Validates that both dates fall within the same calendar year.
 * FIA rule item iii: two calendar years cannot be combined.
 */
export function validateCalendarYearBoundary(from: Date, to: Date): string | null {
  if (from.getFullYear() !== to.getFullYear()) {
    return "Reporting period cannot span multiple calendar years. Each ACR must cover a single calendar year as per FIA Standing Order No. 02/2023.";
  }

  return null;
}

/**
 * Validates that periodFrom is not after periodTo.
 */
export function validatePeriodOrder(from: Date, to: Date): string | null {
  if (from > to) {
    return "Reporting period start date cannot be after the end date.";
  }

  return null;
}

/**
 * Combined validation for all reporting period rules.
 */
export function validateReportingPeriod(from: Date, to: Date): string | null {
  return (
    validatePeriodOrder(from, to) ??
    validateCalendarYearBoundary(from, to) ??
    validateMinimumPeriod(from, to)
  );
}

/**
 * Valid reasons for sub-3-month segments (FIA rule item x exception).
 */
const SUB_MINIMUM_ALLOWED_REASONS = ["TRANSFER", "RETIREMENT", "SUSPENSION"];

/**
 * Checks if a sub-3-month period is allowed based on the reason.
 */
export function isSubMinimumPeriodAllowed(reason?: string | null): boolean {
  return reason ? SUB_MINIMUM_ALLOWED_REASONS.includes(reason) : false;
}

/**
 * Validates officer segments for a multi-officer ACR.
 * Segments must be contiguous and within the ACR reporting period.
 */
export function validateSegmentPeriods(
  segments: Array<{ from: Date; to: Date; reason?: string | null }>,
  acrFrom: Date,
  acrTo: Date,
): string | null {
  if (segments.length === 0) return null;

  const sorted = [...segments].sort((a, b) => a.from.getTime() - b.from.getTime());

  for (let i = 0; i < sorted.length; i++) {
    const seg = sorted[i];

    if (seg.from < acrFrom || seg.to > acrTo) {
      return `Segment ${i + 1} falls outside the ACR reporting period.`;
    }

    if (seg.from > seg.to) {
      return `Segment ${i + 1} has an invalid date range.`;
    }

    const monthsDiff = (seg.to.getFullYear() - seg.from.getFullYear()) * 12 + (seg.to.getMonth() - seg.from.getMonth());
    if (monthsDiff < 3 && !isSubMinimumPeriodAllowed(seg.reason)) {
      return `Segment ${i + 1} is less than 3 months. A valid reason (TRANSFER, RETIREMENT, SUSPENSION) is required for sub-3-month segments.`;
    }

    if (i > 0) {
      const prevEnd = sorted[i - 1].to;
      const gapDays = Math.floor((seg.from.getTime() - prevEnd.getTime()) / (24 * 60 * 60 * 1000));
      if (gapDays > 1) {
        return `Gap detected between segment ${i} and segment ${i + 1}. Segments must be contiguous.`;
      }
    }
  }

  return null;
}
