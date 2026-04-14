import {
  getGradeSubmissionDeadline,
  getRoDeadline,
  getCsoDeadline,
  deriveCalendarYear,
} from "./deadline.utils";

describe("deadline.utils", () => {
  describe("getGradeSubmissionDeadline", () => {
    it("returns January 31 for BPS 21", () => {
      const deadline = getGradeSubmissionDeadline(21, 2025);
      expect(deadline.getFullYear()).toBe(2026);
      expect(deadline.getMonth()).toBe(0);
      expect(deadline.getDate()).toBe(31);
    });

    it("returns January 31 for BPS 20", () => {
      const deadline = getGradeSubmissionDeadline(20, 2025);
      expect(deadline.getFullYear()).toBe(2026);
      expect(deadline.getMonth()).toBe(0);
      expect(deadline.getDate()).toBe(31);
    });

    it("returns February 28 for BPS 19 in non-leap year", () => {
      const deadline = getGradeSubmissionDeadline(19, 2024);
      expect(deadline.getFullYear()).toBe(2025);
      expect(deadline.getMonth()).toBe(1);
      expect(deadline.getDate()).toBe(28);
    });

    it("returns February 29 for BPS 19 in leap year", () => {
      const deadline = getGradeSubmissionDeadline(19, 2027);
      expect(deadline.getFullYear()).toBe(2028);
      expect(deadline.getMonth()).toBe(1);
      expect(deadline.getDate()).toBe(29);
    });

    it("returns March 31 for BPS 18", () => {
      const deadline = getGradeSubmissionDeadline(18, 2025);
      expect(deadline.getFullYear()).toBe(2026);
      expect(deadline.getMonth()).toBe(2);
      expect(deadline.getDate()).toBe(31);
    });

    it("returns March 31 for BPS 17", () => {
      const deadline = getGradeSubmissionDeadline(17, 2025);
      expect(deadline.getFullYear()).toBe(2026);
      expect(deadline.getMonth()).toBe(2);
      expect(deadline.getDate()).toBe(31);
    });

    it("returns April 30 for BPS 16", () => {
      const deadline = getGradeSubmissionDeadline(16, 2025);
      expect(deadline.getFullYear()).toBe(2026);
      expect(deadline.getMonth()).toBe(3);
      expect(deadline.getDate()).toBe(30);
    });

    it("returns April 30 for BPS 1", () => {
      const deadline = getGradeSubmissionDeadline(1, 2025);
      expect(deadline.getFullYear()).toBe(2026);
      expect(deadline.getMonth()).toBe(3);
      expect(deadline.getDate()).toBe(30);
    });

    it("returns January 31 for BPS 22 (above max)", () => {
      const deadline = getGradeSubmissionDeadline(22, 2025);
      expect(deadline.getMonth()).toBe(0);
      expect(deadline.getDate()).toBe(31);
    });
  });

  describe("getRoDeadline", () => {
    it("returns 14 days from base when within grade deadline", () => {
      const base = new Date(2026, 0, 1);
      const gradeDeadline = new Date(2026, 3, 30);
      const result = getRoDeadline(base, gradeDeadline);
      expect(result.getDate()).toBe(15);
      expect(result.getMonth()).toBe(0);
    });

    it("caps at grade deadline when 14 days would exceed it", () => {
      const base = new Date(2026, 0, 25);
      const gradeDeadline = new Date(2026, 0, 31);
      const result = getRoDeadline(base, gradeDeadline);
      expect(result.getTime()).toBe(gradeDeadline.getTime());
    });
  });

  describe("getCsoDeadline", () => {
    it("returns 14 days from RO submission", () => {
      const roSubmitted = new Date(2026, 0, 15);
      const gradeDeadline = new Date(2026, 3, 30);
      const result = getCsoDeadline(roSubmitted, gradeDeadline);
      expect(result.getDate()).toBe(29);
      expect(result.getMonth()).toBe(0);
    });

    it("caps at grade deadline when 14 days would exceed it", () => {
      const roSubmitted = new Date(2026, 0, 20);
      const gradeDeadline = new Date(2026, 0, 31);
      const result = getCsoDeadline(roSubmitted, gradeDeadline);
      expect(result.getTime()).toBe(gradeDeadline.getTime());
    });
  });

  describe("deriveCalendarYear", () => {
    it("returns the year from periodFrom", () => {
      expect(deriveCalendarYear(new Date(2025, 0, 1))).toBe(2025);
      expect(deriveCalendarYear(new Date(2026, 11, 31))).toBe(2026);
    });
  });
});
