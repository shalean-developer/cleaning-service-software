import { describe, expect, it } from "vitest";
import { validateAdminSchedule } from "./adminScheduleValidation";

describe("validateAdminSchedule", () => {
  const now = new Date("2026-05-23T10:00:00+02:00");

  it("blocks past dates", () => {
    const result = validateAdminSchedule("2020-01-01", "09:00", now);
    expect(result.valid).toBe(false);
    expect(result.message).toBeTruthy();
  });

  it("blocks past times on today", () => {
    const result = validateAdminSchedule("2026-05-23", "08:00", now);
    expect(result.valid).toBe(false);
  });

  it("accepts a future slot within the booking window", () => {
    const result = validateAdminSchedule("2026-05-30", "14:00", now);
    expect(result.valid).toBe(true);
    expect(result.message).toBeNull();
  });

  it("requires both date and time", () => {
    expect(validateAdminSchedule("", "09:00", now).valid).toBe(false);
    expect(validateAdminSchedule("2026-05-30", "", now).valid).toBe(false);
  });
});
