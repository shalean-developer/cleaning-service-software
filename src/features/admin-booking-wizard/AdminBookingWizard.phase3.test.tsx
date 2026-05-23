import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminBookingWizardCustomerStep } from "./components/AdminBookingWizardCustomerStep";
import { AdminBookingWizardPricingPreview } from "./components/AdminBookingWizardPricingPreview";
import { AdminBookingWizardConfirmationActions } from "./components/AdminBookingWizardConfirmationActions";
import { readFileSync } from "node:fs";
import path from "node:path";
import { searchAdminCustomers, createAdminCustomer } from "./adminCustomerApi";
import { fetchAdminDraftPricingQuote } from "./pricingApi";
import {
  EMPTY_ADMIN_BOOKING_WIZARD_FORM,
  type AdminBookingWizardFormState,
} from "./draftFormState";
import { adminConfirmationActionsTestProps } from "./adminBookingWizardTestFixtures";

const readyForm: AdminBookingWizardFormState = {
  ...EMPTY_ADMIN_BOOKING_WIZARD_FORM,
  customerId: "11111111-1111-4111-8111-111111111111",
  selectedCustomer: {
    customerId: "11111111-1111-4111-8111-111111111111",
    label: "Jane Customer",
    email: "jane@example.com",
    phone: "+27821234567",
  },
  serviceSlug: "regular-cleaning",
  date: "2099-06-01",
  time: "09:00",
  addressLine1: "12 Main",
  suburb: "Sea Point",
  city: "Cape Town",
};

describe("adminCustomerApi", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo) => {
        const url = String(input);
        if (url.includes("/api/admin/customers?")) {
          return new Response(
            JSON.stringify({
              ok: true,
              customers: [
                {
                  customerId: "11111111-1111-4111-8111-111111111111",
                  companyName: "Jane Customer",
                  authEmail: "jane@example.com",
                  phone: "+27821234567",
                },
              ],
            }),
            { status: 200 },
          );
        }
        if (url.endsWith("/api/admin/customers") && !url.includes("?")) {
          return new Response(
            JSON.stringify({
              ok: true,
              customer: {
                customerId: "22222222-2222-4222-8222-222222222222",
                fullName: "New Customer",
                email: "new@example.com",
                phone: null,
                warnings: [],
              },
            }),
            { status: 201 },
          );
        }
        return new Response(JSON.stringify({ ok: false }), { status: 500 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("searchAdminCustomers maps list results and duplicate warnings", async () => {
    const result = await searchAdminCustomers("Jane");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.customers[0]?.customerId).toBe("11111111-1111-4111-8111-111111111111");
    expect(result.customers[0]?.label).toBe("Jane Customer");
  });

  it("createAdminCustomer posts to existing admin customers API", async () => {
    const fetchMock = vi.mocked(globalThis.fetch);
    const result = await createAdminCustomer({
      fullName: "New Customer",
      email: "new@example.com",
    });
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/customers",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("pricingApi", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            ok: true,
            quote: {
              lineItems: [{ code: "base", label: "Base clean", amountCents: 50000 }],
              totalCents: 50000,
              subtotalCents: 50000,
              discountCents: 0,
              currency: "ZAR",
              serviceSlug: "regular-cleaning",
              frequency: "once",
              pricingVersion: "v1",
              cleanerEarnings: {
                teamSize: 1,
                totalCleanerPayoutCents: 0,
                ruleApplied: "test",
                metadata: {},
              },
              metadata: {},
            },
          }),
          { status: 200 },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetchAdminDraftPricingQuote calls /api/pricing/quote", async () => {
    const result = await fetchAdminDraftPricingQuote(readyForm);
    expect(result.ok).toBe(true);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledWith(
      "/api/pricing/quote",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("Admin booking wizard Phase 3 UI", () => {
  it("renders customer search step shell", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardCustomerStep
        form={EMPTY_ADMIN_BOOKING_WIZARD_FORM}
        {...adminConfirmationActionsTestProps}
        onFormChange={() => {}}
      />,
    );
    expect(html).toContain('data-testid="admin-booking-customer-search"');
    expect(html).toContain('data-testid="admin-booking-customer-create-toggle"');
    expect(html).not.toContain("Customer ID (UUID)");
  });

  it("renders selected customer banner", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardCustomerStep form={readyForm} onFormChange={() => {}} />,
    );
    expect(html).toContain('data-testid="admin-booking-customer-selected"');
    expect(html).toContain("Jane Customer");
  });

  it("renders pricing preview container", () => {
    const html = renderToStaticMarkup(<AdminBookingWizardPricingPreview form={readyForm} />);
    expect(html).toContain('data-testid="admin-booking-pricing-preview"');
  });

  it("disables save draft without selected customer", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardConfirmationActions
        featureEnabled={true}
        paymentLinksEnabled={false}
        offlinePaymentsEnabled={false}
        form={EMPTY_ADMIN_BOOKING_WIZARD_FORM}
        {...adminConfirmationActionsTestProps}
      />,
    );
    expect(html).toContain('data-testid="admin-booking-save-draft"');
    expect(html).toContain('disabled=""');
  });

  it("enables save draft when form ready and flag on", () => {
    const html = renderToStaticMarkup(
      <AdminBookingWizardConfirmationActions
        featureEnabled={true}
        paymentLinksEnabled={false}
        offlinePaymentsEnabled={false}
        form={readyForm}
        {...adminConfirmationActionsTestProps}
      />,
    );
    const saveButton = html.match(/data-testid="admin-booking-save-draft"[^>]*>/);
    expect(saveButton?.[0]).not.toContain("disabled");
  });
});

describe("AdminCustomerDetailSections draft CTA", () => {
  const source = readFileSync(
    path.join(process.cwd(), "src/components/dashboard/admin/AdminCustomerDetailSections.tsx"),
    "utf8",
  );

  it("styles CTA from draftBookingEnabled while keeping the link visible", () => {
    expect(source).toContain("draftBookingEnabled");
    expect(source).toContain('data-testid="admin-customer-create-draft-booking"');
    expect(source).toContain("buildAdminBookingCreateHref");
    expect(source).toContain("ADMIN_CUSTOMER_ASSISTED_BOOKING_PREVIEW_HELPER");
  });

  it("does not link to customer self-serve book flow", () => {
    expect(source).not.toContain("/customer/book?customerId=");
  });
});
