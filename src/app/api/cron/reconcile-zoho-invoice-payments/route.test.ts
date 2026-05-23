import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const verifyCronSecret = vi.fn();
const retryZohoInvoiceReconciliation = vi.fn();
const retryZohoInvoiceAuthorizationChargeReconciliation = vi.fn();
const createServiceRoleClient = vi.fn();
const startCronRunMock = vi.fn();
const completeCronRunMock = vi.fn();
const failCronRunMock = vi.fn();

vi.mock("@/lib/cron/verifyCronSecret", () => ({
  verifyCronSecret: (...args: unknown[]) => verifyCronSecret(...args),
}));

vi.mock("@/features/zoho-invoice-payments/server/retryZohoInvoiceReconciliation", () => ({
  retryZohoInvoiceReconciliation: (...args: unknown[]) => retryZohoInvoiceReconciliation(...args),
}));

vi.mock(
  "@/features/zoho-invoice-payments/server/retryZohoInvoiceAuthorizationChargeReconciliation",
  () => ({
    retryZohoInvoiceAuthorizationChargeReconciliation: (...args: unknown[]) =>
      retryZohoInvoiceAuthorizationChargeReconciliation(...args),
  }),
);

vi.mock("@/features/zoho-invoice-payments/server/zohoInvoicePaymentCronRunRepository", () => ({
  startZohoInvoicePaymentCronRun: (...args: unknown[]) => startCronRunMock(...args),
  completeZohoInvoicePaymentCronRun: (...args: unknown[]) => completeCronRunMock(...args),
  failZohoInvoicePaymentCronRun: (...args: unknown[]) => failCronRunMock(...args),
}));

vi.mock("@/lib/supabase/serviceRole", () => ({
  createServiceRoleClient: () => createServiceRoleClient(),
}));

describe("cron reconcile-zoho-invoice-payments route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createServiceRoleClient.mockReturnValue({});
    startCronRunMock.mockResolvedValue({ id: "cron-run-1" });
    completeCronRunMock.mockResolvedValue(undefined);
  });

  it("rejects unauthorized requests", async () => {
    verifyCronSecret.mockReturnValue(false);
    const response = await POST(new Request("http://localhost"));
    expect(response.status).toBe(401);
  });

  it("returns safe summary for authorized requests", async () => {
    verifyCronSecret.mockReturnValue(true);
    retryZohoInvoiceReconciliation.mockResolvedValue({
      scanned: 2,
      retried: 2,
      paid: 1,
      pending: 1,
      failed: 0,
      skipped: 0,
      errors: [],
    });
    retryZohoInvoiceAuthorizationChargeReconciliation.mockResolvedValue({
      scanned: 0,
      retried: 0,
      paid: 0,
      pending: 0,
      failed: 0,
      skipped: 0,
      errors: [],
    });

    const response = await GET(new Request("http://localhost"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      scanned: 2,
      retried: 2,
      paid: 1,
      pending: 1,
      failed: 0,
      skipped: 0,
      errors: [],
      authorizationCharges: {
        scanned: 0,
        retried: 0,
        paid: 0,
        pending: 0,
        failed: 0,
        skipped: 0,
        errors: [],
      },
    });
    expect(retryZohoInvoiceReconciliation).toHaveBeenCalled();
    expect(retryZohoInvoiceAuthorizationChargeReconciliation).toHaveBeenCalled();
    expect(startCronRunMock).toHaveBeenCalledWith(
      { jobName: "reconcile-zoho-invoice-payments" },
      expect.anything(),
    );
    expect(completeCronRunMock).toHaveBeenCalled();
  });
});
