import { describe, expect, it } from "vitest";
import { calculateQuote } from "@/features/pricing/server/calculateQuote";
import { wizardStateToPricingInput } from "./buildMetadata";
import {
  deriveOfficePropertySizeSqm,
  formatOfficeSizingSummary,
  inferOfficeSizingFromPropertySizeSqm,
  patchOfficeSizing,
} from "./officeSizing";
import { INITIAL_WIZARD_STATE } from "./types";

describe("officeSizing", () => {
  it("derives sqm from office size and workstations", () => {
    expect(deriveOfficePropertySizeSqm("small", "5")).toBe(50);
    expect(deriveOfficePropertySizeSqm("medium", "15")).toBe(120);
    expect(deriveOfficePropertySizeSqm("large", "50_plus")).toBe(225);
  });

  it("formats customer-facing summary without sqm", () => {
    expect(formatOfficeSizingSummary("medium", "15", 120)).toBe(
      "Medium office · 15 workstations",
    );
    expect(formatOfficeSizingSummary("large", "50_plus", 225)).toBe(
      "Large office · 50+ workstations",
    );
  });

  it("infers tiers from legacy sqm for hydration", () => {
    expect(inferOfficeSizingFromPropertySizeSqm(120)).toEqual({
      officeSizeTier: "medium",
      officeWorkstations: "15",
    });
  });

  it("patches office sizing and synced propertySizeSqm", () => {
    expect(
      patchOfficeSizing(
        { officeSizeTier: "large" },
        { officeSizeTier: null, officeWorkstations: "10" },
      ),
    ).toEqual({
      officeSizeTier: "large",
      officeWorkstations: "10",
      propertySizeSqm: 155,
    });
  });

  it("keeps office quote generation working via pricing input bridge", () => {
    const state = {
      ...INITIAL_WIZARD_STATE,
      serviceSlug: "office-cleaning" as const,
      officeSizeTier: "medium" as const,
      officeWorkstations: "15" as const,
      propertySizeSqm: 120,
    };

    const input = wizardStateToPricingInput(state);
    expect(input?.propertySizeSqm).toBe(120);

    const quote = calculateQuote(input!);
    expect(quote.ok).toBe(true);
    if (!quote.ok) return;
    expect(quote.breakdown.totalCents).toBe(60_000 + 70 * 200);
  });
});
