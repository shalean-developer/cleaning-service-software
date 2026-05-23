import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminBookingWizard } from "./components/AdminBookingWizard";
import { AdminBookingWizardConfirmationActions } from "./components/AdminBookingWizardConfirmationActions";
import { EMPTY_ADMIN_BOOKING_WIZARD_FORM } from "./draftFormState";

describe("AdminBookingWizard", () => {
  it("renders design-mode banner", () => {
    const html = renderToStaticMarkup(<AdminBookingWizard featureEnabled={false} />);
    expect(html).toContain('data-testid="admin-booking-design-mode-banner"');
  });

  it("disables save draft when feature flag is off", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardConfirmationActions
        featureEnabled={false}
        form={{
          ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
          customerId: "11111111-1111-4111-8111-111111111111",
          selectedCustomer: {
            customerId: "11111111-1111-4111-8111-111111111111",
            label: "Test Customer",
            email: null,
            phone: null,
          },
          serviceSlug: "regular-cleaning",
          date: "2099-06-01",
          time: "09:00",
          addressLine1: "12 Main",
          suburb: "Sea Point",
          city: "Cape Town",
        }}
      />,
    );
    expect(html).toContain('data-testid="admin-booking-save-draft"');
    expect(html).toContain('disabled=""');
  });

  it("keeps payment and finalize actions disabled when flag is on", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardConfirmationActions
        featureEnabled={true}
        form={EMPTY_ADMIN_BOOKING_WIZARD_FORM}
      />,
    );
    expect(html).toContain("Finalize paid booking");
    expect(html).toContain("Send payment request");
    const disabledCount = (html.match(/\bdisabled\b/g) ?? []).length;
    expect(disabledCount).toBeGreaterThanOrEqual(3);
  });
});
