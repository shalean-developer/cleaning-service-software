import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readFormSource(): string {
  return readFileSync(
    resolve(process.cwd(), "src/components/dashboard/admin/AdminCustomerCreateForm.tsx"),
    "utf8",
  );
}

describe("AdminCustomerCreateForm", () => {
  it("renders required identity fields", () => {
    const source = readFormSource();

    expect(source).toContain("Email");
    expect(source).toContain("Full name");
    expect(source).toContain("Company name");
    expect(source).toContain('type="email"');
    expect(source).not.toContain('type="password"');
    expect(source).not.toContain("send_invite");
  });

  it("submits to POST /api/admin/customers and redirects on success", () => {
    const source = readFormSource();

    expect(source).toContain('fetch("/api/admin/customers"');
    expect(source).toContain("full_name: values.fullName.trim()");
    expect(source).toContain("router.push(`/admin/customers/${payload.customer.customerId}`)");
  });

  it("shows validation errors for phone", () => {
    const source = readFormSource();

    expect(source).toContain("isValidZaMobilePhone");
    expect(source).toContain("Enter a valid South African mobile number");
    expect(source).toContain("FIELD_ERROR_CLASS");
  });
});
