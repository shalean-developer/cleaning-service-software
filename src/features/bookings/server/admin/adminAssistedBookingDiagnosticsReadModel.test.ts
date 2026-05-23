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
      if (table === "admin_offline_payment_events" || table === "notification_outbox") {
        return {
          select: () => {
            const filters: Record<string, string> = {};
            const builder = {
              eq: (col: string, val: string) => {
                filters[col] = val;
                return builder;
              },
              then: (resolve: (v: { count: number; error: null }) => void) => {
                const key =
                  table === "notification_outbox" && filters.event_name
                    ? `${table}:${filters.event_name}`
                    : filters.status
                      ? `${table}:${filters.status}`
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
            metadata: { adminAssist: { source: "admin_wizard" } },
            cleaner_id: null,
            assignment_dispatch_at: null,
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
          },
        ],
        {
          admin_offline_payment_events: 2,
          "notification_outbox:admin_assisted_payment_request_sent": 1,
        },
      ) as never,
    );

    expect(diagnostics.readOnly).toBe(true);
    expect(diagnostics.counts.assistedDrafts).toBe(1);
    expect(diagnostics.counts.pendingPayment).toBe(1);
    expect(diagnostics.counts.paymentLinksActive).toBe(1);
    expect(diagnostics.counts.offlinePaymentsRecorded).toBe(2);
    expect(diagnostics.counts.failedPaymentRequestNotifications).toBe(1);
  });
});
