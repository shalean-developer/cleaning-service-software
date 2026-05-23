import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminBookingWizard } from "./components/AdminBookingWizard";
import { AdminBookingWizardStepPanel } from "./components/steps/AdminBookingWizardStepPanels";

vi.mock("@/lib/app/adminAssistedBookingFlag", () => ({
  isAdminAssistedBookingEnabled: () => false,
}));

describe("AdminBookingWizard (Phase 1 read-only)", () => {
  it("renders design-mode banner and eight-step stepper", () => {
    const html = renderToStaticMarkup(<AdminBookingWizard />);

    expect(html).toContain('data-testid="admin-booking-design-mode-banner"');
    expect(html).toContain("read-only shell");
    expect(html).toContain('aria-label="Admin booking progress"');
    expect(html).toContain("Customer");
    expect(html).toContain("Confirmation");
  });

  it("renders sticky summary on desktop and mobile summary sheet", () => {
    const html = renderToStaticMarkup(<AdminBookingWizard />);

    expect(html).toContain('data-testid="admin-booking-summary-sidebar"');
    expect(html).toContain('data-testid="admin-booking-summary-mobile"');
    expect(html).toContain("No audit events (read-only)");
  });

  it("disables all confirmation mutation buttons on the confirmation step", () => {
    const html = renderToStaticMarkup(<AdminBookingWizardStepPanel step="confirmation" />);

    expect(html).toContain('data-testid="admin-booking-confirmation-actions"');
    expect(html).toContain("Save draft");
    expect(html).toContain("Finalize paid booking");
    expect((html.match(/\bdisabled\b/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("does not expose enabled create-booking submit actions", () => {
    const html = renderToStaticMarkup(<AdminBookingWizard />);

    expect(html).not.toMatch(/type="submit"[^>]*>(?!.*disabled)/);
    expect(html).not.toContain('action="/api/admin/bookings"');
  });
});
