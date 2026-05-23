import { describe, expect, it, vi } from "vitest";
import { loadAdminAssistedBookingDiagnostics } from "./adminAssistedBookingDiagnosticsReadModel";

vi.mock("@/lib/app/adminAssistedBookingFlag", () => ({
  isAdminAssistedBookingEnabled: () => true,
}));

vi.mock("@/lib/app/adminAssistedPaymentLinksFlag", () => ({
  isAdminAssistedPaymentLinksActive: () => false,
}));

vi.mock("@/lib/app/adminAssistedOfflinePaymentsFlag", () => ({
  isAdminAssistedOfflinePaymentsActive: () => false,
}));

vi.mock("./adminAssistedBookingCustomerDisplay", () => ({
  withAdminAssistedBookingCustomerFields: vi.fn(async (_client, rows: Array<{ id: string; customer_id?: string; customer_name?: string; customer_email?: string | null }>) =>
    rows.map((row) => ({
      ...row,
      customer_id: row.customer_id ?? "cust-unknown",
      customer_name:
        row.customer_name ??
        (row.customer_id === "cust-jane" ? "Jane" : row.customer_id === "cust-bob" ? "Bob" : null),
      customer_email:
        row.customer_email ??
        (row.customer_id === "cust-bob" ? "bob@example.com" : null),
      customer_phone: null,
    })),
  ),
  loadAdminAssistedBookingCustomerFieldsByCustomerId: vi.fn(),
  customerLabelFromCustomerFields: vi.fn(),
}));

function mockClient(rows: Record<string, unknown>[], counts: Record<string, number>) {
  return {
    from: (table: string) => {
      if (table === "bookings") {
        return {
          select: () => ({
            or: () => ({
              order: () => ({
                limit: async () => ({ data: rows, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "admin_booking_assist_audit") {
        return {
          select: () => ({
            order: () => ({
              limit: async () => ({ data: [], error: null }),
            }),
          }),
        };
      }
      if (table === "admin_assisted_operator_feedback") {
        return {
          select: () => ({
            then: (resolve: (v: { count: number; error: null }) => void) => {
              resolve({ count: counts.admin_assisted_operator_feedback ?? 0, error: null });
            },
          }),
        };
      }
      if (table === "admin_offline_payment_events") {
        return {
          select: () => ({
            eq: () => ({
              then: (resolve: (v: { count: number; error: null }) => void) => {
                resolve({ count: counts.admin_offline_payment_events ?? 0, error: null });
              },
            }),
            then: (resolve: (v: { count: number; error: null }) => void) => {
              resolve({ count: counts.admin_offline_payment_events ?? 0, error: null });
            },
          }),
        };
      }
      if (table === "notification_outbox") {
        return {
          select: () => {
            const filters: Record<string, string> = {};
            const builder = {
              filter: () => builder,
              eq: (col: string, val: string) => {
                filters[col] = val;
                return builder;
              },
              limit: async () => ({ data: [], error: null }),
              then: (resolve: (v: { count: number; error: null }) => void) => {
                const key =
                  filters.status === "failed"
                    ? "notification_outbox:admin_assisted_payment_request_sent"
                    : table;
                resolve({ count: counts[key] ?? counts[table] ?? 0, error: null });
              },
            };
            return builder;
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe("loadAdminAssistedBookingDiagnostics", () => {
  it("aggregates read-only counts from bookings and side tables", async () => {
    const diagnostics = await loadAdminAssistedBookingDiagnostics(
      mockClient(
        [
          {
            id: "b1",
            status: "draft",
            metadata: { adminAssist: { source: "admin_wizard", pilotDryRun: true } },
            cleaner_id: null,
            assignment_dispatch_at: null,
            updated_at: "2026-05-23T08:00:00.000Z",
            created_at: "2026-05-23T08:00:00.000Z",
            customer_id: "cust-jane",
          },
          {
            id: "b2",
            status: "pending_payment",
            metadata: {
              adminAssist: {
                source: "admin_wizard",
                paymentLink: {
                  paymentUrl: "https://pay",
                  reference: "ref",
                  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
                  generatedAt: new Date().toISOString(),
                  generatedByProfileId: "a1",
                  deliveryChannel: "copy_only",
                  paymentId: "p1",
                },
              },
            },
            cleaner_id: null,
            assignment_dispatch_at: null,
            updated_at: "2026-05-23T08:00:00.000Z",
            created_at: "2026-05-23T08:00:00.000Z",
            customer_id: "cust-bob",
          },
        ],
        {
          admin_offline_payment_events: 2,
          "notification_outbox:admin_assisted_payment_request_sent": 1,
          admin_assisted_operator_feedback: 3,
        },
      ) as never,
    );

    expect(diagnostics.readOnly).toBe(true);
    expect(diagnostics.counts.assistedDrafts).toBe(1);
    expect(diagnostics.counts.pendingPayment).toBe(1);
    expect(diagnostics.counts.paymentLinksActive).toBe(1);
    expect(diagnostics.counts.offlinePaymentsRecorded).toBe(2);
    expect(diagnostics.counts.failedPaymentRequestNotifications).toBe(1);
    expect(diagnostics.analytics).toBeDefined();
    expect(diagnostics.counts.awaitingPayment).toBe(1);
    expect(diagnostics.friction.pilotDryRunBookings).toBe(1);
    expect(diagnostics.friction.missingCustomerEmailBookings).toBe(1);
    expect(diagnostics.operatorFeedbackCount).toBe(3);
    expect(diagnostics.rolloutStage).toBe("draft_only");
    expect(diagnostics.alerts.some((alert) => alert.id === "failed_payment_request_email")).toBe(true);
  });
});
