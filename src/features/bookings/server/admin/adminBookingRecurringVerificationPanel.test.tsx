import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminBookingRecurringVerificationPanel } from "@/components/dashboard/admin/AdminBookingRecurringVerificationPanel";
import type { AdminBookingRecurringVerification } from "./loadAdminBookingRecurringVerification";
import { resolveMaterializationStatusForTest } from "./loadAdminBookingRecurringVerification.testSupport";

function sampleVerification(
  overrides: Partial<AdminBookingRecurringVerification> = {},
): AdminBookingRecurringVerification {
  return {
    readOnly: true,
    schedule: {
      recurringEnabled: true,
      pricingFrequency: "weekly",
      selectedDays: [1, 4],
      intervalWeeks: 1,
      configuredVia: "admin_wizard_custom",
      scheduleSummaryLabel: "Every Monday and Thursday at 09:00",
      cadenceLabel: "Weekly",
      selectedDaysLabel: "Mon · Thu",
    },
    materializationStatus: "succeeded",
    materializationStatusLabel: "Materialized",
    groupId: "group-123",
    groupHref: "/admin/recurring/groups/group-123",
    seriesIds: ["series-mon", "series-thu"],
    primarySeriesId: "series-mon",
    nextOccurrenceAt: "2099-06-10T07:00:00.000Z",
    nextOccurrencePreview: "10 Jun 2099, 09:00",
    generatedOccurrenceCount: 2,
    latestGeneratedOccurrenceAt: "2099-06-03T07:00:00.000Z",
    diagnostics: {
      bookingSeriesId: "series-mon",
      anchorBookingId: "booking-1",
      seriesLinkedToBooking: true,
      groupLinked: true,
    },
    ...overrides,
  };
}

describe("AdminBookingRecurringVerificationPanel", () => {
  it("renders recurring verification details", () => {
    const html = renderToStaticMarkup(
      <AdminBookingRecurringVerificationPanel verification={sampleVerification()} />,
    );

    expect(html).toContain('data-testid="admin-booking-recurring-verification-panel"');
    expect(html).toContain('data-testid="admin-booking-recurring-summary"');
    expect(html).toContain("Every Monday and Thursday at 09:00");
    expect(html).toContain("Materialized");
    expect(html).toContain("/admin/recurring/groups/group-123");
  });

  it("renders nothing when recurring is disabled", () => {
    const html = renderToStaticMarkup(
      <AdminBookingRecurringVerificationPanel
        verification={sampleVerification({
          schedule: {
            recurringEnabled: false,
            pricingFrequency: "once",
            selectedDays: [],
            intervalWeeks: null,
            configuredVia: null,
            scheduleSummaryLabel: null,
            cadenceLabel: null,
            selectedDaysLabel: null,
          },
        })}
      />,
    );

    expect(html).toBe("");
  });
});

describe("recurring materialization diagnostics", () => {
  it("labels pending materialization for confirmed bookings without series", () => {
    expect(
      resolveMaterializationStatusForTest({
        recurringEnabled: true,
        bookingStatus: "confirmed",
        hasSeriesOrGroup: false,
      }),
    ).toBe("pending_materialization");
  });
});
