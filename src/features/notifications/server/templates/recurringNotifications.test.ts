import { describe, expect, it } from "vitest";
import {
  buildRecurringPaymentRequiredChildEmail,
  buildRecurringPaymentReminderEmail,
} from "./recurringNotifications";

describe("recurring notification copy", () => {
  it("uses per-visit payment language, not subscription billing", () => {
    const email = buildRecurringPaymentRequiredChildEmail({
      bookingId: "b1",
      scheduledStart: "2026-06-01T08:00:00Z",
      scheduledEnd: "2026-06-01T10:00:00Z",
      metadata: {},
      payUrl: "https://example.com/pay",
      customerDisplayName: "Sam",
    });
    const combined = `${email.subject} ${email.text} ${email.html}`.toLowerCase();
    expect(combined).toContain("ready for payment");
    expect(combined).toContain("pay to confirm");
    expect(combined).not.toContain("subscription");
    expect(combined).not.toContain("auto-charge");
    expect(combined).not.toContain("automatically billed");
    expect(combined).not.toContain("monthly invoice");
  });

  it("reminder copy stresses pay before assignment", () => {
    const email = buildRecurringPaymentReminderEmail({
      bookingId: "b1",
      hoursSinceCreated: 30,
      payUrl: "https://example.com/pay",
    });
    expect(email.text).toContain("Cleaners are assigned after payment");
  });
});
