import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "./AdminDashboardShell";

function readSidebarSource(): string {
  return readFileSync(
    path.join(process.cwd(), "src/components/dashboard/admin/overview/AdminSidebar.tsx"),
    "utf8",
  );
}

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
    expect(html).toContain("Hub");
  });

  it("uses compact sidebar tools instead of oversized footer CTAs", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardShell testChromeMounted nav={[...ADMIN_DASHBOARD_NAV]}>Content</AdminDashboardShell>,
    );

    expect(html).toContain('aria-label="Tools"');
    expect(html).toContain("Customer booking flow");
    expect(html).toContain('href="/customer/book"');
    expect(html).toContain('data-testid="admin-sidebar-customer-booking-flow"');
    expect(html).not.toContain('data-testid="admin-sidebar-create-booking"');
    expect(html).not.toContain('href="/admin/bookings/create"');
    expect(html).not.toContain("rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white");
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

describe("AdminSidebar footer hierarchy", () => {
  it("does not render giant primary create booking CTA in source", () => {
    const source = readSidebarSource();
    expect(source).toContain("ADMIN_SIDEBAR_UTILITY_LINKS");
    expect(source).toContain('aria-label="Tools"');
    expect(source).not.toContain("admin-sidebar-create-booking");
    expect(source).not.toContain("bg-blue-600 px-3 text-sm font-semibold text-white");
  });
});
