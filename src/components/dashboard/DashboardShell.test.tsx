import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { DashboardShell } from "./DashboardShell";

describe("DashboardShell (7P-1E)", () => {
  it("uses horizontal scroll nav on mobile and relaxed padding on larger screens", () => {
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

    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("sm:flex-wrap");
    expect(html).toContain("sm:overflow-visible");
    expect(html).toContain("shrink-0");
    expect(html).toContain("min-h-10");
    expect(html).toContain('class="mx-auto max-w-5xl px-4 py-6 sm:py-8"');
    expect(html).not.toContain('class="mx-auto max-w-5xl px-4 py-8"');
  });

  it("renders all nav destinations and sign out", () => {
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
});
