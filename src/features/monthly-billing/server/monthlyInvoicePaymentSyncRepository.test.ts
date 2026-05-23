import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isSyncableBatchPaymentStatus,
  isTerminalBatchPaymentStatus,
  markBatchPaid,
  markBatchSent,
  markItemsPaid,
} from "./monthlyInvoicePaymentSyncRepository";

const batchRow = {
  id: "batch-1",
  customer_id: "cust-1",
  billing_month: "2026-05-01",
  status: "generated",
  zoho_invoice_id: "zoho-inv-1",
  zoho_invoice_number: "INV-001",
  total_cents: 10000,
  currency: "ZAR",
  generated_by_admin_id: null,
  generated_at: "2026-05-20T00:00:00.000Z",
  sent_at: null,
  paid_at: null,
  idempotency_key: null,
  zoho_reference_number: "SHALEAN-MIB-batch-1",
  metadata: {},
  created_at: "2026-05-01T00:00:00.000Z",
  updated_at: "2026-05-20T00:00:00.000Z",
};

function createClient() {
  const updates: Array<Record<string, unknown>> = [];
  const client = {
    from: vi.fn((table: string) => {
      if (table === "monthly_invoice_batches") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({ data: batchRow, error: null }),
          })),
          update: vi.fn((payload: Record<string, unknown>) => {
            updates.push(payload);
            return {
              eq: vi.fn().mockReturnThis(),
              in: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              maybeSingle: vi.fn().mockResolvedValue({
                data: { ...batchRow, ...payload, status: payload.status ?? batchRow.status },
                error: null,
              }),
            };
          }),
        };
      }
      if (table === "monthly_invoice_batch_items") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            select: vi.fn().mockResolvedValue({ data: [{ id: "item-1" }], error: null }),
          })),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
    _updates: updates,
  };
  return client as never;
}

describe("monthlyInvoicePaymentSyncRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats paid and void as terminal", () => {
    expect(isTerminalBatchPaymentStatus("paid")).toBe(true);
    expect(isTerminalBatchPaymentStatus("void")).toBe(true);
    expect(isSyncableBatchPaymentStatus("generated")).toBe(true);
    expect(isSyncableBatchPaymentStatus("paid")).toBe(false);
  });

  it("stores paid_at when marking batch paid", async () => {
    const client = createClient();
    const paidAt = "2026-05-23T10:00:00.000Z";
    const batch = await markBatchPaid(client, "batch-1", paidAt);
    expect(batch.status).toBe("paid");
    expect(batch.paidAt).toBe(paidAt);
  });

  it("stores sent_at when marking batch sent", async () => {
    const client = createClient();
    const sentAt = "2026-05-23T09:00:00.000Z";
    const batch = await markBatchSent(client, "batch-1", sentAt);
    expect(batch.status).toBe("sent");
    expect(batch.sentAt).toBe(sentAt);
  });

  it("marks batch items paid", async () => {
    const client = createClient();
    const count = await markItemsPaid(client, "batch-1");
    expect(count).toBe(1);
  });
});
