import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readReadModelSource(): string {
  return readFileSync(
    path.join(process.cwd(), "src/features/customers/server/admin/adminCustomersReadModel.ts"),
    "utf8",
  );
}

describe("adminCustomersReadModel performance guards", () => {
  it("keeps auth email scan behind isEmailLikeCustomerSearch", () => {
    const source = readReadModelSource();
    expect(source).toContain("isEmailLikeCustomerSearch");
    expect(source).toMatch(/if\s*\(\s*isEmailLikeCustomerSearch/);
  });

  it("keeps search scan cap and avoids payment loads in listAdminCustomers", () => {
    const source = readReadModelSource();
    const listFn = source.match(
      /export async function listAdminCustomers[\s\S]*?(?=export async function getAdminCustomerDetail)/,
    )?.[0];
    expect(source).toContain("ADMIN_CUSTOMERS_SEARCH_SCAN_CAP");
    expect(source).toContain("loadBookingListSummariesByCustomerIds");
    expect(listFn).toBeTruthy();
    expect(listFn).not.toContain("loadPaymentsForCustomer");
  });

  it("applies in-memory filters via adminCustomersListFilters", () => {
    const source = readReadModelSource();
    expect(source).toContain("applyAdminCustomersListFilters");
    expect(source).toContain("requiresInMemoryListPipeline");
  });
});
