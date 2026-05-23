import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BookingRow } from "@/lib/database/types";
import { accrueMonthlyInvoiceItemForBooking } from "./accrueMonthlyInvoiceItemForBooking";

vi.mock("@/lib/app/zohoMonthlyInvoiceAccrualFlag", () => ({
  isZohoMonthlyInvoiceAccrualEnabled: vi.fn(() => true),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  requireServiceRoleClient: vi.fn(() => ({})),
}));

vi.mock("@/features/bookings/server/admin/monthlyServiceAuthorizationRepository", () => ({
  hasActiveMonthlyServiceAuthorization: vi.fn(),
}));

vi.mock("./monthlyInvoiceAccrualRepository", () => ({
  findOrCreateMonthlyInvoiceBatch: vi.fn(),
  getExistingBatchItemForBooking: vi.fn(),
  insertMonthlyInvoiceBatchItem: vi.fn(),
  updateMonthlyInvoiceBatchTotal: vi.fn(),
  MonthlyInvoiceBatchLockedError: class MonthlyInvoiceBatchLockedError extends Error {
    constructor(
      public readonly batchId: string,
      public readonly status: string,
    ) {
      super(`Batch ${batchId} is locked (status=${status}).`);
      this.name = "MonthlyInvoiceBatchLockedError";
    }
  },
}));

vi.mock("./customerBillingAccountRepository", () => ({
  getCustomerBillingAccount: vi.fn().mockResolvedValue(null),
}));

vi.mock("./recordCustomerBillingAccountAudit", () => ({
  recordCustomerBillingAccountAudit: vi.fn().mockResolvedValue(undefined),
}));

const customerId = "11111111-1111-4111-8111-111111111111";
const bookingId = "22222222-2222-4222-8222-222222222222";

function monthlyBooking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: bookingId,
    customer_id: customerId,
    cleaner_id: "33333333-3333-4333-8333-333333333333",
    status: "completed",
    price_cents: 150000,
    scheduled_start: "2026-05-15T08:00:00.000Z",
    updated_at: "2026-05-15T10:00:00.000Z",
    metadata: {
      billing: { mode: "monthly_account", monthlyAccountId: "acc-1" },
      serviceSlug: "standard-clean",
    },
    created_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  } as BookingRow;
}

