import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readListTableSource(): string {
  return readFileSync(
    path.join(process.cwd(), "src/components/dashboard/admin/AdminCustomerListTable.tsx"),
    "utf8",
  );
}

describe("AdminCustomerListTable", () => {
  it("exposes read-only quick actions without destructive controls", () => {
    const source = readListTableSource();

    expect(source).toContain("View");
    expect(source).toContain("Edit contact");
    expect(source).toContain("Create booking");
    expect(source).toContain("coming soon");
    expect(source).not.toMatch(/delete/i);
    expect(source).not.toContain("method=\"delete\"");
  });

  it("shows last activity and latest booking copy for mobile scan", () => {
    const source = readListTableSource();

    expect(source).toContain("formatAdminCustomerLastActivity");
    expect(source).toContain("formatAdminCustomerLatestBooking");
    expect(source).toContain("Last activity");
    expect(source).toContain("labelForCustomerDomainHealth");
  });
});
