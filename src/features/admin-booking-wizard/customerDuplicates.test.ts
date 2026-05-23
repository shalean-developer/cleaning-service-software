import { describe, expect, it } from "vitest";
import { findDuplicateCustomerWarnings } from "./customerDuplicates";

describe("findDuplicateCustomerWarnings", () => {
  it("returns empty when fewer than two customers", () => {
    expect(
      findDuplicateCustomerWarnings([
        {
          customerId: "a",
          label: "A",
          email: "jane@example.com",
          phone: null,
        },
      ]),
    ).toEqual([]);
  });

  it("warns when multiple customers share email", () => {
    const warnings = findDuplicateCustomerWarnings([
      {
        customerId: "a",
        label: "Jane A",
        email: "jane@example.com",
        phone: null,
      },
      {
        customerId: "b",
        label: "Jane B",
        email: "jane@example.com",
        phone: "+27821234567",
      },
    ]);
    expect(warnings.some((w) => w.includes("share email"))).toBe(true);
  });

  it("warns when multiple customers share phone", () => {
    const warnings = findDuplicateCustomerWarnings([
      {
        customerId: "a",
        label: "A",
        email: null,
        phone: "+27821234567",
      },
      {
        customerId: "b",
        label: "B",
        email: "other@example.com",
        phone: "+27 82 123 4567",
      },
    ]);
    expect(warnings.some((w) => w.includes("share phone"))).toBe(true);
  });
});
