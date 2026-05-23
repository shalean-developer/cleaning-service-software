import { describe, expect, it, vi, beforeEach } from "vitest";
import { loadCustomerPaymentHistory } from "./customerPaymentHistory";

const createSupabaseServerClientMock = vi.fn();
const requireServiceRoleClientMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: (...args: unknown[]) => createSupabaseServerClientMock(...args),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: () => requireServiceRoleClientMock(),
}));

function bookingClient(bookingIds: string[], payments: Record<string, unknown>[]) {
  return {
    from(table: string) {
      if (table === "bookings") {
        return {
          select: () => ({
            eq: () =>
              Promise.resolve({
                data: bookingIds.map((id) => ({ id })),
                error: null,
              }),
          }),
        };
      }
      if (table === "payments") {
        return {
          select: () => ({
            in: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: payments,
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

function serviceRoleClient(options: {
  zohoPayments?: Record<string, unknown>[];
  authCharges?: Record<string, unknown>[];
  paymentMethods?: Record<string, unknown>[];
}) {
  return {
    from(table: string) {
      if (table === "zoho_invoice_payments") {
        return {
          select: () => ({
            eq: (_column: string, email: string) => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: (options.zohoPayments ?? []).filter(
                      (row) => row.customer_email === email,
                    ),
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === "zoho_invoice_authorization_charges") {
        return {
          select: () => ({
            eq: (_column: string, email: string) => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: (options.authCharges ?? []).filter(
                      (row) => row.customer_email === email,
                    ),
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === "zoho_invoice_payment_methods") {
        return {
          select: () => ({
            in: () =>
              Promise.resolve({
                data: options.paymentMethods ?? [],
                error: null,
              }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe("loadCustomerPaymentHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns booking payments for the acting customer", async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      bookingClient(["booking-1"], [
        {
          id: "pay-1",
          booking_id: "booking-1",
          status: "paid",
          amount_cents: 5000,
          currency: "ZAR",
          provider: "paystack",
          provider_ref: "ref-booking-1",
          created_at: "2026-05-01T10:00:00.000Z",
          updated_at: "2026-05-01T10:05:00.000Z",
        },
      ]),
    );
    requireServiceRoleClientMock.mockReturnValue(serviceRoleClient({}));

    const result = await loadCustomerPaymentHistory({
      profileId: "profile-1",
      customerEmail: "jane@example.com",
      actingCustomerId: "customer-1",
      source: "all",
      status: "all",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "booking:pay-1",
      source: "booking",
      status: "paid",
      bookingId: "booking-1",
      paymentMethodLabel: "Online payment",
      actionUrl: "/customer/bookings/booking-1",
    });
    expect(result.items[0]).not.toHaveProperty("authorization_code");
    expect(result.items[0]).not.toHaveProperty("metadata");
  });

  it("returns Zoho invoice payments matched by normalized email", async () => {
    createSupabaseServerClientMock.mockResolvedValue(bookingClient([], []));
    requireServiceRoleClientMock.mockReturnValue(
      serviceRoleClient({
        zohoPayments: [
          {
            id: "zoho-pay-1",
            invoice_number: "INV-001",
            customer_email: "jane@example.com",
            amount_cents: 10_000,
            currency: "ZAR",
            status: "paid",
            paystack_reference: "zoho-ref-1",
            created_at: "2026-05-02T10:00:00.000Z",
            paid_at: "2026-05-02T10:05:00.000Z",
          },
        ],
      }),
    );

    const result = await loadCustomerPaymentHistory({
      profileId: "profile-1",
      customerEmail: "Jane@Example.com",
      actingCustomerId: "customer-1",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "zoho_invoice:zoho-pay-1",
      source: "zoho_invoice",
      invoiceNumber: "INV-001",
      paymentMethodLabel: "Paystack checkout",
      actionUrl: "/pay/INV-001",
    });
  });

  it("returns saved-card invoice charges with masked card label", async () => {
    createSupabaseServerClientMock.mockResolvedValue(bookingClient([], []));
    requireServiceRoleClientMock.mockReturnValue(
      serviceRoleClient({
        authCharges: [
          {
            id: "charge-1",
            invoice_number: "INV-002",
            customer_email: "jane@example.com",
            amount_cents: 7500,
            currency: "ZAR",
            status: "paid",
            paystack_reference: "charge-ref-1",
            payment_method_id: "method-1",
            created_at: "2026-05-03T10:00:00.000Z",
            paid_at: "2026-05-03T10:05:00.000Z",
          },
        ],
        paymentMethods: [
          {
            id: "method-1",
            card_type: "visa",
            bank: null,
            last4: "1234",
          },
        ],
      }),
    );

    const result = await loadCustomerPaymentHistory({
      profileId: "profile-1",
      customerEmail: "jane@example.com",
      actingCustomerId: "customer-1",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "saved_card_invoice:charge-1",
      source: "saved_card_invoice",
      paymentMethodLabel: "visa ending 1234",
      actionUrl: "/pay/INV-002",
    });
  });

  it("does not return another customer's Zoho rows", async () => {
    createSupabaseServerClientMock.mockResolvedValue(bookingClient([], []));
    requireServiceRoleClientMock.mockReturnValue(
      serviceRoleClient({
        zohoPayments: [
          {
            id: "zoho-pay-other",
            invoice_number: "INV-999",
            customer_email: "other@example.com",
            amount_cents: 1000,
            currency: "ZAR",
            status: "paid",
            paystack_reference: "other-ref",
            created_at: "2026-05-02T10:00:00.000Z",
            paid_at: "2026-05-02T10:05:00.000Z",
          },
        ],
      }),
    );

    const result = await loadCustomerPaymentHistory({
      profileId: "profile-1",
      customerEmail: "jane@example.com",
      actingCustomerId: "customer-1",
      source: "zoho_invoice",
    });

    expect(result.items).toHaveLength(0);
  });

  it("filters by source and status", async () => {
    createSupabaseServerClientMock.mockResolvedValue(
      bookingClient(["booking-1"], [
        {
          id: "pay-pending",
          booking_id: "booking-1",
          status: "pending",
          amount_cents: 1000,
          currency: "ZAR",
          provider: "paystack",
          provider_ref: "pending-ref",
          created_at: "2026-05-04T10:00:00.000Z",
          updated_at: "2026-05-04T10:00:00.000Z",
        },
      ]),
    );
    requireServiceRoleClientMock.mockReturnValue(
      serviceRoleClient({
        zohoPayments: [
          {
            id: "zoho-paid",
            invoice_number: "INV-003",
            customer_email: "jane@example.com",
            amount_cents: 2000,
            currency: "ZAR",
            status: "paid",
            paystack_reference: "paid-ref",
            created_at: "2026-05-04T09:00:00.000Z",
            paid_at: "2026-05-04T09:05:00.000Z",
          },
        ],
      }),
    );

    const result = await loadCustomerPaymentHistory({
      profileId: "profile-1",
      customerEmail: "jane@example.com",
      actingCustomerId: "customer-1",
      source: "booking",
      status: "pending",
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].source).toBe("booking");
    expect(result.items[0].status).toBe("pending");
  });

  it("paginates with limit and cursor", async () => {
    createSupabaseServerClientMock.mockResolvedValue(bookingClient([], []));
    requireServiceRoleClientMock.mockReturnValue(
      serviceRoleClient({
        zohoPayments: [
          {
            id: "zoho-1",
            invoice_number: "INV-A",
            customer_email: "jane@example.com",
            amount_cents: 1000,
            currency: "ZAR",
            status: "paid",
            paystack_reference: "ref-a",
            created_at: "2026-05-05T12:00:00.000Z",
            paid_at: "2026-05-05T12:00:00.000Z",
          },
          {
            id: "zoho-2",
            invoice_number: "INV-B",
            customer_email: "jane@example.com",
            amount_cents: 2000,
            currency: "ZAR",
            status: "paid",
            paystack_reference: "ref-b",
            created_at: "2026-05-05T11:00:00.000Z",
            paid_at: "2026-05-05T11:00:00.000Z",
          },
        ],
      }),
    );

    const firstPage = await loadCustomerPaymentHistory({
      profileId: "profile-1",
      customerEmail: "jane@example.com",
      actingCustomerId: "customer-1",
      source: "zoho_invoice",
      limit: 1,
    });

    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.items[0].invoiceNumber).toBe("INV-A");
    expect(firstPage.nextCursor).toBeTruthy();

    const secondPage = await loadCustomerPaymentHistory({
      profileId: "profile-1",
      customerEmail: "jane@example.com",
      actingCustomerId: "customer-1",
      source: "zoho_invoice",
      limit: 1,
      cursor: firstPage.nextCursor,
    });

    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0].invoiceNumber).toBe("INV-B");
  });
});
