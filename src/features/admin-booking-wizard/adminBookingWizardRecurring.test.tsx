import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EMPTY_ADMIN_BOOKING_FLOW } from "./adminBookingFlowState";
import { AdminBookingWizardRecurringSchedulePanel } from "./components/AdminBookingWizardRecurringSchedulePanel";
import { AdminBookingWizardStepPanel } from "./components/steps/AdminBookingWizardStepPanels";
import { EMPTY_ADMIN_BOOKING_WIZARD_FORM } from "./draftFormState";

describe("admin booking wizard recurring UX", () => {
  it("renders custom frequency option in service step", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardStepPanel
        step="service"
        form={{
          ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
          serviceSlug: "regular-cleaning",
        }}
        onFormChange={() => undefined}
        featureEnabled
        paymentLinksEnabled={false}
        offlinePaymentsEnabled={false}
        flow={EMPTY_ADMIN_BOOKING_FLOW}
        onFlowChange={() => undefined}
        onFlowRefresh={async () => undefined}
      />,
    );

    expect(html).toContain('data-testid="admin-booking-frequency-select"');
    expect(html).toContain("Custom recurring");
  });

  it("shows recurring builder for custom frequency", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardRecurringSchedulePanel
        form={{
          ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
          frequency: "custom",
          recurringDays: [1, 4],
          recurringIntervalWeeks: 1,
          time: "09:00",
        }}
        onFormChange={() => undefined}
      />,
    );

    expect(html).toContain('data-testid="admin-booking-recurring-schedule-panel"');
    expect(html).toContain('data-testid="admin-booking-recurring-interval-weeks"');
    expect(html).toContain('data-testid="admin-booking-recurring-summary"');
    expect(html).toContain("Monday");
    expect(html).toContain("Thursday");
    expect(html).toContain("weekly-based");
  });
});