describe("accrueMonthlyInvoiceItemForBooking", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { hasActiveMonthlyServiceAuthorization } = await import(
      "@/features/bookings/server/admin/monthlyServiceAuthorizationRepository"
    );
    vi.mocked(hasActiveMonthlyServiceAuthorization).mockResolvedValue(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips when feature flag is off", async () => {
    const { isZohoMonthlyInvoiceAccrualEnabled } = await import(
      "@/lib/app/zohoMonthlyInvoiceAccrualFlag"
    );
    vi.mocked(isZohoMonthlyInvoiceAccrualEnabled).mockReturnValueOnce(false);

    const result = await accrueMonthlyInvoiceItemForBooking({
      bookingId,
      booking: monthlyBooking(),
    });

    expect(result).toMatchObject({ ok: true, outcome: "skipped", reason: "feature_disabled" });
  });

  it("skips non-monthly booking", async () => {
    const result = await accrueMonthlyInvoiceItemForBooking({
      bookingId,
      booking: monthlyBooking({
        metadata: { billing: { mode: "pay_now" } },
      }),
    });

    expect(result).toMatchObject({ ok: true, outcome: "skipped", reason: "not_monthly_account" });
  });

  it("skips when not completed", async () => {
    const result = await accrueMonthlyInvoiceItemForBooking({
      bookingId,
      booking: monthlyBooking({ status: "assigned" }),
    });

    expect(result).toMatchObject({ ok: true, outcome: "skipped", reason: "not_completed" });
  });

  it("skips when not service authorized", async () => {
    const { hasActiveMonthlyServiceAuthorization } = await import(
      "@/features/bookings/server/admin/monthlyServiceAuthorizationRepository"
    );
    vi.mocked(hasActiveMonthlyServiceAuthorization).mockResolvedValueOnce(false);

    const result = await accrueMonthlyInvoiceItemForBooking({
      bookingId,
      booking: monthlyBooking(),
    });

    expect(result).toMatchObject({
      ok: true,
      outcome: "skipped",
      reason: "not_service_authorized",
    });
  });

  it("skips when amount missing", async () => {
    const { hasActiveMonthlyServiceAuthorization } = await import(
      "@/features/bookings/server/admin/monthlyServiceAuthorizationRepository"
    );
    vi.mocked(hasActiveMonthlyServiceAuthorization).mockResolvedValueOnce(true);

    const result = await accrueMonthlyInvoiceItemForBooking({
      bookingId,
      booking: monthlyBooking({ price_cents: 0 }),
    });

    expect(result).toMatchObject({ ok: true, outcome: "skipped", reason: "missing_amount" });
  });

  it("returns already_accrued when item exists", async () => {
    const { hasActiveMonthlyServiceAuthorization } = await import(
      "@/features/bookings/server/admin/monthlyServiceAuthorizationRepository"
    );
    const { getExistingBatchItemForBooking } = await import("./monthlyInvoiceAccrualRepository");

    vi.mocked(hasActiveMonthlyServiceAuthorization).mockResolvedValueOnce(true);
    vi.mocked(getExistingBatchItemForBooking).mockResolvedValueOnce({
      id: "item-1",
      batch_id: "batch-1",
      amount_cents: 150000,
    } as never);

    const result = await accrueMonthlyInvoiceItemForBooking({
      bookingId,
      booking: monthlyBooking(),
    });

    expect(result).toMatchObject({
      ok: true,
      outcome: "already_accrued",
      batchId: "batch-1",
      itemId: "item-1",
    });
  });

  it("accrues completed authorized monthly booking", async () => {
    const { hasActiveMonthlyServiceAuthorization } = await import(
      "@/features/bookings/server/admin/monthlyServiceAuthorizationRepository"
    );
    const {
      findOrCreateMonthlyInvoiceBatch,
      getExistingBatchItemForBooking,
      insertMonthlyInvoiceBatchItem,
      updateMonthlyInvoiceBatchTotal,
    } = await import("./monthlyInvoiceAccrualRepository");
    const { recordCustomerBillingAccountAudit } = await import("./recordCustomerBillingAccountAudit");

    vi.mocked(hasActiveMonthlyServiceAuthorization).mockResolvedValueOnce(true);
    vi.mocked(getExistingBatchItemForBooking).mockResolvedValueOnce(null);
    vi.mocked(findOrCreateMonthlyInvoiceBatch).mockResolvedValueOnce({
      batch: {
        id: "batch-1",
        customerId,
        billingMonth: "2026-05-01",
        status: "draft",
      },
      created: true,
    } as never);
    vi.mocked(insertMonthlyInvoiceBatchItem).mockResolvedValueOnce({
      id: "item-1",
      batch_id: "batch-1",
      amount_cents: 150000,
    } as never);
    vi.mocked(updateMonthlyInvoiceBatchTotal).mockResolvedValueOnce(150000);

    const result = await accrueMonthlyInvoiceItemForBooking({
      bookingId,
      booking: monthlyBooking(),
    });

    expect(result).toMatchObject({
      ok: true,
      outcome: "accrued",
      batchId: "batch-1",
      itemId: "item-1",
      billingMonth: "2026-05-01",
      amountCents: 150000,
    });
    expect(findOrCreateMonthlyInvoiceBatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        customerId,
        billingMonth: "2026-05-01",
        idempotencyKey: `batch:${customerId}:2026-05-01`,
      }),
    );
    expect(updateMonthlyInvoiceBatchTotal).toHaveBeenCalledWith(expect.anything(), "batch-1");
    expect(recordCustomerBillingAccountAudit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "monthly_invoice_item_accrued" }),
    );
  });

  it("uses Africa/Johannesburg billing month from scheduled_start", async () => {
    const { hasActiveMonthlyServiceAuthorization } = await import(
      "@/features/bookings/server/admin/monthlyServiceAuthorizationRepository"
    );
    const { findOrCreateMonthlyInvoiceBatch, getExistingBatchItemForBooking, insertMonthlyInvoiceBatchItem, updateMonthlyInvoiceBatchTotal } =
      await import("./monthlyInvoiceAccrualRepository");

    vi.mocked(hasActiveMonthlyServiceAuthorization).mockResolvedValueOnce(true);
    vi.mocked(getExistingBatchItemForBooking).mockResolvedValueOnce(null);
    vi.mocked(findOrCreateMonthlyInvoiceBatch).mockResolvedValueOnce({
      batch: { id: "batch-jhb", billingMonth: "2026-06-01", status: "draft" },
      created: true,
    } as never);
    vi.mocked(insertMonthlyInvoiceBatchItem).mockResolvedValueOnce({ id: "item-jhb" } as never);
    vi.mocked(updateMonthlyInvoiceBatchTotal).mockResolvedValueOnce(150000);

    await accrueMonthlyInvoiceItemForBooking({
      bookingId,
      booking: monthlyBooking({ scheduled_start: "2026-05-31T22:00:00.000Z" }),
    });

    expect(findOrCreateMonthlyInvoiceBatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ billingMonth: "2026-06-01" }),
    );
  });

  it("skips when batch is locked", async () => {
    const { hasActiveMonthlyServiceAuthorization } = await import(
      "@/features/bookings/server/admin/monthlyServiceAuthorizationRepository"
    );
    const { findOrCreateMonthlyInvoiceBatch, getExistingBatchItemForBooking } = await import(
      "./monthlyInvoiceAccrualRepository"
    );

    vi.mocked(hasActiveMonthlyServiceAuthorization).mockResolvedValueOnce(true);
    vi.mocked(getExistingBatchItemForBooking).mockResolvedValueOnce(null);
    vi.mocked(findOrCreateMonthlyInvoiceBatch).mockRejectedValueOnce(
      new (await import("./monthlyInvoiceAccrualRepository")).MonthlyInvoiceBatchLockedError(
        "batch-sent",
        "sent",
      ),
    );

    const result = await accrueMonthlyInvoiceItemForBooking({
      bookingId,
      booking: monthlyBooking(),
    });

    expect(result).toMatchObject({
      ok: true,
      outcome: "skipped",
      reason: "batch_locked",
      batchId: "batch-sent",
    });
  });
});
