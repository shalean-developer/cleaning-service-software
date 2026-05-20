import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminProfileMenu } from "./AdminProfileMenu";

describe("AdminProfileMenu", () => {
  it("renders avatar trigger and sign out inside the account menu", () => {
    const html = renderToStaticMarkup(
      <AdminProfileMenu fullName="E2E Test Admin" email="admin@test.com" />,
    );

    expect(html).toContain("E2E Test Admin");
    expect(html).toContain("Administrator");
    expect(html).toContain("admin@test.com");
    expect(html).toContain("Sign out");
    expect(html).toContain("Admin account menu");
    expect(html).not.toContain("border-red-200");
  });

  it("defaults to Admin when no name is provided", () => {
    const html = renderToStaticMarkup(<AdminProfileMenu />);

    expect(html).toContain("Admin");
    expect(html).toContain("Administrator");
    expect(html).not.toContain("border-red-200");
  });
});
