import { describe, expect, it } from "vitest";
import * as accountRepo from "@/features/monthly-billing/server/customerBillingAccountRepository";
import * as batchRepo from "@/features/monthly-billing/server/monthlyInvoiceBatchRepository";

describe("monthly billing repositories (read-only exports)", () => {
  it("exports customer billing account read functions only", () => {
    expect(typeof accountRepo.getCustomerBillingAccount).toBe("function");
    expect(typeof accountRepo.listCustomerBillingAccounts).toBe("function");
    expect(typeof accountRepo.getCustomerBillingAccountAudit).toBe("function");
    expect(accountRepo).not.toHaveProperty("enableMonthlyAccount");
    expect(accountRepo).not.toHaveProperty("disableMonthlyAccount");
    expect(accountRepo).not.toHaveProperty("updateBillingTerms");
  });

  it("exports monthly invoice batch read functions only", () => {
    expect(typeof batchRepo.listMonthlyInvoiceBatches).toBe("function");
    expect(typeof batchRepo.getMonthlyInvoiceBatch).toBe("function");
    expect(typeof batchRepo.listMonthlyInvoiceBatchItems).toBe("function");
    expect(typeof batchRepo.getMonthlyInvoiceBatchForCustomerMonth).toBe("function");
    expect(batchRepo).not.toHaveProperty("createMonthlyInvoiceBatch");
    expect(batchRepo).not.toHaveProperty("generateZohoInvoice");
  });
});
