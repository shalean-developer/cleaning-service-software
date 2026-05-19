import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readReadModelSource(): string {
  return readFileSync(
    resolve(process.cwd(), "src/features/customers/server/admin/adminCustomersReadModel.ts"),
    "utf8",
  );
}

describe("getAdminCustomerDetail read model", () => {
  it("loads bookings by customer_id only", () => {
    const source = readReadModelSource();
    expect(source).toMatch(
      /getAdminCustomerDetail[\s\S]*\.from\("bookings"\)[\s\S]*\.eq\("customer_id", customer\.id\)/,
    );
    expect(source).toContain("buildAdminCustomerBookingOperationsSummary");
    expect(source).toContain("cleaner_id");
  });
});
