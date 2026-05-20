import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardShell } from "./DashboardShell";

describe("DashboardShell (7P-1E)", () => {
  it("uses desktop nav on sm+ and hamburger menu on mobile", () => {
    const html = renderToStaticMarkup(
      <DashboardShell
        title="Operations"
        subtitle="Overview"
        nav={[
          { href: "/admin", label: "Home" },
          { href: "/admin/bookings", label: "Bookings" },
          { href: "/admin/assignments", label: "Assignments" },
        ]}
      >
        <p>Content</p>
      </DashboardShell>,
    );

    expect(html).toContain("hidden items-center gap-1.5 sm:flex");
    expect(html).toContain("sm:hidden");
    expect(html).toContain("Open menu");
    expect(html).toContain('class="mx-auto min-w-0 max-w-5xl px-4 py-6 sm:py-8"');
    expect(html).not.toContain('class="mx-auto max-w-5xl px-4 py-8"');
  });

  it("renders nav destinations and sign out when no profile header slot", () => {
    const html = renderToStaticMarkup(
      <DashboardShell
        title="Cleaner dashboard"
        nav={[
          { href: "/cleaner", label: "Home" },
          { href: "/cleaner/offers", label: "Offers" },
        ]}
      >
        <p>Content</p>
      </DashboardShell>,
    );

    expect(html).toContain('href="/cleaner"');
    expect(html).toContain('href="/cleaner/offers"');
    expect(html).toContain("Sign out");
  });

  it("hides cleaner nav sign out when headerEnd provides account actions", () => {
    const html = renderToStaticMarkup(
      <DashboardShell
        nav={[
          { href: "/cleaner", label: "Home" },
          { href: "/cleaner/offers", label: "Offers" },
        ]}
        headerEnd={<span data-testid="cleaner-profile-slot">Profile</span>}
      >
        <p>Content</p>
      </DashboardShell>,
    );

    expect(html).toContain('data-testid="cleaner-profile-slot"');
    const desktopNav = html.match(
      /hidden items-center gap-1\.5 sm:flex[\s\S]*?<\/nav>/,
    )?.[0];
    expect(desktopNav).toBeDefined();
    expect(desktopNav).not.toContain("Sign out");
  });

  it("hides nav sign out when headerEnd provides account actions", () => {
    const html = renderToStaticMarkup(
      <DashboardShell
        nav={[
          { href: "/customer", label: "Home" },
          { href: "/customer/bookings", label: "Bookings" },
        ]}
        headerEnd={<span data-testid="profile-slot">Profile</span>}
      >
        <p>Content</p>
      </DashboardShell>,
    );

    expect(html).toContain('data-testid="profile-slot"');
    expect(html).not.toContain("Sign out");
  });
});
