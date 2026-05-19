import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildShaleanCleanerAuthEmail } from "@/lib/auth/cleanerAuthIdentity";
import { isCleanerCreateFormSubmittable } from "@/features/cleaners/admin/cleanerProfileFormValidation";
import { CLEANER_CREATE_API_ENABLED } from "./AdminCleanerCreateForm";

function readFormSource(): string {
  return readFileSync(
    resolve(process.cwd(), "src/components/dashboard/admin/AdminCleanerCreateForm.tsx"),
    "utf8",
  );
}

describe("AdminCleanerCreateForm", () => {
  it("renders phone and generated login email instead of manual email", () => {
    const source = readFormSource();

    expect(source).toContain("Phone number");
    expect(source).toContain("Login email");
    expect(source).toContain("buildShaleanCleanerAuthEmail");
    expect(source).not.toContain('type="email"');
    expect(source).not.toContain("name=\"email\"");
  });

  it("renders password fields without logging or persisting password", () => {
    const source = readFormSource();

    expect(source).toContain("Password");
    expect(source).toContain("Confirm password");
    expect(source).toContain('type="password"');
    expect(source).not.toContain("console.log");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
  });

  it("submits correct payload to admin create API when enabled", () => {
    expect(CLEANER_CREATE_API_ENABLED).toBe(true);

    const source = readFormSource();
    expect(source).toContain('fetch("/api/admin/cleaners"');
    expect(source).toContain("fullName: values.fullName");
    expect(source).toContain("phone: values.phone");
    expect(source).toContain("password: values.password");
    expect(source).toContain("confirmPassword: values.confirmPassword");
    expect(source).toContain("capabilities: values.capabilities");
    expect(source).toContain("router.push(`/admin/cleaners/${result.cleanerId}`)");
  });

  it("does not include lifecycle controls", () => {
    const source = readFormSource();

    expect(source).not.toContain("Deactivate");
    expect(source).not.toContain("Suspend");
    expect(source).not.toContain("Archive");
    expect(source).not.toContain("AdminCleanerLifecycleActions");
  });
});

describe("AdminCleanerCreateForm validation integration", () => {
  it("preview email matches buildShaleanCleanerAuthEmail for valid phone", () => {
    expect(buildShaleanCleanerAuthEmail("0792022648")).toBe("0792022648@shalean.co.za");
  });

  it("submit stays invalid when passwords do not match", () => {
    expect(
      isCleanerCreateFormSubmittable({
        fullName: "Ada Cleaner",
        phone: "0792022648",
        password: "password-one",
        confirmPassword: "password-two",
        serviceAreasInput: "",
        capabilities: ["regular-cleaning"],
      }),
    ).toBe(false);
  });
});
