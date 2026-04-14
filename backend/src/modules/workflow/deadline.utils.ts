/**
 * FIA Standing Order No. 02/2023 — Grade-based deadline calculation.
 *
 * Fixed submission deadlines by BPS grade (page 5):
 *   BPS 21 & 20  → January 31
 *   BPS 19       → February 28 (or 29 in leap years)
 *   BPS 18 & 17  → March 31
 *   BPS 16 & below → April 30
 *
 * After admin forwards to RO:  RO has 2 weeks.
 * After RO forwards to CSO:    CSO has 2 weeks.
 */

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Returns the fixed ACR submission deadline for a given BPS grade.
 * The deadline falls in the year AFTER the reporting calendar year.
 *
 * @param bps - Employee Basic Pay Scale (1-22)
 * @param reportingYear - The calendar year being evaluated (e.g. 2025)
 */
export function getGradeSubmissionDeadline(bps: number, reportingYear: number): Date {
  const deadlineYear = reportingYear + 1;

  if (bps >= 20) {
    return new Date(deadlineYear, 0, 31, 23, 59, 59);
  }

  if (bps === 19) {
    const feb = isLeapYear(deadlineYear) ? 29 : 28;
    return new Date(deadlineYear, 1, feb, 23, 59, 59);
  }

  if (bps >= 17) {
    return new Date(deadlineYear, 2, 31, 23, 59, 59);
  }

  return new Date(deadlineYear, 3, 30, 23, 59, 59);
}

/**
 * Calculates the RO deadline: 14 days from the given base date,
 * but never exceeding the overall grade deadline.
 */
export function getRoDeadline(baseDate: Date, gradeDueDate: Date): Date {
  const roDeadline = new Date(baseDate.getTime() + 14 * 24 * 60 * 60 * 1000);
  return roDeadline < gradeDueDate ? roDeadline : gradeDueDate;
}

/**
 * Calculates the CSO deadline: 14 days from when RO submitted,
 * but never exceeding the overall grade deadline.
 */
export function getCsoDeadline(roSubmittedAt: Date, gradeDueDate: Date): Date {
  const csoDeadline = new Date(roSubmittedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
  return csoDeadline < gradeDueDate ? csoDeadline : gradeDueDate;
}

/**
 * Derives the calendar year from reporting period dates.
 * Per FIA rules (item iii), both dates must fall in the same calendar year.
 */
export function deriveCalendarYear(periodFrom: Date): number {
  return periodFrom.getFullYear();
}
