import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

function readPage(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUser: vi.fn().mockResolvedValue({
    profileId: "profile-admin",
    role: "admin",
    authUser: { id: "auth-admin" },
  }),
}));

describe("admin customers pages", () => {
  it("list page links to create customer route and uses filter query parsing", () => {
    const source = readPage("src/app/(admin)/admin/customers/page.tsx");

    expect(source).toContain('href="/admin/customers/new"');
    expect(source).toContain("New customer");
    expect(source).toContain("listAdminCustomers");
    expect(source).toContain("buildAdminCustomersListHref");
    expect(source).toContain("adminCustomersEmptyState");
    expect(source).toContain("bookings");
    expect(source).toContain("health");
    expect(source).toContain("activity");
  });

  it("create page uses client form without server provisioning imports", () => {
    const source = readPage("src/app/(admin)/admin/customers/new/page.tsx");

    expect(source).toContain("AdminCustomerCreateForm");
    expect(source).toContain('href="/admin/customers"');
    expect(source).not.toContain("provisionCustomerIdentity");
    expect(source).not.toContain("createCustomer");
    expect(source).not.toContain("requireServiceRoleClient");
    expect(source).not.toMatch(/\.from\s*\(\s*["']customers["']\s*\)/);
  });

  it("detail page delegates reserved new segment and rejects invalid ids", () => {
    const source = readPage("src/app/(admin)/admin/customers/[customerId]/page.tsx");

    expect(source).toContain('customerId === "new"');
    expect(source).toContain("AdminCreateCustomerPage");
    expect(source).toContain("isUuid");
    expect(source).toContain("notFound");
    expect(source).toContain("parseAdminCustomerDetailQueryParams");
    expect(source).toContain("bookingFilter");
    expect(source).toContain("Invalid booking filter parameter");
  });
});

describe("AdminCreateCustomerPage render", () => {
  it("default export resolves and returns page content", async () => {
    const Page = (await import("./new/page")).default;
    const tree = await Page();
    expect(tree).toBeTruthy();
  });
});
