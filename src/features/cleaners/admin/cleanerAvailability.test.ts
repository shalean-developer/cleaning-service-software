import { describe, expect, it } from "vitest";
import {
  CLEANER_AVAILABILITY_DEFAULT_WORKING_DAYS,
  defaultCleanerAvailabilityFormValues,
  formatCleanerAvailabilitySummary,
  validateCleanerAvailabilityForm,
} from "./cleanerAvailability";

describe("validateCleanerAvailabilityForm", () => {
  it("accepts default Mon-Sat 07:00-18:00", () => {
    const result = validateCleanerAvailabilityForm(defaultCleanerAvailabilityFormValues());
    expect(result.valid).toBe(true);
    expect(result.windows).toHaveLength(CLEANER_AVAILABILITY_DEFAULT_WORKING_DAYS.length);
    expect(result.windows[0]).toMatchObject({
      dayOfWeek: 1,
      startTime: "07:00:00",
      endTime: "18:00:00",
      timezone: "Africa/Johannesburg",
    });
  });

  it("rejects when no working days selected", () => {
    const result = validateCleanerAvailabilityForm({
      ...defaultCleanerAvailabilityFormValues(),
      workingDays: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.workingDays).toMatch(/at least one/i);
  });

  it("rejects when end time is not after start time", () => {
    const result = validateCleanerAvailabilityForm({
      workingDays: [1],
      startTime: "18:00",
      endTime: "07:00",
      timezone: "Africa/Johannesburg",
    });
    expect(result.valid).toBe(false);
    expect(result.errors.endTime).toMatch(/after start/i);
  });

  it("rejects duplicate working days", () => {
    const result = validateCleanerAvailabilityForm({
      ...defaultCleanerAvailabilityFormValues(),
      workingDays: [1, 1, 2],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.workingDays).toMatch(/once/i);
  });
});

describe("formatCleanerAvailabilitySummary", () => {
  it("formats Mon–Sat default hours", () => {
    const rows = [1, 2, 3, 4, 5, 6].map((day_of_week) => ({
      day_of_week,
      start_time: "07:00:00",
      end_time: "18:00:00",
      timezone: "Africa/Johannesburg",
    }));
    expect(formatCleanerAvailabilitySummary(rows)).toBe("Available Mon–Sat, 07:00–18:00");
  });

  it("returns message when no rows exist", () => {
    expect(formatCleanerAvailabilitySummary([])).toBe("No working hours set");
  });
});
