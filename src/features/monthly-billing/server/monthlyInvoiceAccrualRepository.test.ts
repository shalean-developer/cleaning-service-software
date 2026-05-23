import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database/types";
import {
  MonthlyInvoiceBatchLockedError,
  findOrCreateMonthlyInvoiceBatch,
  isLockedBatchStatus,
  updateMonthlyInvoiceBatchTotal,
} from "./monthlyInvoiceAccrualRepository";

vi.mock("./monthlyInvoiceBatchRepository", () => ({
  getMonthlyInvoiceBatchForCustomerMonth: vi.fn(),
}));

describe("monthlyInvoiceAccrualRepository", () => {
  it("treats generated, sent, paid, overdue, and void as locked", () => {
    expect(isLockedBatchStatus("draft")).toBe(false);
    expect(isLockedBatchStatus("generated")).toBe(true);
    expect(isLockedBatchStatus("sent")).toBe(true);
    expect(isLockedBatchStatus("paid")).toBe(true);
    expect(isLockedBatchStatus("overdue")).toBe(true);
    expect(isLockedBatchStatus("void")).toBe(true);
  });

  it("reuses draft batch for customer/month", async () => {
    const { getMonthlyInvoiceBatchForCustomerMonth } = await import(
      "./monthlyInvoiceBatchRepository"
    );
    vi.mocked(getMonthlyInvoiceBatchForCustomerMonth).mockResolvedValueOnce({
      id: "batch-draft",
      customerId: "cust-1",
      billingMonth: "2026-05-01",
      status: "draft",
    } as never);

    const client = {} as SupabaseClient<Database>;
    const result = await findOrCreateMonthlyInvoiceBatch(client, {
      customerId: "cust-1",
      billingMonth: "2026-05-01",
      idempotencyKey: "batch:cust-1:2026-05-01",
    });

    expect(result.created).toBe(false);
    expect(result.batch.id).toBe("batch-draft");
  });

  it("throws when existing batch is locked", async () => {
    const { getMonthlyInvoiceBatchForCustomerMonth } = await import(
      "./monthlyInvoiceBatchRepository"
    );
    vi.mocked(getMonthlyInvoiceBatchForCustomerMonth).mockResolvedValueOnce({
      id: "batch-paid",
      status: "paid",
    } as never);

    const client = {} as SupabaseClient<Database>;
    await expect(
      findOrCreateMonthlyInvoiceBatch(client, {
        customerId: "cust-1",
        billingMonth: "2026-05-01",
        idempotencyKey: "batch:cust-1:2026-05-01",
      }),
    ).rejects.toBeInstanceOf(MonthlyInvoiceBatchLockedError);
  });

  it("updates batch total from accrued items", async () => {
    const secondNeq = vi.fn().mockResolvedValue({
      data: [{ amount_cents: 10000 }, { amount_cents: 25000 }],
      error: null,
    });
    const firstNeq = vi.fn().mockReturnValue({ neq: secondNeq });
    const eq = vi.fn().mockReturnValue({ neq: firstNeq });
    const select = vi.fn().mockReturnValue({ eq });
    const batchEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq: batchEq });
    const from = vi
      .fn()
      .mockReturnValueOnce({ select })
      .mockReturnValueOnce({ update });

    const client = { from } as unknown as SupabaseClient<Database>;
    const total = await updateMonthlyInvoiceBatchTotal(client, "batch-1");

    expect(total).toBe(35000);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ total_cents: 35000 }),
    );
  });
});
