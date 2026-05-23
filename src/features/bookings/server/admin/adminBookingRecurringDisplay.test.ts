import { describe, expect, it } from "vitest";
import { parseAdminBookingRecurringScheduleFromMetadata } from "./adminBookingRecurringDisplay";

describe("adminBookingRecurringDisplay", () => {
  it("formats custom Mon + Thu weekly summary from metadata", () => {
    const parsed = parseAdminBookingRecurringScheduleFromMetadata(
      {
        quote: { input: { frequency: "weekly" } },
        recurringSchedule: {
          selectedDays: [1, 4],
          intervalWeeks: 1,
          configuredVia: "admin_wizard_custom",
        },
      },
      "2099-06-03T07:00:00.000Z",
    );

    expect(parsed.recurringEnabled).toBe(true);
    expect(parsed.scheduleSummaryLabel).toContain("Monday");
    expect(parsed.scheduleSummaryLabel).toContain("Thursday");
    expect(parsed.selectedDaysLabel).toBe("Mon · Thu");
    expect(parsed.intervalWeeks).toBe(1);
  });

  it("formats bi-weekly Friday summary from metadata", () => {
    const parsed = parseAdminBookingRecurringScheduleFromMetadata(
      {
        quote: { input: { frequency: "biweekly" } },
        recurringSchedule: {
          selectedDays: [5],
          intervalWeeks: 2,
          configuredVia: "admin_wizard_custom",
        },
      },
      "2099-06-06T08:30:00.000Z",
    );

    expect(parsed.scheduleSummaryLabel).toBe("Every 2 weeks on Friday at 10:30");
    expect(parsed.cadenceLabel).toBe("Bi-weekly");
  });

  it("returns not applicable for once-off bookings", () => {
    const parsed = parseAdminBookingRecurringScheduleFromMetadata(
      { quote: { input: { frequency: "once" } } },
      "2099-06-01T07:00:00.000Z",
    );

    expect(parsed.recurringEnabled).toBe(false);
    expect(parsed.scheduleSummaryLabel).toBeNull();
  });
});
