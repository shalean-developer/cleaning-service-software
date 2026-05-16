import { describe, expect, it } from "vitest";
import { INITIAL_WIZARD_STATE } from "./types";
import { nextStep, previousStep } from "./navigation";
import { canProceedToCheckout } from "./validation";

describe("wizard flow", () => {
  it("has seven ordered steps ending at checkout", () => {
    let step = INITIAL_WIZARD_STATE.step;
    const visited: string[] = [step];
    for (let i = 0; i < 10; i++) {
      const n = nextStep(step);
      if (!n) break;
      step = n;
      visited.push(step);
    }
    expect(visited).toEqual([
      "service",
      "datetime",
      "location",
      "details",
      "cleaner",
      "review",
      "checkout",
    ]);
    expect(previousStep("checkout")).toBe("review");
  });

  it("does not allow checkout without quote (no client-side confirm)", () => {
    expect(canProceedToCheckout({ ...INITIAL_WIZARD_STATE, step: "checkout" })).toBe(
      false,
    );
  });
});
