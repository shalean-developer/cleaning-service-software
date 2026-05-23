import { afterEach, describe, expect, it, vi } from "vitest";
import type { BookingRow } from "@/lib/database/types";
import {
  clearMonthlyInvoiceAccrualDiagnosticsForTests,
  getRecentMonthlyInvoiceAccrualDiagnostics,
} from "./monthlyInvoiceAccrualDiagnostics";
import { runPostCompletionMonthlyInvoiceAccrual } from "./runPostCompletionMonthlyInvoiceAccrual";

vi.mock("./accrueMonthlyInvoiceItemForBooking", () => ({
  accrueMonthlyInvoiceItemForBooking: vi.fn(),
}));

const booking = {
  id: "22222222-2222-4222-8222-222222222222",
  customer_id: "11111111-1111-4111-8111-111111111111",
  status: "completed",
} as BookingRow;

describe("runPostCompletionMonthlyInvoiceAccrual", () => {
  afterEach(() => {
    vi.clearAllMocks();
    clearMonthlyInvoiceAccrualDiagnosticsForTests();
  });

  it("returns accrual result without throwing", async () => {
    const { accrueMonthlyInvoiceItemForBooking } = await import(
      "./accrueMonthlyInvoiceItemForBooking"
    );
    vi.mocked(accrueMonthlyInvoiceItemForBooking).mockResolvedValueOnce({
      ok: true,
      outcome: "accrued",
      batchId: "batch-1",
      itemId: "item-1",
      billingMonth: "2026-05-01",
      amountCents: 150000,
    });

    const result = await runPostCompletionMonthlyInvoiceAccrual(booking);

    expect(result.attempted).toBe(true);
    expect(result.result?.ok).toBe(true);
  });

  it("records diagnostic when batch locked", async () => {
    const { accrueMonthlyInvoiceItemForBooking } = await import(
      "./accrueMonthlyInvoiceItemForBooking"
    );
    vi.mocked(accrueMonthlyInvoiceItemForBooking).mockResolvedValueOnce({
      ok: true,
      outcome: "skipped",
      reason: "batch_locked",
      message: "Batch locked",
      batchId: "batch-sent",
    });

    await runPostCompletionMonthlyInvoiceAccrual(booking);

    expect(getRecentMonthlyInvoiceAccrualDiagnostics()[0]).toMatchObject({
      bookingId: booking.id,
      reason: "batch_locked",
      batchId: "batch-sent",
    });
  });

  it("never throws when accrual throws", async () => {
    const { accrueMonthlyInvoiceItemForBooking } = await import(
      "./accrueMonthlyInvoiceItemForBooking"
    );
    vi.mocked(accrueMonthlyInvoiceItemForBooking).mockRejectedValueOnce(new Error("boom"));

    const result = await runPostCompletionMonthlyInvoiceAccrual(booking);

    expect(result.attempted).toBe(true);
    expect(result.result).toBeNull();
    expect(getRecentMonthlyInvoiceAccrualDiagnostics()[0]).toMatchObject({
      bookingId: booking.id,
      reason: "persistence_error",
    });
  });
});
