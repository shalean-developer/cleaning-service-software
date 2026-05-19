import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readFormSource(): string {
  return readFileSync(
    resolve(process.cwd(), "src/components/dashboard/admin/AdminCustomerEditForm.tsx"),
    "utf8",
  );
}

function readEditPageSource(): string {
  return readFileSync(
    resolve(
      process.cwd(),
      "src/app/(admin)/admin/customers/[customerId]/edit/page.tsx",
    ),
    "utf8",
  );
}

describe("AdminCustomerEditForm", () => {
  it("renders editable contact fields only", () => {
    const source = readFormSource();

    expect(source).toContain("Company name");
    expect(source).toContain("Phone");
    expect(source).toContain("Notes");
    expect(source).toContain("Login email and booking ownership cannot be changed here.");
    expect(source).not.toContain('type="password"');
    expect(source).not.toContain('name="email"');
    expect(source).not.toContain('name="profileId"');
    expect(source).not.toContain('name="customerId"');
    expect(source).not.toContain('name="role"');
    expect(source).not.toContain('id="edit-customer-id"');
  });

  it("submits PATCH and redirects to detail on success", () => {
    const source = readFormSource();

    expect(source).toContain('method: "PATCH"');
    expect(source).toContain("fetch(`/api/admin/customers/${initial.customerId}`");
    expect(source).toContain("router.push(`/admin/customers/${payload.customer.customerId}`)");
    expect(source).toContain("isValidZaMobilePhone");
    expect(source).toContain("FIELD_ERROR_CLASS");
  });
});

describe("Admin edit customer page", () => {
  it("renders edit form with prefilled section", () => {
    const source = readEditPageSource();

    expect(source).toContain("AdminCustomerEditForm");
    expect(source).toContain("getAdminCustomerDetail");
    expect(source).toContain("companyName: detail.companyName");
    expect(source).toContain("phone: detail.phone");
    expect(source).toContain("notes: detail.notes");
  });
});
