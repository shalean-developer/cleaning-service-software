import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminBookingWizard } from "./components/AdminBookingWizard";
import { AdminBookingWizardConfirmationActions } from "./components/AdminBookingWizardConfirmationActions";
import { EMPTY_ADMIN_BOOKING_WIZARD_FORM } from "./draftFormState";

describe("AdminBookingWizard", () => {
  it("renders design-mode banner", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizard featureEnabled={false} paymentLinksEnabled={false} />,
    );
    expect(html).toContain('data-testid="admin-booking-design-mode-banner"');
  });

  it("disables save draft when feature flag is off", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardConfirmationActions
        featureEnabled={false}
        paymentLinksEnabled={false}
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

  it("keeps finalize and payment request disabled when flag is on", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardConfirmationActions
        featureEnabled={true}
        paymentLinksEnabled={false}
        form={EMPTY_ADMIN_BOOKING_WIZARD_FORM}
      />,
    );
    expect(html).toContain('data-testid="admin-booking-finalize-paid"');
    expect(html).toContain('data-testid="admin-booking-send-payment-request"');
    function buttonDisabled(markup: string, testId: string): boolean {
      const idx = markup.indexOf(`data-testid="${testId}"`);
      const start = markup.lastIndexOf("<button", idx);
      const end = markup.indexOf(">", idx);
      return markup.slice(start, end + 1).includes("disabled");
    }
    expect(buttonDisabled(html, "admin-booking-finalize-paid")).toBe(true);
    expect(buttonDisabled(html, "admin-booking-send-payment-request")).toBe(true);
  });
});
