import { describe, expect, it, vi } from "vitest";
import { enqueueZohoSalesSync } from "./zohoSalesSyncRepository";

const findMock = vi.fn();
const insertMock = vi.fn();

function clientMock() {
  return {
    from(table: string) {
      if (table !== "zoho_sales_sync") throw new Error(`Unexpected table ${table}`);
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

describe("enqueueZohoSalesSync", () => {
  it("returns existing row for duplicate booking source", async () => {
    findMock.mockResolvedValue({
      data: {
        id: "sync-1",
        source_type: "booking",
        source_id: "booking-1",
      },
      error: null,
    });

    const row = await enqueueZohoSalesSync(
      {
        sourceType: "booking",
        sourceId: "booking-1",
        amountCents: 5000,
      },
      clientMock() as never,
    );

    expect(row.id).toBe("sync-1");
    expect(insertMock).not.toHaveBeenCalled();
  });
});
