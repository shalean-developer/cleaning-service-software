import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ADMIN_DASHBOARD_NAV } from "@/features/dashboards/adminNav";
import { AdminDashboardShell } from "./AdminDashboardShell";

function mobileMenuHtml(html: string): string {
  const marker = 'aria-label="Admin dashboard menu"';
  const markerIndex = html.indexOf(marker);
  expect(markerIndex).toBeGreaterThan(-1);
  const navOpen = html.lastIndexOf("<nav", markerIndex);
  const navClose = html.indexOf("</nav>", markerIndex);
  expect(navOpen).toBeGreaterThan(-1);
  expect(navClose).toBeGreaterThan(navOpen);
  return html.slice(navOpen, navClose + "</nav>".length);
}

describe("AdminDashboardShell", () => {
  it("renders admin brand, nav destinations, and sign out", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardShell
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

    expect(html).toContain("Cleaning Service");
    expect(html).toContain("Admin Dashboard");
    expect(html).toContain('href="/admin"');
    expect(html).toContain('href="/admin/cleaners"');
    expect(html).toContain('href="/admin/bookings"');
    expect(html).toContain("Sign out");
    expect(html).toContain('aria-label="Admin dashboard"');
    expect(html).toContain("Operations");
    expect(html).toContain("Content");
  });

  it("uses horizontal nav on sm+ and collapsible menu below sm", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardShell nav={[{ href: "/admin", label: "Home" }]}>Content</AdminDashboardShell>,
    );

    expect(html).toContain("hidden min-w-0 flex-1 items-center overflow-x-auto");
    expect(html).toContain("sm:flex");
    expect(html).toContain("Open navigation menu");
    expect(html).toContain('aria-label="Admin dashboard menu"');
  });

  it("renders every ADMIN_DASHBOARD_NAV item in the mobile menu", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardShell nav={[...ADMIN_DASHBOARD_NAV]}>Content</AdminDashboardShell>,
    );
    const menuHtml = mobileMenuHtml(html);

    for (const item of ADMIN_DASHBOARD_NAV) {
      expect(menuHtml).toContain(`href="${item.href}"`);
      expect(menuHtml).toContain(item.label);
    }
  });

  it("marks the closed mobile menu inert and aria-hidden", () => {
    const html = renderToStaticMarkup(
      <AdminDashboardShell nav={[...ADMIN_DASHBOARD_NAV]}>Content</AdminDashboardShell>,
    );
    const menuNavTag = mobileMenuHtml(html).match(/^<nav[^>]*>/)?.[0] ?? "";

    expect(menuNavTag).toContain('aria-hidden="true"');
    expect(menuNavTag).toContain("inert");
  });
});
