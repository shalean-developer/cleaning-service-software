import { describe, expect, it, vi } from "vitest";
import { enqueueZohoRefundCreditSync } from "./zohoRefundCreditSyncRepository";

const findMock = vi.fn();
const insertMock = vi.fn();

function clientMock() {
  return {
    from(table: string) {
      if (table !== "zoho_refund_credit_sync") throw new Error(`Unexpected table ${table}`);
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: findMock,
            }),
          }),
        }),
        insert: () => ({
          select: () => ({
            single: insertMock,
          }),
        }),
      };
    },
  };
}

describe("enqueueZohoRefundCreditSync", () => {
  it("returns existing row for duplicate source", async () => {
    findMock.mockResolvedValue({
      data: {
        id: "sync-1",
        source_type: "booking_refund",
        source_id: "source-1",
      },
      error: null,
    });

    const row = await enqueueZohoRefundCreditSync(
      {
        sourceType: "booking_refund",
        sourceId: "source-1",
        amountCents: 5000,
        reason: "Manual refund",
      },
      clientMock() as never,
    );

    expect(row.id).toBe("sync-1");
    expect(insertMock).not.toHaveBeenCalled();
  });
});
