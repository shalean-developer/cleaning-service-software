import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "./AdminDashboardShell";

describe("AdminDashboardShell", () => {
  it("renders admin brand, sidebar nav destinations, and sign out in the profile menu", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardShell
        testChromeMounted
        title="Operations"
        subtitle="Overview"
        nav={[
          { href: "/admin", label: "Home" },
          { href: "/admin/cleaners", label: "Cleaners" },
          { href: "/admin/bookings", label: "Bookings" },
        ]}
      >
        <p>Content</p>
      </AdminDashboardShell>,
    );

    expect(html).toContain("Shalean");
    expect(html).toContain("Ops console");
    expect(html).toContain('href="/admin"');
    expect(html).toContain('href="/admin/cleaners"');
    expect(html).toContain('href="/admin/bookings"');
    expect(html).toContain("Sign out");
    expect(html).toContain('aria-label="Admin account menu"');
    expect(html).not.toContain("border-red-200");
    expect(html).toContain('aria-label="Admin operations"');
    expect(html).toContain("Operations");
    expect(html).toContain("Content");
  });

  it("does not render the legacy top admin dashboard header bar", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardShell testChromeMounted nav={[{ href: "/admin", label: "Home" }]}>Content</AdminDashboardShell>,
    );

    expect(html).not.toContain("Admin Dashboard");
    expect(html).not.toContain("Cleaning Service");
  });

  it("uses a desktop sidebar and mobile drawer for navigation", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardShell testChromeMounted nav={[{ href: "/admin", label: "Home" }]}>Content</AdminDashboardShell>,
    );

    expect(html).toContain('aria-label="Operations sidebar"');
    expect(html).toContain("Open operations menu");
    expect(html).toContain('aria-label="Operations menu"');
  });

  it("renders every ADMIN_DASHBOARD_NAV item in the sidebar", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardShell testChromeMounted nav={[...ADMIN_DASHBOARD_NAV]}>Content</AdminDashboardShell>,
    );

    for (const item of ADMIN_DASHBOARD_NAV) {
      expect(html).toContain(`href="${item.href}"`);
      expect(html).toContain(item.label);
    }
    expect(html).toContain("Operate");
    expect(html).toContain("Insight &amp; control");
    expect(html).toContain("Booking flow");
    expect(html).toContain("Hub");
  });

  it("marks the closed mobile drawer inert and aria-hidden", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardShell testChromeMounted nav={[...ADMIN_DASHBOARD_NAV]}>Content</AdminDashboardShell>,
    );
    const menuTag =
      html.match(/<aside[^>]*aria-label="Operations menu"[^>]*>/)?.[0] ?? "";

    expect(menuTag).toContain('aria-hidden="true"');
  });
});
