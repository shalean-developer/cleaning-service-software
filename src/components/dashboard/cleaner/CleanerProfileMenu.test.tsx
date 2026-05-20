import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CleanerProfileMenu } from "./CleanerProfileMenu";

describe("CleanerProfileMenu", () => {
  it("renders nav links and sign out in the account menu", () => {
    const html = renderToStaticMarkup(
      <CleanerProfileMenu
        fullName="Sam Cleaner"
        email="sam@example.com"
        phone="+27792022648"
        avatarUrl={null}
      />,
    );

    expect(html).toContain("Sam Cleaner");
    expect(html).toContain("sam@example.com");
    expect(html).toContain('href="/cleaner"');
    expect(html).toContain('href="/cleaner/earnings"');
    expect(html).toContain("Sign out");
    expect(html).toContain("SC");
  });

  it("shows phone when email is missing", () => {
    const html = renderToStaticMarkup(
      <CleanerProfileMenu
        fullName={null}
        email=""
        phone="+27792022648"
        avatarUrl={null}
      />,
    );

    expect(html).toContain("+27792022648");
    expect(html).toContain("27");
  });
});
