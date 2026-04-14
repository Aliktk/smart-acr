import {
  validateMinimumPeriod,
  validateCalendarYearBoundary,
  validatePeriodOrder,
  validateReportingPeriod,
} from "./reporting-period.utils";

describe("reporting-period.utils", () => {
  describe("validateMinimumPeriod", () => {
    it("passes for exactly 3 months", () => {
      expect(validateMinimumPeriod(new Date(2025, 0, 1), new Date(2025, 3, 1))).toBeNull();
    });

    it("passes for full calendar year", () => {
      expect(validateMinimumPeriod(new Date(2025, 0, 1), new Date(2025, 11, 31))).toBeNull();
    });

    it("fails for 2 months", () => {
      expect(validateMinimumPeriod(new Date(2025, 0, 1), new Date(2025, 1, 28))).not.toBeNull();
    });

    it("fails for 1 month", () => {
      expect(validateMinimumPeriod(new Date(2025, 5, 1), new Date(2025, 5, 30))).not.toBeNull();
    });

    it("passes for 6 months", () => {
      expect(validateMinimumPeriod(new Date(2025, 0, 1), new Date(2025, 6, 1))).toBeNull();
    });
  });

  describe("validateCalendarYearBoundary", () => {
    it("passes for same calendar year", () => {
      expect(validateCalendarYearBoundary(new Date(2025, 0, 1), new Date(2025, 11, 31))).toBeNull();
    });

    it("fails when spanning two years", () => {
      expect(validateCalendarYearBoundary(new Date(2025, 6, 1), new Date(2026, 5, 30))).not.toBeNull();
    });

    it("fails for Dec 31 to Jan 1", () => {
      expect(validateCalendarYearBoundary(new Date(2025, 11, 31), new Date(2026, 0, 1))).not.toBeNull();
    });
  });

  describe("validatePeriodOrder", () => {
    it("passes when from is before to", () => {
      expect(validatePeriodOrder(new Date(2025, 0, 1), new Date(2025, 11, 31))).toBeNull();
    });

    it("passes when from equals to", () => {
      expect(validatePeriodOrder(new Date(2025, 5, 1), new Date(2025, 5, 1))).toBeNull();
    });

    it("fails when from is after to", () => {
      expect(validatePeriodOrder(new Date(2025, 11, 31), new Date(2025, 0, 1))).not.toBeNull();
    });
  });

  describe("validateReportingPeriod (combined)", () => {
    it("passes for Jan 1 to Dec 31 same year", () => {
      expect(validateReportingPeriod(new Date(2025, 0, 1), new Date(2025, 11, 31))).toBeNull();
    });

    it("fails for cross-year period", () => {
      const result = validateReportingPeriod(new Date(2025, 6, 1), new Date(2026, 5, 30));
      expect(result).toContain("calendar year");
    });

    it("fails for period under 3 months", () => {
      const result = validateReportingPeriod(new Date(2025, 9, 1), new Date(2025, 10, 30));
      expect(result).toContain("three");
    });

    it("fails for reversed dates", () => {
      const result = validateReportingPeriod(new Date(2025, 11, 31), new Date(2025, 0, 1));
      expect(result).toContain("start date");
    });

    it("passes for April to December (part period, 9 months)", () => {
      expect(validateReportingPeriod(new Date(2025, 3, 1), new Date(2025, 11, 31))).toBeNull();
    });
  });
});
