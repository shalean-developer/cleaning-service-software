import { describe, expect, it } from "vitest";
import {
  CLEANER_CREATE_MIN_PASSWORD_LENGTH,
  isCleanerCreateFormSubmittable,
  parseServiceAreasInput,
  validateCleanerCreateForm,
} from "./cleanerProfileFormValidation";

function validValues() {
  return {
    fullName: "Ada Cleaner",
    phone: "0792022648",
    password: "secure-pass-1",
    confirmPassword: "secure-pass-1",
    serviceAreasInput: "Sea Point, Cape Town",
    capabilities: ["regular-cleaning"] as const,
  };
}

describe("parseServiceAreasInput", () => {
  it("normalizes comma- and newline-separated suburbs", () => {
    expect(parseServiceAreasInput("Sea Point\nCape Town, Stellenbosch")).toEqual([
      "sea-point",
      "cape-town",
      "stellenbosch",
    ]);
  });

  it("deduplicates normalized slugs", () => {
    expect(parseServiceAreasInput("Sea Point, sea point")).toEqual(["sea-point"]);
  });

  it("returns empty array for blank input", () => {
    expect(parseServiceAreasInput("  \n  ")).toEqual([]);
  });
});

describe("validateCleanerCreateForm", () => {
  it("accepts valid values and returns generated auth email", () => {
    const result = validateCleanerCreateForm({
      ...validValues(),
      capabilities: ["regular-cleaning", "deep-cleaning"],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.serviceAreaSlugs).toEqual(["sea-point", "cape-town"]);
    expect(result.phoneE164).toBe("+27792022648");
    expect(result.generatedAuthEmail).toBe("0792022648@shalean.co.za");
  });

  it("requires full name, phone, passwords, and capability", () => {
    const result = validateCleanerCreateForm({
      fullName: "",
      phone: "",
      password: "",
      confirmPassword: "",
      serviceAreasInput: "",
      capabilities: [],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.fullName).toBeDefined();
    expect(result.errors.phone).toBeDefined();
    expect(result.errors.password).toBeDefined();
    expect(result.errors.confirmPassword).toBeDefined();
    expect(result.errors.capabilities).toBeDefined();
    expect(result.generatedAuthEmail).toBeNull();
  });

  it("rejects invalid SA phone", () => {
    const result = validateCleanerCreateForm({
      ...validValues(),
      phone: "0111234567",
      capabilities: ["regular-cleaning"],
    });
    expect(result.errors.phone).toBeDefined();
    expect(result.generatedAuthEmail).toBeNull();
  });

  it("generates preview email from international phone format", () => {
    const result = validateCleanerCreateForm({
      ...validValues(),
      phone: "+27 79 202 2648",
      capabilities: ["regular-cleaning"],
    });
    expect(result.generatedAuthEmail).toBe("0792022648@shalean.co.za");
  });

  it("requires password minimum length", () => {
    const short = "a".repeat(CLEANER_CREATE_MIN_PASSWORD_LENGTH - 1);
    const result = validateCleanerCreateForm({
      ...validValues(),
      password: short,
      confirmPassword: short,
      capabilities: ["regular-cleaning"],
    });
    expect(result.errors.password).toMatch(/at least 8/i);
    expect(isCleanerCreateFormSubmittable({
      ...validValues(),
      password: short,
      confirmPassword: short,
      capabilities: ["regular-cleaning"],
    })).toBe(false);
  });

  it("rejects mismatched confirm password", () => {
    const result = validateCleanerCreateForm({
      ...validValues(),
      confirmPassword: "different-password",
      capabilities: ["regular-cleaning"],
    });
    expect(result.errors.confirmPassword).toMatch(/do not match/i);
    expect(isCleanerCreateFormSubmittable({
      ...validValues(),
      confirmPassword: "different-password",
      capabilities: ["regular-cleaning"],
    })).toBe(false);
  });

  it("allows empty service areas", () => {
    const result = validateCleanerCreateForm({
      ...validValues(),
      serviceAreasInput: "",
      capabilities: ["regular-cleaning"],
    });
    expect(result.valid).toBe(true);
    expect(result.serviceAreaSlugs).toEqual([]);
  });

  it("requires at least one capability", () => {
    const result = validateCleanerCreateForm({
      ...validValues(),
      capabilities: [],
    });
    expect(result.errors.capabilities).toMatch(/at least one/i);
  });
});
