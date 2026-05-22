import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readPage(relativePath: string): string {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("admin cleaners pages (PR-F)", () => {
  it("list page uses admin read model and does not mutate lifecycle columns", () => {
    const source = readPage("src/app/(admin)/admin/cleaners/page.tsx");

    expect(source).toContain("listAdminCleaners");
    expect(source).toContain("AdminCleanersNetworkGrid");
    expect(source).toContain("AdminCleanersNetworkToolbar");
    expect(source).not.toMatch(/\.from\s*\(\s*["']cleaners["']\s*\)/);
    expect(source).not.toContain("deactivateCleaner");
    expect(source).not.toContain("requireServiceRoleClient");
  });

  it("detail page wires remediation panel and audit log", () => {
    const source = readPage("src/app/(admin)/admin/cleaners/[cleanerId]/page.tsx");

    expect(source).toContain("getAdminCleanerDetail");
    expect(source).toContain("AdminCleanerRemediationPanel");
    expect(source).toContain("AdminCleanerAuditLog");
    expect(source).not.toMatch(/\.from\s*\(\s*["']cleaners["']\s*\)[\s\S]*?\.update/);
    expect(source).not.toContain("deactivateCleaner");
  });

  it("lifecycle actions call admin API routes, not direct Supabase updates", () => {
    const source = readPage("src/components/dashboard/admin/AdminCleanerLifecycleActions.tsx");

    expect(source).toContain("/api/admin/cleaners/${cleanerId}/${ACTION_ENDPOINTS[action]}");
    expect(source).toContain('deactivate: "deactivate"');
    expect(source).toContain('archive: "archive"');
    expect(source).not.toMatch(/\.from\s*\(\s*["']cleaners["']\s*\)/);
    expect(source).not.toContain("active:");
    expect(source).not.toContain("suspended_at");
    expect(source).not.toContain("deleted_at");
  });

  it("reactivate is disabled for archived cleaners", () => {
    const source = readPage("src/components/dashboard/admin/AdminCleanerLifecycleActions.tsx");

    expect(source).toContain("isArchived");
    expect(source).toContain("disabled={loadingAction !== null || isArchived}");
  });

  it("unsuspend is only shown when suspended", () => {
    const source = readPage("src/components/dashboard/admin/AdminCleanerLifecycleActions.tsx");

    expect(source).toContain("isSuspended");
    expect(source).toMatch(/isSuspended \? \(/);
    expect(source).toContain('submitAction("unsuspend")');
  });

  it("list page links to create cleaner route", () => {
    const source = readPage("src/app/(admin)/admin/cleaners/page.tsx");

    expect(source).toContain('href="/admin/cleaners/new"');
    expect(source).toMatch(/Create cleaner/);
  });

  it("create page uses profile form only without lifecycle mutations", () => {
    const source = readPage("src/app/(admin)/admin/cleaners/new/page.tsx");

    expect(source).toContain("AdminCleanerCreateForm");
    expect(source).toContain('href="/admin/cleaners"');
    expect(source).not.toContain("AdminCleanerLifecycleActions");
    expect(source).not.toContain("deactivateCleaner");
    expect(source).not.toMatch(/\.from\s*\(\s*["']cleaners["']\s*\)/);
    expect(source).not.toContain('fetch("/api/admin/cleaners"');
  });

  it("create page supports query param prefill from onboarding leads", () => {
    const source = readPage("src/app/(admin)/admin/cleaners/new/page.tsx");

    expect(source).toContain("searchParams");
    expect(source).toContain("initialFullName");
    expect(source).toContain("initialPhone");
  });

  it("detail page rejects non-uuid cleanerId and redirects onboarding-leads slug", () => {
    const source = readPage("src/app/(admin)/admin/cleaners/[cleanerId]/page.tsx");

    expect(source).toContain('cleanerId === "onboarding-leads"');
    expect(source).toContain('redirect("/admin/cleaners/onboarding-leads")');
    expect(source).toContain("isUuid(cleanerId)");
    expect(source).toContain("notFound()");
  });

  it("onboarding leads page is read-only file review without DB writes", () => {
    const source = readPage("src/app/(admin)/admin/cleaners/onboarding-leads/page.tsx");

    expect(source).toContain("loadCleanerOnboardingLeads");
    expect(source).toContain("AdminCleanerOnboardingLeadsTable");
    expect(source).not.toMatch(/\.from\s*\(\s*["']cleaners["']\s*\)/);
    expect(source).not.toContain("requireServiceRoleClient");
    expect(source).not.toContain("/api/admin/cleaners");
  });
});
