import { describe, expect, it } from "vitest";
import {
  buildAdminRecurringScheduleMetadata,
  formatAdminRecurringScheduleSummary,
  resolveAdminPricingFrequency,
  validateAdminRecurringIntervalWeeks,
  validateAdminRecurringSchedule,
  validateAdminRecurringScheduleForDraftBody,
} from "./adminRecurringSchedule";

describe("adminRecurringSchedule", () => {
  describe("resolveAdminPricingFrequency", () => {
    it("maps custom interval 1 to weekly pricing", () => {
      expect(
        resolveAdminPricingFrequency({ frequency: "custom", recurringIntervalWeeks: 1 }),
      ).toBe("weekly");
    });

    it("maps custom interval 2 to biweekly pricing", () => {
      expect(
        resolveAdminPricingFrequency({ frequency: "custom", recurringIntervalWeeks: 2 }),
      ).toBe("biweekly");
    });

    it("passes through preset frequencies", () => {
      expect(
        resolveAdminPricingFrequency({ frequency: "monthly", recurringIntervalWeeks: 1 }),
      ).toBe("monthly");
    });
  });

  describe("validateAdminRecurringSchedule", () => {
    it("requires at least one weekday for custom", () => {
      expect(
        validateAdminRecurringSchedule({
          frequency: "custom",
          recurringDays: [],
          recurringIntervalWeeks: 1,
        }),
      ).toBe("Select at least one recurring weekday.");
    });

    it("rejects unsupported custom intervals", () => {
      expect(
        validateAdminRecurringSchedule({
          frequency: "custom",
          recurringDays: [1, 4],
          recurringIntervalWeeks: 3,
        }),
      ).toContain("not supported yet");
    });

    it("allows weekly preset with weekdays", () => {
      expect(
        validateAdminRecurringSchedule({
          frequency: "weekly",
          recurringDays: [1, 4],
          recurringIntervalWeeks: 1,
        }),
      ).toBeNull();
    });
  });

  describe("validateAdminRecurringIntervalWeeks", () => {
    it("rejects non-integers", () => {
      expect(validateAdminRecurringIntervalWeeks(1.5)).toContain("whole number");
    });

    it("rejects intervals above max", () => {
      expect(validateAdminRecurringIntervalWeeks(13)).toContain("cannot exceed");
    });
  });

  describe("formatAdminRecurringScheduleSummary", () => {
    it("formats multiple weekdays on weekly cadence", () => {
      expect(
        formatAdminRecurringScheduleSummary({
          frequency: "custom",
          recurringDays: [1, 4],
          recurringIntervalWeeks: 1,
          time: "09:00",
        }),
      ).toBe("Every Monday and Thursday at 09:00");
    });

    it("formats biweekly single weekday", () => {
      expect(
        formatAdminRecurringScheduleSummary({
          frequency: "custom",
          recurringDays: [5],
          recurringIntervalWeeks: 2,
          time: "10:30",
        }),
      ).toBe("Every 2 weeks on Friday at 10:30");
    });

    it("formats three weekdays", () => {
      expect(
        formatAdminRecurringScheduleSummary({
          frequency: "weekly",
          recurringDays: [2, 3, 5],
          recurringIntervalWeeks: 1,
        }),
      ).toBe("Every Tuesday, Wednesday, and Friday");
    });
  });

  describe("buildAdminRecurringScheduleMetadata", () => {
    it("persists selected days and custom interval metadata", () => {
      const meta = buildAdminRecurringScheduleMetadata({
        frequency: "custom",
        recurringDays: [1, 4],
        recurringIntervalWeeks: 2,
        scheduleDate: "2099-06-02",
      });

      expect(meta).toEqual({
        selectedDays: [1, 4],
        intervalWeeks: 2,
        configuredVia: "admin_wizard_custom",
      });
    });

    it("returns null for once-off bookings", () => {
      expect(
        buildAdminRecurringScheduleMetadata({
          frequency: "once",
          recurringDays: [1],
          recurringIntervalWeeks: 1,
          scheduleDate: "2099-06-02",
        }),
      ).toBeNull();
    });
  });

  describe("validateAdminRecurringScheduleForDraftBody", () => {
    it("rejects recurring schedule on once-off pricing", () => {
      expect(
        validateAdminRecurringScheduleForDraftBody({
          pricingFrequency: "once",
          recurringSchedule: {
            selectedDays: [1],
            configuredVia: "admin_wizard_custom",
          },
        }),
      ).toContain("only supported for weekly and bi-weekly");
    });

    it("rejects unsupported interval in draft body", () => {
      expect(
        validateAdminRecurringScheduleForDraftBody({
          pricingFrequency: "weekly",
          recurringSchedule: {
            selectedDays: [1],
            intervalWeeks: 4,
            configuredVia: "admin_wizard_custom",
          },
        }),
      ).toContain("not supported yet");
    });

    it("rejects frequency and interval mismatch", () => {
      expect(
        validateAdminRecurringScheduleForDraftBody({
          pricingFrequency: "weekly",
          recurringSchedule: {
            selectedDays: [1],
            intervalWeeks: 2,
            configuredVia: "admin_wizard_custom",
          },
        }),
      ).toContain("does not match");
    });

    it("accepts compatible weekly custom schedule", () => {
      expect(
        validateAdminRecurringScheduleForDraftBody({
          pricingFrequency: "weekly",
          recurringSchedule: {
            selectedDays: [1, 4],
            intervalWeeks: 1,
            configuredVia: "admin_wizard_custom",
          },
        }),
      ).toBeNull();
    });
  });
});
