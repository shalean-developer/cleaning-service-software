import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function readFormSource(): string {
  return readFileSync(
    resolve(process.cwd(), "src/components/dashboard/admin/AdminCleanerProfileForm.tsx"),
    "utf8",
  );
}

describe("AdminCleanerProfileForm", () => {
  it("patches profile API with editable fields only", () => {
    const source = readFormSource();
    expect(source).toContain('fetch(`/api/admin/cleaners/${cleanerId}/profile`');
    expect(source).toContain('method: "PATCH"');
    expect(source).toContain("fullName: values.fullName");
    expect(source).toContain("serviceAreasInput: values.serviceAreasInput");
    expect(source).toContain("capabilities: values.capabilities");
    expect(source).not.toContain("password");
    expect(source).not.toContain("phone:");
  });

  it("shows phone and login email as read-only", () => {
    const source = readFormSource();
    expect(source).toContain("readOnlyPhone");
    expect(source).toContain("readOnlyLoginEmail");
    expect(source).toContain("Immutable in v1");
    expect(source).not.toContain('name="phone"');
  });

  it("does not include lifecycle controls", () => {
    const source = readFormSource();
    expect(source).not.toContain("AdminCleanerLifecycleActions");
    expect(source).not.toContain("Deactivate");
  });
});
